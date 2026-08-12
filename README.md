# Lockin — your pocket CS2 coach

**[Open Lockin →](https://jacquesvn.github.io/lockin/)** · [What it is](https://jacquesvn.github.io/lockin/landing.html) · [Download for Windows](../../releases/latest)

A free coach for Counter-Strike 2. Answer eight questions and Lockin builds you a
personalised 12-week training plan plus the daily tracker to actually run it — then reads
your own log back at week 4 and week 8 and offers to change the plan. Because a good plan
and the discipline to follow it shouldn't cost $50 an hour.

No account. No server. No telemetry. Your data lives on your device and nowhere else.

<!-- SCREENSHOTS — uncomment the table below once the four PNGs are in docs/shots/.
     It is commented out deliberately: four broken image icons at the top of a README is
     worse than no images at all, and this is the first thing a new user sees.
     See "Screenshots" under Develop for exactly which four shots and how to take them.

| | |
|:--:|:--:|
| ![Today — one card, the day's drills, the streak](docs/shots/today.png) | ![Progress — sessions, hand feel, leaks](docs/shots/progress.png) |
| **Today** — one thing at a time, and the day's drills | **Progress** — whether it is actually working |
| ![The plan — twelve weeks, your keystone](docs/shots/plan.png) | ![Guided session — one drill, timed](docs/shots/session.png) |
| **The plan** — twelve weeks built round one habit | **Guided session** — one drill at a time, timed |

-->

*[Screenshots go here — see [Screenshots](#screenshots).]*

---

## Will this actually make me better?

Here is the honest version, because you have been sold aim trainers before.

**The problem is almost never that you don't know what to practise.** It's that you open the
game, deathmatch for ten minutes, queue, lose two, and go again. Twelve weeks later nothing
has moved. Lockin exists for that gap — not to teach you Counter-Strike, but to make the
practice you already meant to do actually happen, in the right order, on the days you said.

**What changes for you:**

- **You stop training everything at once.** Lockin picks the *one* habit costing you the
  most rounds — your keystone — and builds the week around it. Spreading yourself across six
  weaknesses is why nothing improves.
- **The session is decided before you sit down.** A timed runner, one drill at a time, with
  the map, the goal, what counts as a rep and what doesn't. No deciding, no drifting.
- **Ten minutes still counts.** The 10-minute tier is a real core-only session, not a
  trimmed 45. The day you don't feel like it is the day the streak is worth something.
- **A bad day doesn't wipe the month.** You earn a streak freeze every seven training days.
  Miss one, it gets bridged. Come back after a real lapse and you get *welcome back* and a
  lighter week — not a telling-off and a full plan, which is exactly why people don't
  come back.
- **The plan argues with itself, not with you.** At weeks 5 and 9 it reads your own log
  back. If you showed up 15 of 15 days and the number you're tracking hasn't moved, it says
  *the habit is not the problem* and offers a different focus. If you logged too little to
  conclude anything, it says that instead of inventing a verdict.
- **You find out whether it worked.** Sessions per week, hand feel, your death causes and
  which leak is shrinking — every figure naming where it came from, including the ones
  Lockin did *not* measure.

**What it will not do:** it won't rank you up on its own, it won't promise a trainer
transfers to matches (no study shows that), and it won't tell you a drill made you *faster*
when the evidence only shows more accurate. If a claim isn't supported, it isn't in here —
see [On the coaching](#on-the-coaching).

---

## Get it

| | |
|---|---|
| **Web / PWA** | [jacquesvn.github.io/lockin](https://jacquesvn.github.io/lockin/) — works offline, "Install app" to keep it |
| **Single file** | Download `docs/index.html`, double-click. No server, no install, nothing else needed. |
| **Desktop** | Grab the installer from the [latest release](../../releases/latest) — adds the tray, native reminders, CS2 auto-tracking, and self-updating |
| **Self-host** | `docs/` is a static folder — serve it with anything (`npx serve docs`, nginx, any static host) |

The installer isn't code-signed, so Windows SmartScreen may warn on first run:
**More info → Run anyway**. From v0.9.1 the desktop app updates itself, so that's a
one-time step.

---

## What it does

**Builds you a plan.** A rule-based coach picks the one habit that's costing you the most
(your *keystone*), then rotates your week around it — training days, match nights, rest.
Your stated availability actually shapes it: two days a week gets you a two-day plan, and
the 10-minute tier gets a core-only session, not a trimmed 45-minute one.

It asks where you play first, so the rank question uses brackets you actually recognise —
Premier ratings, FACEIT levels, or plain descriptions if you are on ESEA or a mix. Paste a
Leetify profile link and it will read your public stats to pre-answer the weakness question
— entirely optional, and nothing from the API is ever stored.

**The week is yours to set.** Fri/Sat match nights are only a starting guess — tap any day
on Plan to make it a training focus, a match night, or rest. Your training days drive the
weekly target and the streak, wherever in the week they fall.

**The plan adapts.** At week 5 and week 9 Lockin reviews the block you just finished — how
many planned days you actually trained, your average hand feel, any Leetify checkpoints
that moved, and your logged deaths — and either says *nothing here argues for a change* or
offers you a different focus for the weeks ahead. You choose; **Apply it** keeps your
history, streak and your own match/rest days and only reshuffles the training slots. If you
logged too little to conclude anything, it says so instead of inventing a verdict.

**Argues with the plan, not with you.** When you keep showing up and a checkpoint you
entered has barely moved, Lockin says so plainly — *"You showed up 15 of 15 days. The habit
is not the problem"* — and offers to change the plan. It only speaks when both halves are
evidenced; missing either, it stays quiet rather than guessing. Every fourth week the load
is actually halved, not just described as lighter. Every Sunday it asks one question, and
each answer does something genuinely different — including the one that changes nothing and
says so. And if a drill is the one you keep skipping, it treats that as the plan's problem:
*"That is not laziness — a drill skipped this consistently is either too hard or wrong
for you."*

**Today shows one thing at a time.** Cards are ranked by how fast the moment passes — the
match-night gate expires the second you queue, a lapse is just as true tomorrow — so at
most one surfaces, with the rest behind a *N more waiting*. It can't become a wall.

**Gets you to actually train.**
- **Guided session** — a timed drill runner, one drill at a time. Every drill states the
  same six things: what you're doing, the map, the goal, the mindset to hold, what a right
  result looks like, and what doesn't count ("a shot while still moving does not count")
- **Every session ends on a calm reset** — slow, perfect reps, because you keep whatever
  you did last
- **"I've got 5 minutes"** — one core drill, five minutes, and the day still counts
- **Daily cue** — *"after ___, I do the ten"*, because a plan with a *when* happens
- **Streak + never-miss-twice**, with weekends and your own rest days forgiven
- **Streak freezes** — one earned per seven training days, up to three. A missed day gets
  bridged instead of wiping a month's work. You keep the streak you actually earned.
- **Milestones** — twelve of them, from your first rep to finishing the twelve weeks
- **Log yesterday** for the night you trained and forgot to tick it
- **Come back after a lapse** and you get *welcome back*, not a telling-off — the week
  you're in, your best streak, your total, and one five-minute session to be back on. The
  plan never restarts.
- **A guided tour on first run** — a spotlight walk through the whole app, so nothing
  useful stays hidden. Replayable any time from the sidebar.
- **A lighter week back** — return after a lapse and the day is core-only for a few days,
  and it says so. Coming back to a full plan is exactly why people don't come back.
- **Pause it on purpose** — injury, exams, life. Two, four or six weeks: the streak is
  held, nothing is marked missed, and the programme clock stops so you resume at the week
  you left rather than restarting.
- **Rest is a real day** — scheduled rest days are tickable. Log them and the week reads
  *complete*, not incomplete.

**A coach-built session, as written.** The Oblivion Protocol — 33 minutes of aim
foundations then angle discipline, with the exact map settings and per-block cues, runnable
straight from Practice. Written by a coach for a real player and kept as it was.

**Match nights get their own screen.** First the nerves — a short reappraisal script, the
one pressure intervention that has actually been tested on Counter-Strike players, with its
result and its limits printed on the card. Then The Gate: warmed up, not tilted, one
process goal — and a loss counter that calls a stop-loss at two, before the third one costs
you more. The stop-loss counts the *night*, not the calendar day, so two losses at 23:30 are
still two losses at 03:00. Afterwards, a thirty-second debrief: what actually cost you
rounds, and how it felt.

**Tracks your matches by itself.** *(desktop)* One click writes CS2's Game State
Integration config, and from then on finished matches log themselves — a loss counts toward
tonight's stop-loss with nothing to press. It reads the scoreboard only, over a
loopback-only connection that ignores anything without its own token, and nothing leaves
your PC. The manual +1 LOSS button keeps working exactly as before for anyone who doesn't
set it up.

**Watches your rounds so you don't have to.** *(desktop, and new)* With auto-tracking on,
Lockin keeps one fact per round — did you die, how long after the round went live, what you
had bought, whether you won — and after enough rounds shows what it saw: how often you died
inside the first twenty seconds, your typical time of death, whether the early ones
correlate with losing. It is filed under *observations, not advice*, and the plan will not
act on any of it: nobody has to remember twenty rounds after the fact, and self-report is
exactly the thing this app distrusts everywhere else.

**Shows whether it's working.**
- Streak, best streak, days trained, average hand feel
- Labelled bar charts for sessions-per-week and hand-feel trend — printed values and an
  honest axis, so a flat run looks flat instead of dramatic
- Month calendar of every session
- **Leetify checkpoints** at base / week 4 / 8 / 12, with your bracket's average alongside
  — entirely optional, and the averages say when they are Premier-derived rather than
  native to your platform
- **Death audit** — tag each death by cause and Lockin names your biggest leak
- **Leak of the week** — the cause costing you most, with its real share ("70% of the
  deaths you logged this week — 7 of 10")
- **Aim is not the bottleneck** — if you said aim but your deaths say position, it says so,
  using the audit's own rows and no number of its own. Silent when the data agrees with you.
- **Leaks closed** — the share of your deaths a cause took last month against the month
  before, so logging more deaths can never look like progress
- **Proof for a sceptic** — every row names its source, and the sources are honest: the
  checkpoint figures are ones *you* entered from Leetify, not something Lockin measured.
  It states what it does *not* prove — your rank — because understating it is what makes
  it usable in an argument.
- **The honest export** — the same progress written as prose you can paste into Discord.
  A backup file is only useful to the app.
- **A weekly recap** every Monday — days trained against days planned, how it felt, and the
  leak that showed up most. Once a week, and never on a week you didn't play.

**Preps your maps.** For all seven Active Duty maps: what your utility is actually *for*,
what to deny on CT side, and where the crosshair rides on each entry route.

**Your lineups, with pictures.** Save the throws you actually use, in your own words, in
groups you name. Each one takes two screenshots — **where you stand** and **where you
aim** — pasted straight in with Ctrl+V from Steam's F12 or Win+Shift+S. Tap either for a
full-screen look mid-match. A gold button on each map opens that map's page on a lineup
database, so finding one to screenshot is a single tap.

Saved lineups then come back for a quick recall check on a spaced schedule
(1 → 3 → 7 → 14 → 30 days): the card shows the name only, you say the throw out loud, then
reveal and mark it *got it* or *shaky*. Spacing reviews out is well established for
remembering facts; using it for lineups is our own adaptation, and the card says so.

**Gets you the training maps in one click.** A *Get the maps* panel on Maps links
straight to each Workshop item — titles and IDs checked against the live pages, grouped by
purpose, with a *start here* trio marked. On desktop it also shows which ones you already
have, and the links open in your real browser rather than a trapped in-app window.

**Remembers your setup.** Sens, DPI (with eDPI), crosshair code, launch options — so a
reinstall never costs you your muscle memory. On desktop it can read your sensitivity and
launch options straight out of CS2's own config files.

**Works the way you need it to.** Light and dark, both measured rather than eyeballed —
every text colour clears 4.5:1 on every surface it can land on. Full keyboard operation with
a visible focus ring on every control, a skip link past the sidebar, labelled charts, and
motion that stops when your system says it should.

Also: an optional gamertag so it greets you by name, a shareable progress card, full
export/restore, a feedback link that prefills your version, and a desktop build with a
tray icon, a daily "go train" nudge, automatic local backup so a cleared cache can't cost
you your streak, and a yellow banner at the top when a new version is ready — dismissible,
and it never interrupts a session.

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
exact throws are patch-specific, and a lineup that's quietly wrong is worse than none. The
same reasoning is why Lockin ships no lineup images of its own: the good ones belong to the
people who made them. So it links you to them and gives you a place to keep your own
screenshots, which stay on your device.

Aim trainers get the same treatment. The one peer-reviewed study on KovaaK's found it a
*reliable measuring instrument* and explicitly cautioned against reading its scores as
in-game performance — no study has shown transfer to real matches in either direction. So
Lockin will never tell you that grinding a trainer improves your Counter-Strike.

---

## Develop

`docs/index.html` is the single source of truth: one file, inline CSS and JS, no build
step, no dependencies, no CDN. The desktop build bundles it via `frontendDist: ../docs`,
and the standalone copy is generated from it — never hand-edited separately.

```bash
npm run verify   # syntax gate + every test suite, against the real shipped code
npm run check    # syntax gate only
npm test         # the three suites
```

Three suites, **493 tests**, all run in CI on every push:

| File | What it covers |
|---|---|
| `test/lockin.test.js` | 449 unit and content guards against the real `<script>` |
| `test/journey.test.js` | 25 — the whole user journey, quiz to graduation, 92 simulated days |
| `test/a11y.test.js` | 19 — WCAG 2.1 AA: computed contrast, focus, semantics, targets |
| `test/harness.js` | shared: a small DOM plus a boot that runs the real shipped script |

The tests extract the actual `<script>` from `docs/index.html` and run it in a sandboxed
DOM, so they exercise the shipped code rather than a copy of it — including a second sandbox
with `window.__TAURI__` mocked so the desktop-only paths are covered. Several are content
guards rather than logic tests: they fail the build if the copy starts claiming a rifle
needs a dead stop, or that anything makes you *faster*. The Rust side has its own
`cargo test` run in CI, covering the win/loss derivation behind auto-tracking, the shape of
the CS2 config it writes, and the token validation that guards it.

**The journey suite drives the real UI**, not the exports: it clicks the actual eight quiz
option buttons, presses LOCK IT IN, ticks the drills the app renders, and rolls the clock a
day at a time through the whole twelve weeks. It exists because the defects that hurt most
were never wrong functions — they were correct functions wired up wrong, which no unit test
can see.

**Contrast is computed, never assumed.** `getComputedStyle` returns raw `oklch()` strings,
so the a11y suite converts oklch → oklab → linear sRGB → relative luminance itself and
composites alpha over its real backdrop. Measuring it any other way is how a palette ships
at 1.6:1 with a green test.

**Guards are falsified before they're trusted.** A test that stays green when you
reintroduce its own bug is decoration, and this codebase has shipped several — a check
satisfied by the function's own declaration, a type-floor scan that skipped the first rule
inside every media query. New guards are proven by breaking the thing they watch.

Lineup pictures are the one thing **not** in `localStorage` — they live in IndexedDB.
`localStorage` is a ~5MB budget shared across the whole origin, and filling it with
screenshots would cost someone their plan and streak; the picture layer keeps only an id in
the main state. Backups carry the images explicitly and strip them back out to IndexedDB on
restore, so they can never leak into `localStorage` by the back door.

Drills are built by `D(...)`, a positional constructor shared by 52 call sites. **Add new
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

### Screenshots

The four images at the top live in `docs/shots/` and are **not** generated — they are real
captures of a real install, because a mockup in a README is a promise the app has to keep.
To refresh them, run the app with a few weeks of history and capture:

| File | Screen | Take it when |
|---|---|---|
| `today.png` | Today | mid-programme, drills partly ticked, streak visible |
| `progress.png` | Progress | after enough sessions that the charts and a leak have something to say |
| `plan.png` | Practice → Plan | any time — it shows the twelve weeks and the keystone |
| `session.png` | a running guided session | mid-drill, so the timer and the drill card are both live |

Landscape, dark theme, no personal identifiers in view — crop out the gamertag if you set
one.

## Release

Bump the version in **all six**: `package.json`, `src-tauri/tauri.conf.json`,
`src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` (the `name = "lockin"` entry), `VERSION` in
`docs/index.html`, and `CACHE` in `docs/service-worker.js` (kept equal to the version). Add
an entry to `WHATSNEW` in `docs/index.html` — without one the release lands silently for
everyone updating. Then tag `vX.Y.Z` and push.

CI refuses to build unless every one of those six agrees with the tag, then runs the
frontend gate before touching Rust — so a syntax-broken or mislabelled release can't ship.
`Cargo.lock` is checked too: `cargo test --locked` refuses to run when it disagrees with
`Cargo.toml`, and catching that in the version gate turns a confusing mid-release failure
into an obvious one.

Three workflows:

- **`ci.yml`** — every push and PR to `main`. Frontend gate plus `cargo test --locked`.
  Publishes nothing. This is what tells you the Rust still compiles, and it exists because
  for a long time the only thing that compiled it was a release.
- **`desktop.yml`** — `v*` tags only. The same gates, then builds and publishes the signed
  installer.
- **`lockfile.yml`** — manual dispatch. Regenerates `src-tauri/Cargo.lock` on a runner, for
  when you need a fresh one without a local Rust toolchain.

Updates are signed with a minisign keypair (free and self-generated — not a code-signing
certificate). The public half lives in `tauri.conf.json`; the private half is the
`TAURI_SIGNING_PRIVATE_KEY` repo secret. Tauri won't install an update it can't verify
against that pubkey.

## License

[MIT](LICENSE).
