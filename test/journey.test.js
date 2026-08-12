/* Lockin — the journey test.
 *
 * WHY THIS EXISTS. lockin.test.js has 438 assertions and every one of them is a unit check or
 * a source-shape guard. Of its 362 ok() blocks, exactly ONE touches "build a plan, write a
 * session, read a streak" together. So the path every single user takes — quiz, plan, first
 * training day, streak, week-4 review — was verified only by a human clicking through it.
 *
 * That is the blind spot the v0.47 audit kept falling into. The bugs that hurt most were not
 * wrong functions; they were correct functions wired up wrong: DO THE TEN bound to one of
 * three buttons, the More sheet's handlers overwritten by a later render, focus thrown onto
 * END SESSION after every press. A unit test cannot see any of those, because nothing is
 * wrong with the units.
 *
 * So this drives the REAL inline <script> — unmodified, exactly as shipped — through a DOM
 * small enough to be obviously correct: answer the eight quiz questions by clicking the
 * actual option buttons, press LOCK IT IN, tick the drills the app renders, roll the clock
 * forward a day at a time, and assert what the user would see.
 *
 * ANTI-HOLLOW RULES, because a test harness that quietly finds nothing is worse than no test:
 *   - an unsupported selector THROWS instead of returning [] (see matches())
 *   - clicking requires a handler to be present; clickOne throws if the element or its
 *     onclick is missing, so "the button was dead" fails here rather than passing silently
 *   - every phase asserts the state actually MOVED, not merely that nothing threw
 */
const { bootApp } = require("./harness.js");

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("  ok  " + name); }
  else { fail++; console.log("FAIL  " + name); }
}

console.log('\n— the journey: a new user, from the quiz to week four —\n');

/* ================================================================ PHASE 1 ========
 * A fresh install shows the quiz, not the app.
 */
const MONDAY = new Date(2026, 0, 5, 10, 0, 0);   // Mon 5 Jan 2026
let app = bootApp(null, MONDAY);

ok('a fresh install opens onboarding, not an empty Today', (function () {
  const ob = app.onboard();
  return ob.length > 200 && /LOCK/.test(ob) && app.screen().length === 0;
})());

/* ================================================================ PHASE 2 ========
 * Drive the real eight-question quiz by clicking the real option buttons.
 */
const ANSWERS = [
  ['platform', 'premier'], ['rank', 'mid'], ['weapon', 'rifle'], ['role', 'entry'],
  ['weak', 'cstrafe'], ['time', '30'], ['days', '4'], ['goal', 'consistency'],
];

let answered = 0, missingOption = null;
try {
  app.clickId('beginBtn');            // WELCOME -> question 1
} catch (e) { /* some builds open straight on q1 */ }

for (let q = 0; q < ANSWERS.length; q++) {
  const opts = app.find('.opt');
  if (!opts.length) { missingOption = 'no .opt buttons at question ' + (q + 1); break; }
  // pick the option carrying the value we want, else the first — the quiz must accept either
  const want = ANSWERS[q][1];
  let idx = opts.findIndex((o) => o.getAttribute('data-v') === want);
  if (idx < 0) idx = 0;
  try { app.clickOne('.opt', idx); } catch (e) { missingOption = e.message; break; }
  answered++;
  try { app.clickId('nextB'); } catch (e) { missingOption = 'NEXT dead at q' + (q + 1) + ': ' + e.message; break; }
}
app.flush();                          // the plan is generated inside a setTimeout

ok('all eight questions accept an answer and NEXT is live on every one', (function () {
  if (missingOption) console.log('      ' + missingOption);
  return answered === 8 && !missingOption;
})());

ok('LOCK IT IN produces a real plan and saves it', (function () {
  const st = app.state();
  if (!st || !st.plan) { console.log('      no plan was written to storage'); return false; }
  const p = st.plan;
  return !!p.keystone && !!p.weekly && Array.isArray(p.targets) && p.targets.length > 0 &&
         Array.isArray(p.phases) && p.phases.length > 0 && !!p.created && !!p.startedOn;
})());

