/* Generate a Lockin backup file for taking README screenshots.
 *
 * WHAT THIS IS FOR. Screenshots need a populated app, and a real install either has thin
 * data or someone's actual gamertag and performance in it. This produces a plausible
 * mid-programme state you can import into a THROWAWAY profile, photograph, and discard.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It seeds no Leetify checkpoints and no dramatic
 * before/after. A screenshot is allowed to show what the app LOOKS LIKE; it is not allowed
 * to imply what the app DID FOR YOU. Lockin's whole position is that it doesn't claim
 * outcomes it can't evidence, and a staged "aim 62 -> 78" in a README would be exactly that
 * claim, made in the one format nobody reads sceptically.
 *
 * The numbers here are ordinary on purpose: a real streak with a real gap in it, hand feel
 * that wobbles, a dominant leak that is dominant but not cartoonish.
 *
 *   node scripts/make-demo-seed.js [outfile]     (default: demo-seed.json)
 */
const fs = require('fs');
const path = require('path');
const { bootApp } = require('../test/harness.js');

const OUT = process.argv[2] || 'demo-seed.json';

// "Today" for the seed. Anchored to a Wednesday so Today lands on a training day and the
// screenshot shows drills rather than a rest card.
const NOW = new Date();
NOW.setHours(19, 20, 0, 0);
while (NOW.getDay() !== 3) NOW.setDate(NOW.getDate() - 1);      // back up to Wednesday

const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const minus = (n) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return d; };

// A real plan from the real generator — never a hand-written object, or the screenshot
// shows a shape the app cannot actually produce.
const boot = bootApp(null, NOW);
const plan = boot.X.generatePlan({
  rank: 'mid', weapon: 'rifle', role: 'entry',
  weak: ['cstrafe', 'positioning'], time: '30', days: '4', goal: 'consistency',
});
const START = 30;                                   // day 30 => week 5: past the week-4 review
plan.created = key(minus(START));
plan.startedOn = plan.created;

const state = {
  plan,
  sessions: {}, reviews: {}, metrics: {}, lineups: {},
  planReviews: {}, debriefs: {}, matches: {}, offPlan: {},
  // A recent export, purely so the "KEEP YOUR STREAK SAFE" nudge stays off Today. It fires
  // on the web build at 8+ sessions when you have never exported, and it is the right card
  // for a real user and the wrong one for a screenshot — it is a nag, not a feature.
  settings: { lastExport: key(minus(3)) },
};

/* ---- sessions: train the training days, with ONE honest gap ---- */
// A perfect 30/30 is not what use looks like, and a streak that has survived a real miss is
// a better advert for the freeze mechanic than one that never needed it.
const MISSED = [11];                                // a single missed training day, ~11 days ago
const FEELS = [4, 3, 5, 4, 4, 3, 5, 4, 5, 3, 4, 4, 5, 4, 3, 4, 5, 4, 4, 5];
let fi = 0;
for (let i = START; i >= 0; i--) {
  const d = minus(i);
  if (!boot.X.isTrainingDay(plan, d)) continue;
  if (MISSED.indexOf(i) >= 0) continue;
  const done = {};
  const F = boot.X.FOCI[plan.weekly[d.getDay()]];
  if (F && F.drills) F.drills.forEach((_, ix) => { done[ix] = true; });
  // today is deliberately HALF done — a finished list reads as "nothing to do here"
  if (i === 0) { Object.keys(done).forEach((k2, ix) => { if (ix >= 2) delete done[k2]; }); }
  state.sessions[key(d)] = { warm: i !== 0, deep: false, feel: FEELS[fi++ % FEELS.length], drills: done };
}

/* ---- death audit: enough for leak-of-the-week, with a believable spread ---- */
// leakOfWeek needs >= 5 in the last 7 days. Positioning leads, but aim and utility are
// present too — a single cause at 90% would look staged, and would not be worth acting on.
const WEEKLY = [
  { pos: 3, aim: 2, util: 1, trade: 1, info: 0 },     // this week (>= 5 total)
  { pos: 4, aim: 2, util: 1, trade: 1, info: 1 },
  { pos: 3, aim: 3, util: 2, trade: 0, info: 1 },
  { pos: 4, aim: 2, util: 1, trade: 2, info: 0 },
];
WEEKLY.forEach((row, w) => {
  const d = minus(w * 7 + 1);
  state.reviews[key(d)] = row;
});

