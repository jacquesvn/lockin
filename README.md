# Lockin — your pocket CS2 coach

**[Open Lockin →](https://jacquesvn.github.io/lockin/)** · [What it is](https://jacquesvn.github.io/lockin/landing.html)

A free coach for Counter-Strike 2. Answer eight questions and Lockin builds you a
personalised 12-week training plan plus the daily tracker to actually run it — then reads
your own log back at week 4 and week 8 and offers to change the plan. Because a good plan
and the discipline to follow it shouldn't cost $50 an hour.

It asks where you play first, so the rank question uses brackets you actually recognise —
Premier ratings, FACEIT levels, or plain descriptions if you are on ESEA or a mix. Paste a
Leetify profile link and it will read your public stats to pre-answer the weakness question
— entirely optional, and nothing from the API is ever stored.

No account. No server. No telemetry. Your data lives on your device and nowhere else. The
only request Lockin ever makes off your machine is the Leetify one you trigger yourself by
pasting a profile link — the response is read once, in memory, and dropped when your plan
is built.

---

## What it does

**Builds you a plan.** A rule-based coach picks the one habit that's costing you the most
(your *keystone*), then rotates your week around it — training days, match nights, rest.
Your stated availability actually shapes it: two days a week gets you a two-day plan, and
the 10-minute tier gets a core-only session, not a trimmed 45-minute one.

**The week is yours to set.** Fri/Sat match nights are only a starting guess — tap any day
on Plan to make it a training focus, a match night, or rest. Your training days drive the
weekly target and the streak, wherever in the week they fall.

**The plan adapts.** At week 5 and week 9 Lockin reviews the block you just finished — how
many planned days you actually trained, your average hand feel, any Leetify checkpoints
that moved, and your logged deaths — and either says *nothing here argues for a change* or
offers you a different focus for the weeks ahead. You choose; **Apply it** keeps your
history, streak and your own match/rest days and only reshuffles the training slots. If you
logged too little to conclude anything, it says so instead of inventing a verdict.

**Gets you to actually train.**
- **Guided session** — a timed drill runner, one drill at a time. Every drill states the
  same six things: what you're doing, the map, the goal, the mindset to hold, what a right
  result looks like, and what doesn't count ("a shot while still moving does not count")
- **Every session ends on a calm reset** — slow, perfect reps, because you keep whatever
  you did last
- **"I've got 5 minutes"** — one core drill, five minutes, and the day still counts
- **Daily cue** — *"after ___, I do the ten"*, because a plan with a *when* happens
- **Streak + never-miss-twice**, with weekends and your own rest days forgiven
- **Log yesterday** for the night you trained and forgot to tick it
- **Come back after a lapse** and you get *welcome back*, not a telling-off — the week
  you're in, your best streak, your total, and one five-minute session to be back on. The
  plan never restarts.

**A coach-built session, as written.** The Oblivion Protocol — 33 minutes of aim
foundations then angle discipline, with the exact map settings and per-block cues, runnable
straight from Plan. Written by a coach for a real player and kept as it was.

**Match nights get their own screen.** First the nerves — a short reappraisal script, the
one pressure intervention that has actually been tested on Counter-Strike players, with its
result and its limits printed on the card. Then The Gate: warmed up, not tilted, one
process goal — and a loss counter that calls a stop-loss at two, before the third one costs
you more.

**Shows whether it's working.**
- Streak, best streak, days trained, average hand feel
- Labelled bar charts for sessions-per-week and hand-feel trend — printed values and an
  honest axis, so a flat run looks flat instead of dramatic
- Month calendar of every session
- **Leetify checkpoints** at base / week 4 / 8 / 12, with your bracket's average alongside
  — entirely optional, and the averages say when they are Premier-derived rather than
  native to your platform
- **Death audit** — tag each death by cause and Lockin names your biggest leak

**Preps your maps.** For all seven Active Duty maps: what your utility is actually *for*,
what to deny on CT side, and where the crosshair rides on each entry route — plus a vault
for the lineups you learn, in your own words.

**Remembers your setup.** Sens, DPI (with eDPI), crosshair code, launch options — so a
reinstall never costs you your muscle memory.

Also: light/dark, a shareable progress card, full export/restore, a feedback link that
prefills your version, and a desktop build with a tray icon, a daily "go train" nudge, and
a yellow banner at the top when a new version is ready — dismissible, and it never
interrupts a session.

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
- Workshop maps are named as their authors actually named them, and described by what
  they actually contain — checked against the live Workshop pages, not recalled.

The same rule applies to the psychology. The match-night nerves card is the one thing in
Lockin that cites a study, because it is the one thing with a controlled Counter-Strike
result behind it (44 players, pre-registered: accuracy 66% → 72%, and *no* speed benefit —
so the card doesn't claim one). Several things that sound obviously true — interleaved
practice, "aim at the target, not your hands" cues, quiet-eye drills — were checked, found
to have no supporting FPS evidence, and deliberately **not** built.

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
DOM, so they exercise the shipped code rather than a copy of it — 193 of them, including a
second sandbox with `window.__TAURI__` mocked so the desktop-only paths are covered too.
Several are content guards rather than logic tests: they fail the build if the copy starts
claiming a rifle needs a dead stop, or that anything makes you *faster*.

Drills are built by `D(...)`, a positional constructor shared by 49 call sites. **Add new
fields at the end, never in the middle** — inserting one silently shifts every argument
after it, which once collapsed the coach protocol to zero minutes.

The Leetify read follows their [developer
guidelines](https://leetify.com/blog/leetify-api-developer-guidelines/): the response is
held in memory only and cleared once the plan is built, the "Data provided by Leetify"
badge is embedded as supplied, and the service worker passes cross-origin requests straight
through rather than caching them. Note that `rating.aim`, `.positioning` and `.utility`
come back on a 0–100 scale while `.clutch` and `.opening` are roughly 0–1 — ranking them
together nominates the same two weaknesses for every player alive, so only the first three
are compared.

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