ok('the plan reflects the answers given, not a default', (function () {
  const st = app.state();
  if (!st || !st.plan) return false;              // reported by the assertion above; don't throw here
  const p = st.plan, prof = p.profile || {};
  return prof.days === '4' && prof.time === '30' && prof.weapon === 'rifle' &&
         !!p.weekly && Object.keys(p.weekly).length === 7;
})());

/* ================================================================ PHASE 3 ========
 * Reboot into the app proper and train the first day through the rendered UI.
 */
const built = app.state();
// Every phase below depends on a plan existing. Without this the first null dereference
// throws a stack trace instead of a named failure — and a broken quiz is precisely when
// you need to read the output, not decode it.
if (!built || !built.plan) {
  ok('the quiz produced a plan the rest of the journey can run on', false);
  console.log('\n  no plan was built, so phases 3-7 cannot run.');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(1);
}
app = bootApp(built, MONDAY);

ok('with a plan saved, the app boots to Today instead of the quiz', (function () {
  return app.screen().length > 500 && /TODAY/.test(app.screen());
})());

const drillsOnScreen = app.find('[data-drill]').length;
ok('Today renders the day\'s drills as tickable rows', drillsOnScreen > 0);

ok('ticking every drill marks the day trained — and each row has a live handler', (function () {
  for (let i = 0; i < drillsOnScreen; i++) {
    const rows = app.find('[data-drill]');
    if (!rows.length) return false;
    // re-query each time: toggleDrill re-renders, so the old nodes are gone
    const next = rows.find((r) => r.getAttribute('aria-pressed') !== 'true');
    if (!next) break;
    try { next.onclick ? next.onclick({ target: next, preventDefault() {} }) : (() => { throw new Error('dead drill row'); })(); }
    catch (e) { console.log('      ' + e.message); return false; }
  }
  const st = app.state();
  const day = st.sessions[app.X.dateKey(new Date(app.clock.getTime()))];
  return !!(day && day.warm);
})());

ok('one trained day is a one-day streak', app.X.curStreak(app.state()) === 1);

/* ================================================================ PHASE 4 ========
 * Roll the clock. Train every training day for four weeks and watch the app keep up.
 */
function trainToday() {
  const rows = app.find('[data-drill]');
  let guard = 40;
  while (guard-- > 0) {
    const list = app.find('[data-drill]');
    const next = list.find((r) => r.getAttribute('aria-pressed') !== 'true');
    if (!next || !next.onclick) break;
    next.onclick({ target: next, preventDefault() {} });
  }
  return rows.length > 0;
}

let trainedDays = 1, restDays = 0, renderFailures = 0;
let deloadOnTrainingDay = false, reviewOfferedEarly = false;
const deloadWeeks = new Set();                    // raw weeks where the app said "deload"
const plan = app.state().plan;

function dayStep() {
  app.addDays(1);
  app = bootApp(app.state(), app.clock);          // a new day, app reopened
  const now = new Date(app.clock.getTime());
  if (!app.screen().length) { renderFailures++; return; }
  const wk = app.X.planWeek(app.state(), now);
  const raw = app.X.planWeekRaw(app.state(), now);
  const training = app.X.isTrainingDay(plan, now);
  if (app.X.isDeloadWeek(app.state(), now)) deloadWeeks.add(raw);
  if (wk === 4 && training && /DELOAD WEEK/.test(app.screen())) deloadOnTrainingDay = true;
  if (wk < 5 && app.X.planReview(app.state(), now)) reviewOfferedEarly = true;
  if (training) { if (trainToday()) trainedDays++; } else restDays++;
}

for (let d = 1; d < 28; d++) dayStep();

ok('four weeks of use never fails to render a day', renderFailures === 0);
ok('rest days exist and are not trainable', restDays > 0);

// The app's core promise is that a rest day is not a missed day. With a 4-day plan across
// four weeks there are more rest days than training days, so if rest broke the streak this
// would read 1-4 rather than matching the days actually trained.
ok('rest days do not break the streak — it equals the days actually trained', (function () {
  const s = app.X.curStreak(app.state());
  console.log('      trained ' + trainedDays + ', rested ' + restDays + ', streak = ' + s);
  return s === trainedDays && s >= 14;
})());

ok('the programme clock reached week 4', (function () {
  return app.X.planWeek(app.state(), new Date(app.clock.getTime())) === 4;
})());

