# Lockin — your pocket CS2 coach

**[Open Lockin →](https://jacquesvn.github.io/lockin/)** · [What it is](https://jacquesvn.github.io/lockin/landing.html)

A free coach for Counter-Strike 2. Answer seven questions and Lockin builds you a
personalised 12-week training plan plus the daily tracker to actually run it — because a
good plan and the discipline to follow it shouldn't cost $50 an hour.

No account. No server. No telemetry. Your data lives on your device and nowhere else.

---

## What it does

**Builds you a plan.** A rule-based coach picks the one habit that's costing you the most
(your *keystone*), then rotates your week around it — training days, match nights, rest.
Your stated availability actually shapes it: two days a week gets you a two-day plan, and
the 10-minute tier gets a core-only session, not a trimmed 45-minute one.

**Gets you to actually train.**
- **Guided session** — a timed drill runner, one drill at a time
- **"I've got 5 minutes"** — one core drill, five minutes, and the day still counts
- **Daily cue** — *"after ___, I do the ten"*, because a plan with a *when* happens
- **Streak + never-miss-twice**, with weekends and your own rest days forgiven
- **Log yesterday** for the night you trained and forgot to tick it

**Match nights get their own screen.** The Gate: warmed up, not tilted, one process goal —
then a loss counter that calls a stop-loss at two, before the third one costs you more.

**Shows whether it's working.**
- Streak, best streak, days trained, average hand feel
- Sparklines for sessions-per-week and hand-feel trend
- Month calendar of every session
- **Leetify checkpoints** at base / week 4 / 8 / 12, with your bracket's average alongside
- **Death audit** — tag each death by cause and Lockin names your biggest leak

**Preps your maps.** For all seven Active Duty maps: what your utility is actually *for*,
what to deny on CT side, and where the crosshair rides on each entry route — plus a vault
for the lineups you learn, in your own words.

**Remembers your setup.** Sens, DPI (with eDPI), crosshair code, launch options — so a
reinstall never costs you your muscle memory.

Also: light/dark, a shareable progress card, full export/restore, and a desktop build with
a tray icon and a daily "go train" nudge.

---

## Get it

| | |
|---|---|
| **Web / PWA** | [jacquesvn.github.io/lockin](https://jacquesvn.github.io/lockin/) — works offline, "Install app" to keep it |
| **Single file** | Download `docs/index.html`, double-click. No server, no install, nothing else needed. |
| **Desktop** | Grab the installer from the [latest release](../../releases) — adds the tray, native reminders, and self-updating |
| **Self-host** | `docs/` is a static folder — serve it with anything (`npx serve docs`, nginx, any static host) |

The installer isn't code-signed, so Windows SmartScreen may warn on first run:
**More info → Run anyway**. From v0.9.1 the desktop app updates itself, so that's a
one-time step.

---

## On the coaching

The advice is checked, not vibes. A few things Lockin deliberately gets right where common
wisdom doesn't:

- Your rifle's first shot is accurate below **~34% of max speed** — a counter-strafe, not
  a dead stop. The AWP is stricter and wants a near-full stop.
- Counter-strafing **plateaus around 78%**, so above that the reps belong in crosshair
  placement instead. Lockin stops recommending it at high rank for exactly this reason.
- **Leetify Rating is zero-sum** (relative to your lobby) — chase the skill numbers, not
  the rating.

Map prep gives you the utility *jobs* and prefire routes, not step-by-step lineups —
exact throws are patch-specific, and a lineup that's quietly wrong is worse than none.
Learn those in Yprac and save them in the vault.

---

## Develop

`docs/index.html` is the single source of truth: one file, inline CSS and JS, no build
step, no dependencies, no CDN. The desktop build bundles it via `frontendDist: ../docs`,
and the standalone copy is generated from it — never hand-edited separately.

```bash
npm run verify   # syntax gate + unit tests against the real shipped code
npm run check    # syntax gate only
npm test         # unit tests only
```

The tests extract the actual `<script>` from `docs/index.html` and run it in a sandboxed
DOM, so they exercise the shipped code rather than a copy of it.

## Release

Bump the version in **all five**: `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `VERSION` in `docs/index.html`, and `CACHE` in
`docs/service-worker.js` (kept equal to the version). Then tag `vX.Y.Z` and push.

CI refuses to build unless every one of those agrees with the tag, then runs the frontend
gate before touching Rust — so a syntax-broken or mislabelled release can't ship.

Updates are signed with a minisign keypair (free and self-generated — not a code-signing
certificate). The public half lives in `tauri.conf.json`; the private half is the
`TAURI_SIGNING_PRIVATE_KEY` repo secret. Tauri won't install an update it can't verify
against that pubkey.

## License

[MIT](LICENSE).
