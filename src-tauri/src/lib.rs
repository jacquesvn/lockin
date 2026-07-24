use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
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
            open_url
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