ok('week 4 is a deload and Today says so on the days you train', (function () {
  const st = app.state();
  return app.X.isDeloadWeek(st, new Date(app.clock.getTime())) === true && deloadOnTrainingDay;
})());

/* The week-4 review is deliberately NOT offered during week 4 — you review a block after
 * finishing it (`wk>=5&&wk<9`). Pinning both halves of that rule is the point: offering it
 * early would be as wrong as never offering it. */
ok('the block review is withheld until the block is finished', !reviewOfferedEarly);

let reviewAt = null;
for (let d = 0; d < 7 && !reviewAt; d++) {
  dayStep();
  reviewAt = app.X.planReview(app.state(), new Date(app.clock.getTime()));
}

ok('crossing into week 5 offers the week-4 review, built from real logged days', (function () {
  if (!reviewAt) { console.log('      no review offered anywhere in week 5'); return false; }
  console.log('      block ' + reviewAt.n + ' (weeks ' + reviewAt.weeks + '): ' +
              reviewAt.trained + '/' + reviewAt.planned + ' trained, thin=' + reviewAt.thin);
  return reviewAt.n === 4 && reviewAt.weeks === '1–4' && reviewAt.next === '5–8' &&
         reviewAt.planned > 0 && reviewAt.trained > 0 && reviewAt.trained <= reviewAt.planned &&
         // 16 trained days is well past the 5 the review needs to draw any conclusion, so a
         // "thin" verdict here would mean the block window is reading the wrong days
         reviewAt.thin === false;
})());

ok('the record and the milestones moved with the streak', (function () {
  const st = app.state();
  const best = app.X.bestStreak(st);
  const ach = app.X.achState(st);
  const fortnight = ach.filter((a) => a.id === 'fortnight')[0];
  const thirty = ach.filter((a) => a.id === 'streak30')[0];
  const grad = ach.filter((a) => a.id === 'graduate')[0];
  return best === app.X.curStreak(st) && best >= 14 &&
         fortnight && fortnight.earned === true &&      // 14 days: reached
         thirty && thirty.earned === false &&           // 30 days: not yet, and not claimed
         grad && grad.cur === 5;                        // the programme clock agrees
})());

/* ================================================================ PHASE 5 ========
 * Run the programme out. Lockin sells twelve weeks and nothing tested what happens when
 * they end — which is exactly where the "every week past 12 is a permanent deload" bug
 * lived, undetected, for as long as the deload has existed.
 */
const dayOne = new Date(2026, 0, 5);
while (Math.round((app.clock - dayOne) / 86400000) < 92) dayStep();   // into week 14

ok('twelve weeks of daily use never fails to render', renderFailures === 0);

ok('the deload lands on weeks 4, 8 and 12 — and stops there', (function () {
  const got = Array.from(deloadWeeks).sort((a, b) => a - b);
  console.log('      deload weeks observed: ' + (got.join(', ') || 'none'));
  return got.join(',') === '4,8,12';
})());

ok('past the end the full session comes back, not a permanently halved one', (function () {
  const st = app.state();
  const now = new Date(app.clock.getTime());
  const F = app.X.FOCI[st.plan.keystone];
  const full = app.X.focusMins(F, st.plan, false), light = app.X.focusMins(F, st.plan, true);
  return app.X.planWeekRaw(st, now) > 12 && app.X.isDeloadWeek(st, now) === false &&
         app.X.deloadCard(st, F, st.plan, now) === '' && full > light;
})());

ok('finishing twelve weeks is acknowledged, not silently passed', (function () {
  const st = app.state();
  const now = new Date(app.clock.getTime());
  const card = app.X.graduateCard(st, now);
  const grad = app.X.achState(st).filter((a) => a.id === 'graduate')[0];
  return grad && grad.earned === true && card.indexOf('Twelve weeks') >= 0 &&
         /WHEN TO STOP/.test(app.screen());
})());

ok('both block reviews were offered across the programme', (function () {
  // week-4 review in weeks 5-8, week-8 review from week 9 — neither may be skipped
  const st = app.state();
  const r = app.X.planReview(st, new Date(app.clock.getTime()));
  return !!r && r.n === 8 && r.weeks === '5–8';
})());

