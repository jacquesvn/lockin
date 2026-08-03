use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use std::path::{Path, PathBuf};
use tauri_plugin_autostart::{ManagerExt as _, MacosLauncher};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_updater::UpdaterExt;

// Fire a native OS notification. Wrapping the plugin in our own command means the
// frontend only calls a normal app command (no plugin-permission ACL needed).
// NOTE: on Windows a toast only shows for an INSTALLED build (registered AppUserModelID);
// a portable/dev exe returns Ok here but shows nothing.
#[tauri::command]
fn notify(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

// Open an external URL in the user's real browser. In a Tauri webview a plain
// <a target="_blank"> opens a bare in-app window with no chrome instead of the
// system browser, so every external link (Steam Workshop, Leetify, feedback) is
// routed through here. Wrapping the opener plugin in our own command keeps the
// frontend on core:default — no plugin ACL (same pattern as notify/set_autostart).
// Restricted to http(s) so the webview can never be told to launch another scheme.
#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    let u = url.trim();
    if !(u.starts_with("https://") || u.starts_with("http://")) {
        return Err("refused: only http(s) URLs".into());
    }
    app.opener()
        .open_url(u, None::<&str>)
        .map_err(|e| e.to_string())
}

// ---- optional, desktop-only: which Workshop maps are already downloaded ----
// A passive hint for the "Get the maps" panel. Reads only — Steam's own registry key
// (HKCU, the user's hive) and workshop folders under the Steam library — so it needs no
// admin and never writes. FAIL-SAFE: if Steam can't be located, `ok` is false and the UI
// shows no badges rather than claiming every map is missing.
#[derive(serde::Serialize)]
struct WorkshopScan {
    ok: bool,
    installed: Vec<String>,
}

#[cfg(windows)]
fn steam_root() -> Option<PathBuf> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Software\\Valve\\Steam")
        .ok()?;
    let p: String = key.get_value("SteamPath").ok()?;
    let root = PathBuf::from(p);
    // Reject a UNC registry value BEFORE the is_dir() below stats it (see is_local_path),
    // and sanity-check it's a real install so a stale path can't cry wolf.
    if is_local_path(&root) && root.join("steamapps").is_dir() {
        Some(root)
    } else {
        None
    }
}

#[cfg(not(windows))]
fn steam_root() -> Option<PathBuf> {
    None
}

// A path is rejected as non-local if it begins with two slashes — i.e. a UNC / network
// path like \\host\share. is_dir() on such a path makes Windows open an outbound SMB
// connection and attempt an NTLM handshake, so a crafted registry value or a tampered
// libraryfolders.vdf could coerce a credential leak just by our checking a folder exists.
// Steam library roots are always local drive paths, so this loses nothing legitimate.
fn is_local_path(p: &Path) -> bool {
    let s = p.as_os_str().to_string_lossy();
    let b = s.as_bytes();
    !(b.len() >= 2 && (b[0] == b'\\' || b[0] == b'/') && (b[1] == b'\\' || b[1] == b'/'))
}

// Every Steam library root: the main install plus any extra library folders declared in
// libraryfolders.vdf. Returns None if the vdf can't be read — a PARTIAL enumeration would
// let a map on an unread library get a false "not downloaded", so the caller fails closed
// (hides all badges) rather than asserting something wrong. UNC library entries are skipped.
fn steam_libraries(root: &Path) -> Option<Vec<PathBuf>> {
    let mut libs = vec![root.to_path_buf()];
    let vdf = root.join("steamapps").join("libraryfolders.vdf");
    let text = std::fs::read_to_string(&vdf).ok()?;
    for line in text.lines() {
        let l = line.trim();
        if !l.starts_with("\"path\"") {
            continue;
        }
        // line: "path"    "D:\\SteamLibrary"  -> take the second quoted string,
        // unescaping the VDF's doubled backslashes.
        let after = &l[6..];
        if let Some(open) = after.find('"') {
            let rest = &after[open + 1..];
            if let Some(close) = rest.find('"') {
                let p = PathBuf::from(rest[..close].replace("\\\\", "\\"));
                if is_local_path(&p) {
                    libs.push(p);
                }
            }
        }
        if libs.len() >= 32 {
            break; // bound a vdf padded with fabricated blocks
        }
    }
    Some(libs)
}

