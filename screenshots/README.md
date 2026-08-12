# Screenshots

The images the root README uses. They live here rather than in `docs/` on purpose:
`tauri.conf.json` sets `frontendDist: ../docs`, so everything in that folder is copied into
the desktop installer. Putting ~700 KB of screenshots there would grow a 3.2 MB installer by
roughly a fifth, for images the app never loads.

| File | What it shows |
|---|---|
| `today.jpg` | Today — streak, week strip, the weekly recap, what's due |
| `session.jpg` | A running guided session, drill 1 of 4, timer live |
| `progress.jpg` | Milestone track, insights, both charts, the twelve-week heatmap |
| `plan.jpg` | The diagnosis, the three phases, the editable week rotation |
| `match-night.jpg` | The nerves script with its study *and its limits*, then The Gate |
| `milestones.jpg` | All twelve milestones, four earned |
| `quiz.jpg` | Question 2 of 8 |
| `plan-reveal.jpg` | The plan, the moment the quiz ends |
| `share-card.png` | The card the app generates — its own output, not a mockup |

## The rule

A screenshot may show **what the app looks like**. It may never imply **what the app did for
you**. Seeding a populated state to photograph the real UI is ordinary; staging a
before/after that suggests a result is a claim, made in the one format nobody reads
sceptically — and Lockin's whole position is that it doesn't make claims it can't evidence.

That is why the seed below carries **no Leetify checkpoints**: those numbers are typed in by
the player, so a fabricated improvement curve here would be exactly what the app refuses to
do everywhere else. No auto-tracked rounds either — that feature has not been verified
against a real match yet.

These must also never be the design prototype. There were once seven screenshots of
`LOCKIN v3.dc.html` in this project's history; a mockup in a README is a promise the app has
to keep.

## Retaking them

```bash
node scripts/make-demo-seed.js demo-seed.json
```

It builds the plan with the real `generatePlan`, boots the real shipped script against the
result, and refuses to write the file unless fourteen checks pass — including that Today is
*partly* done rather than finished, that the leak card has something to say, and that
neither the backup nudge nor the update banner is in frame.

What it produces: week 5 of 12, an 18-day streak that survived one missed day (so the freeze
mechanic is visible), 19 sessions, hand feel wobbling 3–5, Position leading the death audit
at 43%.

**Import it into a throwaway browser profile, never your own install** — import replaces
state, and a mis-click costs you your real streak:

1. open <https://jacquesvn.github.io/lockin/> in a browser profile you don't use
2. Setup → Import, choose `demo-seed.json`
3. take the shots, then close the profile — nothing of yours was touched

For `session.jpg` start a **full** session from the drill list, not *DO THE TEN* — the quick
one is a single drill, so the progress dots have nothing to show.

## Framing

- Desktop width, sidebar visible. The four hero shots sit in a 2×2 grid, so keep them within
  a few percent of each other — the current set is 1209–1232 px wide.
- Dark theme: it's the default and it's the identity.
- The seed sets no gamertag, so there is nothing to crop.