/* ================================================================ PHASE 6 ========
 * Starting over. "Erase all data" is the one irreversible button in the app, and the whole
 * round trip — navigate to Setup, press it, land back on the quiz with nothing left — was
 * untested. render()'s own `if(!st.plan) renderOnboard()` guard is only ever reached this
 * way; the fresh-install path calls renderOnboard() directly and never touches it.
 */
ok('you can navigate to Setup from Today', (function () {
  app.clickOne('[data-go="setup"]');
  return /ERASE|Erase|DANGER|erase/.test(app.screen()) || app.find('[data-act="reset"]').length > 0;
})());

ok('erase wipes the state and puts you back at the quiz, not a broken screen', (function () {
  const before = app.state();
  if (!before || !before.plan) { console.log('      no plan to erase'); return false; }
  try { app.clickOne('[data-act="reset"]'); } catch (e) { console.log('      ' + e.message); return false; }
  app.flush();
  const after = app.state();
  const backToQuiz = app.onboard().length > 200 && !!app.doc.getElementById('beginBtn');
  if (!backToQuiz) console.log('      onboard length ' + app.onboard().length + ', screen ' + app.screen().length);
  return after === null && backToQuiz;
})());

/* ================================================================ PHASE 7 ========
 * A state written by an old build must survive the upgrade. Nothing else tests this, and
 * the 1.0 boundary is exactly where early users hit it.
 */
ok('a pre-migration state from an old build loads and is normalised', (function () {
  const old = {
    // no _m marker at all: this is what a v0.1x install looks like on disk
    plan: { keystone: 'cstrafe', keystoneName: 'Counter-strafing', created: '2025-11-03',
            weekly: { 0: 'rest', 1: 'cstrafe', 2: 'spray', 3: 'cstrafe', 4: 'utility', 5: 'match', 6: 'match' },
            diagnosis: 'Your <b>counter-strafing</b> is the leak.',
            targets: [{ n: 'Counter-strafe accuracy', v: 60 }], phases: [{ n: 'Base', w: 4 }], used: ['cstrafe'], profile: {} },
    sessions: { '2025-11-03': { warm: true, feel: 9 } },     // old 1-10 feel scale
    settings: { theme: 'auto' },                              // a theme value that was retired
    metrics: { m0: 71 },                                      // metrics keyed by array position
    reviews: {}, lineups: {}, planReviews: {}, debriefs: {}, matches: {}, offPlan: {},
  };
  const fresh = bootApp(old, new Date(2026, 0, 5, 10, 0, 0));
  const st = fresh.state() || old;
  const migrated = fresh.X.dateKey ? st : null;
  if (!migrated) return false;
  const feelOk = st.sessions['2025-11-03'].feel <= 5;                    // rescaled, not left at 9
  const themeOk = st.settings.theme === undefined;                       // retired value dropped
  const diagOk = st.plan.diagnosis.indexOf('<b>') < 0 &&
                 st.plan.diagnosis.indexOf('[[b]]') >= 0;                // tags -> safe markers
  const metricOk = st.metrics.m0 === undefined &&
                   st.metrics[fresh.X.tkey('Counter-strafe accuracy')] === 71;   // re-keyed by name
  const rendered = fresh.screen().length > 500;                          // and the app still opens
  if (!(feelOk && themeOk && diagOk && metricOk && rendered))
    console.log('      feel=' + feelOk + ' theme=' + themeOk + ' diag=' + diagOk + ' metric=' + metricOk + ' render=' + rendered);
  return feelOk && themeOk && diagOk && metricOk && rendered;
})());

ok('migration is idempotent — a second boot does not re-scale anything', (function () {
  const once = bootApp({
    plan: null, sessions: { '2025-11-03': { warm: true, feel: 9 } },
    settings: {}, metrics: {}, reviews: {}, lineups: {}, planReviews: {}, debriefs: {}, matches: {}, offPlan: {},
  }, new Date(2026, 0, 5, 10, 0, 0));
  const after1 = once.state().sessions['2025-11-03'].feel;
  const twice = bootApp(once.state(), new Date(2026, 0, 5, 10, 0, 0));
  const after2 = twice.state().sessions['2025-11-03'].feel;
  return after1 === after2 && after1 <= 5;
})());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