/* ---- a couple of lineups, named the way a person names them ---- */
const MAPS = boot.X.MAPS;
state.lineups[MAPS[0].id] = [
  { n: 'A ramp smoke', t: 'Stand in the corner of T spawn, line the crosshair on the left edge of the antenna, jumpthrow.', g: 'Executes' },
  { n: 'Window molly', t: 'From T ramp, aim at the top-right of the arch and left-click.', g: 'Executes' },
];

/* ---- what is deliberately absent ---- */
// metrics{}       — the Leetify checkpoints are USER-ENTERED. Seeding them would put a
//                   fabricated improvement curve in a screenshot, which is the one thing
//                   this app refuses to do anywhere else.
// settings.tag    — no gamertag, so there is nothing to crop and nothing to mistake for
//                   a real person's account.
// rounds[]        — the automatic death audit has never been verified against a real
//                   match. It does not go in a README until it has been.

/* ---- prove the app actually accepts and renders it ---- */
const app = bootApp(state, NOW);
const checks = [];
function check(name, cond, detail) { checks.push({ name, ok: !!cond, detail: detail || '' }); }

check('validBackup accepts the file', app.X.validBackup(state));
check('boots to Today, not the quiz', app.screen().length > 500 && /TODAY/.test(app.screen()));
const streak = app.X.curStreak(app.state());
const wk = app.X.planWeek(app.state(), NOW);
check('lands in week 5 (past the week-4 review)', wk === 5, 'week ' + wk);
check('has a streak worth showing', streak >= 7, streak + ' days');
check('today is a training day with drills on screen', app.find('[data-drill]').length > 0,
      app.find('[data-drill]').length + ' drills');
check('today is PART done, not finished', (function () {
  const rows = app.find('[data-drill]');
  const done = rows.filter((r) => r.getAttribute('aria-pressed') === 'true').length;
  return done > 0 && done < rows.length;
})());
// NOTE the signatures. leakOfWeek's second argument is a MINIMUM TOTAL, not a date, and
// weekCounts' is a NUMBER OF WEEKS — passing a Date to either coerces it to a ~1.7-trillion
// millisecond timestamp, which silently returns null in one and spins forever in the other.
const leak = app.X.leakOfWeek(app.state());
check('leak of the week has something to say', !!leak, leak ? leak.label + ' ' + leak.pct + '%' : 'none');
const review = app.X.planReview(app.state(), NOW);
check('the week-4 block review is offered', !!review && review.n === 4, review ? 'block ' + review.n : 'none');
const weeks = app.X.weekCounts(app.state(), 6);
check('charts have enough points to draw', weeks.filter((n) => n > 0).length >= 2, weeks.join(','));
check('no Leetify checkpoints were seeded', Object.keys(state.metrics).length === 0);
check('no gamertag', !state.settings.tag);
check('the backup nudge stays off Today', !/KEEP YOUR STREAK SAFE/.test(app.screen()));
check('no update banner in frame', !/UPDATE NOW|UPDATING/.test(app.screen()));
check('no auto-audit rounds', !state.rounds);

console.log('\nseed check:');
let bad = 0;
checks.forEach((c) => { if (!c.ok) bad++; console.log('  ' + (c.ok ? 'ok  ' : 'XX  ') + c.name + (c.detail ? '   (' + c.detail + ')' : '')); });

if (bad) { console.error('\n' + bad + ' check(s) failed — not writing ' + OUT); process.exit(1); }

fs.writeFileSync(OUT, JSON.stringify(state, null, 1));
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('\nwrote ' + OUT + '  (' + kb + ' KB)');
console.log('week ' + wk + ', ' + streak + '-day streak, ' + Object.keys(state.sessions).length + ' sessions, leak = ' +
            (leak ? leak.label + ' at ' + leak.pct + '%' : '—'));
console.log('\nImport it into a THROWAWAY profile, not your own install:');
console.log('  1. open https://jacquesvn.github.io/lockin/ in a browser profile you do not use');
console.log('  2. Setup -> Import, choose this file');
console.log('  3. take the shots, then close the profile — nothing of yours was touched');
