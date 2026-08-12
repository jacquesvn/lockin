# Screenshots

The four PNGs the top of the root README points at.

## The rule

A screenshot may show **what the app looks like**. It may never imply **what the app did for
you**. Seeding a populated state to photograph the real UI is ordinary; staging a
before/after that suggests a result is a claim, made in the one format nobody reads
sceptically — and Lockin's entire position is that it doesn't make claims it can't evidence.

That is why `scripts/make-demo-seed.js` deliberately seeds **no Leetify checkpoints**: those
figures are typed in by the player, and a fabricated improvement curve in a README would be
exactly the thing the app refuses to do everywhere else. Same reason there are no
auto-tracked rounds in it — that feature has not been verified against a real match yet.

These must also never be the design prototype. Earlier in this project there were seven
screenshots of `LOCKIN v3.dc.html` floating around; those are a mockup, and a mockup in a
README is a promise the app has to keep.

## Getting a populated app

```bash
node scripts/make-demo-seed.js demo-seed.json
```

It builds the plan with the real `generatePlan`, boots the real shipped script against the
result, and refuses to write the file unless fourteen checks pass — including that Today is
*partly* done rather than finished, that the leak card has something to say, and that
neither the backup nudge nor the update banner is in frame.

What it produces: week 5 of 12, an 18-day streak that survived one missed day (so the freeze
mechanic is visible), 19 sessions, hand feel wobbling between 3 and 5, and Position leading
the death audit at 43%.

**Import it into a throwaway browser profile, never your own install** — import replaces
state, and a mis-click costs you your real streak:

1. open <https://jacquesvn.github.io/lockin/> in a browser profile you don't use
2. Setup → Import, choose `demo-seed.json`
3. take the shots, then close the profile — nothing of yours was touched

## The four shots

| File | Screen | State |
|---|---|---|
| `today.png` | Today | drills partly ticked, streak and week strip visible |
| `progress.png` | Progress | streak number, a chart and the milestone track in one frame |
| `plan.png` | Practice → Plan | the diagnosis, the keystone and the twelve-week phases |
| `session.png` | a running guided session | mid-drill, timer counting |

For `session.png` start a **full** session from the drill list, not *DO THE TEN* — the quick
one is a single drill, so the progress dots have nothing to show.

## Framing

- Desktop width, sidebar visible. READMEs are read on desktop.
- Dark theme — it's the default and it's the identity.
- Landscape, roughly consistent widths, so the 2×2 table doesn't render ragged.
- The seed sets no gamertag, so there is nothing to crop.

Once all four are here, uncomment the image table at the top of the root `README.md`.