#[tauri::command]
fn scan_workshop(ids: Vec<String>) -> WorkshopScan {
    let root = match steam_root() {
        Some(r) => r,
        None => {
            return WorkshopScan {
                ok: false,
                installed: vec![],
            }
        }
    };
    // fail closed: if libraries can't be fully enumerated, hide badges instead of
    // reporting a map on an unread library as "not downloaded".
    let libs = match steam_libraries(&root) {
        Some(l) => l,
        None => {
            return WorkshopScan {
                ok: false,
                installed: vec![],
            }
        }
    };
    let mut installed = Vec::new();
    for id in ids {
        // ids come from our own catalog, but validate anyway so a folder name can never
        // escape the workshop path (no traversal even if the frontend is tampered with)
        if id.is_empty() || !id.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }
        for lib in &libs {
            let p = lib
                .join("steamapps")
                .join("workshop")
                .join("content")
                .join("730")
                .join(&id);
            if p.is_dir() {
                installed.push(id.clone());
                break;
            }
        }
    }
    WorkshopScan { ok: true, installed }
}

// ---- automatic backup: mirror the app state to a file so a wiped WebView cache can't
// lose a streak. localStorage stays the live source of truth; this file just shadows it
// (written debounced on save) and is read back only when localStorage comes up empty. It
// lives in the roaming app-data dir, so clearing browser data never touches it.
fn backup_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("lockin-state.json"))
}

#[tauri::command]
fn backup_write(app: tauri::AppHandle, json: String) -> Result<(), String> {
    let path = backup_path(&app).ok_or("no app data dir")?;
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    // write to a temp file then rename, so a crash mid-write can't corrupt the backup
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, json.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn backup_read(app: tauri::AppHandle) -> Option<String> {
    let path = backup_path(&app)?;
    std::fs::read_to_string(&path).ok()
}

// Enable/disable launch-at-login so the tray app is around to deliver reminders.
#[tauri::command]
fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let m = app.autolaunch();
    if enabled {
        m.enable().map_err(|e| e.to_string())
    } else {
        m.disable().map_err(|e| e.to_string())
    }
}

// Is a newer release published? Returns Some(version) or None. Wrapped as an app command so the
// frontend needs no plugin ACL (same pattern as notify/set_autostart).
#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let found = updater.check().await.map_err(|e| e.to_string())?;
    Ok(found.map(|u| u.version))
}

// Download + install the pending update, then relaunch into the new version.
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_chunk, _total| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // single-instance MUST be registered first: a second launch (autostart + manual) focuses
        // the running window instead of spawning a duplicate tray icon / webview / reminder timer.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            notify,
            set_autostart,
            check_update,
            install_update,
            open_url,
            scan_workshop,
            backup_write,
            backup_read
        ])
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Open Lockin", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let mut tb = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                // only a completed left-click opens the window — right-click still just opens the
                // context menu (was: any Click fired, so right-click popped the window too).
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                });
            // guard the icon so a missing embedded icon can't panic startup before any window shows
            if let Some(icon) = app.default_window_icon() {
                tb = tb.icon(icon.clone());
            }
            tb.build(app)?;

            // SELF-HEAL: early desktop builds registered a service worker at tauri.localhost.
            // Being cache-first, it then served that old app forever — surviving every reinstall,
            // and refusing to serve the very code that stopped registering it. The frontend can't
            // escape that on its own, so break the loop from the native side: unregister any SW,
            // drop its caches, and reload into the real bundled app. No-ops on a clean install,
            // and never touches localStorage, so streaks and plans are preserved.
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.eval(
                    "(function(){try{if(!navigator.serviceWorker)return;\
navigator.serviceWorker.getRegistrations().then(function(rs){\
if(!rs.length)return;\
Promise.all(rs.map(function(r){return r.unregister();}))\
.then(function(){return caches.keys();})\
.then(function(ks){return Promise.all(ks.map(function(k){return caches.delete(k);}));})\
.then(function(){location.reload(true);});});}catch(e){}})()",
                );
            }
            Ok(())
        })
        // Closing the window hides it to the tray (so the reminder timer keeps running).
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Lockin");
}
