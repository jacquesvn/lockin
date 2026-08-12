// Unit tests for Lockin's shipped logic. These evaluate the REAL inline script from
// docs/index.html in a stubbed DOM sandbox and test its exported functions — so a
// regression in the actual app (not a mirror copy) fails CI.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];

// A Proxy "element" that no-ops any DOM access, so the app's init IIFE can run headless.
function fakeEl() {
  return new Proxy(function () {}, {
    get(_t, p) {
      if (p === 'style') return {};
      if (p === 'classList') return { add() {}, remove() {}, toggle() {}, contains() { return false; } };
      if (p === 'length') return 0;
      if (p === 'innerHTML' || p === 'textContent' || p === 'value') return '';
      return fakeEl();
    },
    set() { return true; },
    apply() { return fakeEl(); },
  });
}
const documentStub = new Proxy({}, {
  get(_t, p) {
    if (p === 'documentElement' || p === 'body') return fakeEl();
    if (p === 'getElementById' || p === 'querySelector') return () => fakeEl();
    if (p === 'querySelectorAll') return () => [];
    if (p === 'createElement') return () => fakeEl();
    if (p === 'addEventListener' || p === 'removeEventListener') return () => {};
    return fakeEl();
  },
});
const sandbox = {
  module: { exports: {} },
  window: { matchMedia: () => ({ matches: false }), addEventListener() {}, __TAURI__: undefined },
  document: documentStub,
  localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } },
  navigator: {},
  location: { protocol: 'file:' },
  setInterval: () => 0, clearInterval() {}, setTimeout: () => 0, clearTimeout() {},
  console,
};
sandbox.window.document = sandbox.document;
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename: 'docs/index.html#script' });

const { generatePlan, computeStreak, richText, validBackup, rawWeek, planWeekRaw, pauseServed,
        dateKey, drillList, FOCI, bestStreak, weekCounts, reviewTotals, barChart, lineChart, heatmap, MAPS,
        leakFocus, applyLeakFocus, focusIsSet, LEAK_DRILL, settingsAudit, XHAIR_DYNAMIC,
        offPlanRecent, offPlanHistory, gearTiles, planShot,
        needsBackup, backupCard, backupAge, whatsNew, newSince, vcmp, VERSION, markVersionSeen, WHATSNEW, BACKUP_MIN_SESSIONS,
        applyGsiRound, roundStats, autoAuditCard, ROUND_CAP, EARLY_MS, AUDIT_MIN_ROUNDS,
        buildTargets, shouldRegisterSW, isTauriOrigin, CALM, PROTOCOLS, trainingDayCount, weekdayCount, isTrainingDay, QUIZ, rankLabel, benchHint, missedYesterday,
        lfyParseId, lfyPct, lfySuggest, lfyProfileUrl, LFY_BENCH, updateBanner, UPD, planReview, applyReview, tkey, lapseInfo, lapseCard, reappraisalCard, practiceCard, WORKSHOP, workshopKit, workshopUrl, deathCard, TOUR, playerTag,
        curStreak, freezeBudget, warmDays, ACHIEVEMENTS, achState, checkAchievements,
        weeklyRecap, recapCard, debriefCard, applyGsiMatch, DESTS, destOf, subTabs,
        dueCard, todayCards, todayStack, leakOfWeek, leakCard, tenList, tenMins, youVsYou,
        STREAK_TIERS, milestoneState, milestoneRail, bestStreakSig, shareSig, autoDebrief, lineupCount, lineupMaps, recallCount,
        streakDetail, pauseInfo, isPausedOn, planWeek, pauseCard, freezeRow, restWeek, restLine,
        quietWeek, tierIdentity, QUIET_DAYS, PAUSE_WEEKS,
        isDeloadWeek, deloadDur, focusMins, deloadCard, whyPanel, whySource,
        bottleneckCard, tiltCard, nightLosses, nightKeys, gateCard, offPlanCard, OFFPLAN,
        adherence, metricMove, driftCheck, driftCard, coachAsk, coachCard, applyCoachAnswer,
        COACH_ANSWERS, drillAdherence, skippedDrill, skippedCard,
        leakHistory, leakHistoryCard, changedSince, changedCard, proofRows, proofCard, honestExport,
        firstWeekCard, graduateCard, altPlans, altCard, adviceCard, statusChip, ST_ROLES,
        LSRS, srsAnswer, dueLineups, lineupIsDue, lineupReviewCard,
        stateForBackup, takeBackupImages, picStrip, IMGS, IMG_PER, imgClear, daysBetween,
        picSlots, picRole, PICROLE } = sandbox.module.exports;

let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n); } }

const KEYS = ['cstrafe','consistency','placement','spray','utility','positioning','movement','clutch','entry','awp','rifle','match','rest'];
function validWeekly(pl) {
  if (pl.weekly[0] !== 'rest' || pl.weekly[5] !== 'match' || pl.weekly[6] !== 'match') return false;
  for (var d = 1; d <= 4; d++) { if (KEYS.indexOf(pl.weekly[d]) < 0) return false; }
  return true;
}
function usesFocus(pl, f) { for (var d = 1; d <= 4; d++) if (pl.weekly[d] === f) return true; return false; }
function trainDays(pl) { var n = 0; for (var d = 1; d <= 4; d++) { if (pl.weekly[d] !== 'rest' && pl.weekly[d] !== 'match') n++; } return n; }

// exports present
ok('exports generatePlan/computeStreak/richText/validBackup', !!(generatePlan && computeStreak && richText && validBackup));

// --- coach brain (keystone selection) ---
var A = generatePlan({ rank:'good', weapon:'awp', role:'entry', weak:['consistency','cstrafe'], time:'10', days:'4', goal:'consistency' });
ok('A keystone = cstrafe (highest priority beats consistency)', A.keystone === 'cstrafe');
ok('A weekly valid', validWeekly(A));
ok('A uses AWP + keystone in week', usesFocus(A, 'awp') && usesFocus(A, 'cstrafe'));
ok('A targets well-formed', A.targets.length >= 2 && A.targets.every(function (t) { return t.n && t.h; }));

var B = generatePlan({ rank:'new', weapon:'rifle', role:'unsure', weak:[], time:'30', days:'2', goal:'rank' });
ok('B keystone defaults to cstrafe (goal=rank)', B.keystone === 'cstrafe');
ok('B weekly valid + uses rifle', validWeekly(B) && usesFocus(B, 'rifle'));
ok('B days parsed = 2', B.days === 2);

var C = generatePlan({ rank:'mid', weapon:'both', role:'igl', weak:['utility','positioning'], time:'45', days:'5', goal:'sense' });
ok('C keystone = utility (higher than positioning)', C.keystone === 'utility');
ok('C weaponFoci = awp & rifle', C.weaponFoci.length === 2 && C.weaponFoci[0] === 'awp' && C.weaponFoci[1] === 'rifle');
ok('C weekly valid', validWeekly(C));

var D = generatePlan({ rank:'high', weapon:'awp', role:'lurk', weak:[], time:'10', days:'4', goal:'consistency' });
ok('D keystone = consistency', D.keystone === 'consistency');
ok('D targets don\'t duplicate consistency', D.targets.filter(function (t) { return /Consistency \(the real goal\)/.test(t.n); }).length === 0);

// rank-aware: high rank de-prioritises counter-strafing (plateaus ~78%)
ok('high [cstrafe,placement] -> placement', generatePlan({ rank:'high', weapon:'rifle', weak:['cstrafe','placement'], time:'30', days:'4', goal:'aim' }).keystone === 'placement');
ok('high [cstrafe] only -> cstrafe (sole weakness)', generatePlan({ rank:'high', weapon:'rifle', weak:['cstrafe'], time:'30', days:'4', goal:'aim' }).keystone === 'cstrafe');
ok('high no-weak goal=rank -> placement', generatePlan({ rank:'high', weapon:'awp', weak:[], time:'10', days:'4', goal:'rank' }).keystone === 'placement');
ok('mid [cstrafe,placement] -> cstrafe (unchanged)', generatePlan({ rank:'mid', weapon:'rifle', weak:['cstrafe','placement'], time:'30', days:'4', goal:'aim' }).keystone === 'cstrafe');

['cstrafe','consistency','placement','spray','utility','positioning','movement','clutch','entry'].forEach(function (w) {
  var P = generatePlan({ rank:'mid', weapon:'rifle', weak:[w], time:'30', days:'4', goal:'aim' });
  ok("weak '" + w + "' -> keystone + valid weekly", P.keystone === w && validWeekly(P));
});

// --- days answer actually shapes the plan (v0.6.2) ---
ok('days=2 -> 2 training weekdays', trainDays(generatePlan({ rank:'mid', weapon:'rifle', weak:[], time:'30', days:'2', goal:'rank' })) === 2);
ok('days=4 -> 4 training weekdays', trainDays(generatePlan({ rank:'mid', weapon:'rifle', weak:[], time:'30', days:'4', goal:'rank' })) === 4);
ok('days=5 -> 4 training weekdays (capped)', trainDays(generatePlan({ rank:'mid', weapon:'rifle', weak:[], time:'30', days:'5', goal:'rank' })) === 4);

// --- security regression: diagnosis is a raw-HTML sink only via richText ---
ok('richText escapes HTML but keeps bold markers',
  richText('<img src=x onerror=alert(1)>[[b]]hi[[/b]]') === '&lt;img src=x onerror=alert(1)&gt;<b>hi</b>');
ok('richText neutralises a hostile <script>',
  richText('[[b]]<script>evil()</script>[[/b]]').indexOf('<script>') < 0);

// --- import validation rejects hostile / malformed backups ---
ok('validBackup rejects non-object', !validBackup(null) && !validBackup('x') && !validBackup([]));
ok('validBackup rejects sessions-not-object', !validBackup({ sessions: 'oops' }));
ok('validBackup rejects plan with unknown weekly focus', !validBackup({ sessions: {}, plan: { weekly: { 1: 'evilkey' }, profile: {}, targets: [] } }));
ok('validBackup accepts a real export', validBackup({ sessions: {}, plan: A }));
ok('validBackup accepts sessions-only (no plan)', validBackup({ sessions: {} }));
ok('validBackup rejects an empty/partial weekly (would throw at render)', !validBackup({ sessions: {}, plan: { weekly: {}, profile: {}, targets: [] } }));

// --- streak core (weekend freebie) ---
function stt(dates) { var s = { sessions: {} }; dates.forEach(function (k) { s.sessions[k] = { warm: true }; }); return s; }
ok('streak 3 Mon-Wed', computeStreak(stt(['2026-07-13','2026-07-14','2026-07-15']), new Date('2026-07-15T00:00:00')) === 3);
ok('weekend gap does not break streak', computeStreak(stt(['2026-07-09','2026-07-13']), new Date('2026-07-13T00:00:00')) === 2);
// v0.6.3: streak is plan-aware — a low-days plan's prescribed rest days must NOT break the streak
var twoDayPlan = { weekly: { 0:'rest', 1:'cstrafe', 2:'awp', 3:'rest', 4:'rest', 5:'match', 6:'match' } };
ok('2-day plan: prescribed rest day does not break streak (regression)',
  computeStreak({ plan: twoDayPlan, sessions: { '2026-07-13': { warm: true }, '2026-07-14': { warm: true } } }, new Date('2026-07-16T00:00:00')) === 2);
ok('2-day plan: missing a training day still breaks streak',
  computeStreak({ plan: twoDayPlan, sessions: { '2026-07-13': { warm: true } } }, new Date('2026-07-15T00:00:00')) === 0);

// --- v0.24: feedback loop (post-match debrief + weekly recap) ---
var everyDayW = { weekly:{0:'cstrafe',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'cstrafe',6:'cstrafe'}, keystone:'cstrafe' };
var NEXT_MON = new Date('2026-08-10T00:00:00');   // a Monday; last week = Aug 3–9
ok('weekly recap rolls up last week and names the most-logged leak', (function () {
  var st = { plan: everyDayW, sessions: { '2026-08-03':{warm:true,feel:4}, '2026-08-04':{warm:true,feel:3}, '2026-08-05':{warm:true,feel:5} },
             reviews: {}, debriefs: { '2026-08-06': { leak:'pos', win:'held angles', mood:'good' } }, settings: {} };
  var rc = weeklyRecap(st, NEXT_MON);
  return rc && rc.trained === 3 && rc.leakTop === 'pos' && rc.feel === 4 && /LAST WEEK/.test(recapCard(st, rc));
})());
ok('weekly recap fires once per week and never on an empty week', (function () {
  var empty = { plan: everyDayW, sessions:{}, reviews:{}, debriefs:{}, settings:{} };
  var already = { plan: everyDayW, sessions:{ '2026-08-04':{warm:true} }, reviews:{}, debriefs:{}, settings:{ lastRecap:'2026-08-10' } };
  return weeklyRecap(empty, NEXT_MON) === null && weeklyRecap(already, NEXT_MON) === null;
})());
ok('recap does not read "X of Y" when you trained more than planned (rest-day training)', (function () {
  var over = recapCard({}, { trained:6, planned:1, feel:4, leakTop:null, thisKey:'x' });
  var under = recapCard({}, { trained:2, planned:4, feel:4, leakTop:null, thisKey:'x' });
  return /trained <b>6<\/b> days last week/.test(over) && /trained <b>2<\/b> of 4 planned/.test(under);
})());
ok('the debrief offers a leak, a win field and a mood', (function () {
  var h = debriefCard({ debriefs: {} }, '2026-08-07');
  return h.indexOf('data-dbleak') >= 0 && h.indexOf('data-dbwin') >= 0 && h.indexOf('data-dbmood') >= 0;
})());
// --- v0.23: streak freeze + milestones ---
var everyDay = { weekly: {0:'cstrafe',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'cstrafe',6:'cstrafe'}, keystone:'cstrafe' };
ok('freeze budget: one per 7 training days, capped at 3', (function () {
  function stN(n){ var s={}; for(var i=0;i<n;i++) s['2026-06-'+String(i+1).padStart(2,'0')]={warm:true}; return { plan: everyDay, sessions: s, settings: {} }; }
  return freezeBudget(stN(6))===0 && freezeBudget(stN(7))===1 && freezeBudget(stN(14))===2 && freezeBudget(stN(40))===3;
})());
ok('a streak freeze bridges a single missed training day (strict streak still breaks)', (function () {
  var s={}; ['2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05','2026-08-06','2026-08-07','2026-08-09','2026-08-10'].forEach(function(d){ s[d]={warm:true}; });
  var st={ plan: everyDay, sessions: s, settings: {} }, now=new Date('2026-08-10T00:00:00');
  return computeStreak(st, now) === 2 && freezeBudget(st) === 1 && curStreak(st, now) === 9;   // bridge over the 08-08 miss
})());
ok('milestones unlock from real state, and the first check never retro-spams', (function () {
  var st={ plan:{ weekly:{0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match'}, keystone:'cstrafe' },
           sessions:{ '2026-06-02':{ warm:true, drills:{0:true} } }, settings:{} };
  var earned0 = achState(st).filter(function(a){return a.earned;}).map(function(a){return a.id;});
  var firstCall = checkAchievements(st);                    // baseline pass — must not celebrate
  return earned0.indexOf('first')>=0 &&                       // one drill ticked -> First Blood
         earned0.indexOf('wk1')<0 &&                          // but four days not trained yet
         firstCall === null && st.settings.seenAch && st.settings.seenAch.first === 1 &&
         ACHIEVEMENTS.length === 12;                          // the spec calls for twelve
})());

// --- the programme clock: rawWeek is the true week, planWeek clamps it for display ---
ok('day 0 = week 1', rawWeek({ created: '2026-07-01' }, new Date('2026-07-01T12:00:00')) === 1);
ok('day 7 = week 2', rawWeek({ created: '2026-07-01' }, new Date('2026-07-08T12:00:00')) === 2);
ok('planWeek clamps to 12, rawWeek does NOT — deload asks the raw one', (function () {
  var st = { plan: { created: '2026-01-01' }, settings: {} }, d = new Date('2026-07-01T12:00:00');
  return planWeek(st, d) === 12 && rawWeek(st.plan, d) === 26 && planWeekRaw(st, d) === 26;
})());

// --- v0.7: insights, death audit, quick-tier drills ---
var hist = stt(['2026-07-13','2026-07-14','2026-07-15','2026-07-06','2026-07-07']); // 3-run and a 2-run
ok('bestStreak finds the longest run', bestStreak(hist) === 3);
ok('bestStreak of empty history is 0', bestStreak({ plan: null, sessions: {} }) === 0);
ok('weekCounts returns N buckets', Array.isArray(weekCounts(hist, 8)) && weekCounts(hist, 8).length === 8);

var rv = { reviews: {} }; rv.reviews[dateKey(new Date())] = { aim: 2, pos: 3 };
var rt = reviewTotals(rv, 30);
ok('reviewTotals aggregates causes', rt.aim === 2 && rt.pos === 3 && rt.util === 0);
ok('reviewTotals ignores days outside the window', reviewTotals({ reviews: { '2020-01-01': { aim: 9 } } }, 30).aim === 0);
ok('reviewTotals is safe with no reviews', reviewTotals({}, 30).aim === 0);


// --- v0.11.1: charts carry their own numbers (testers found the old ones ambiguous) ---
ok('barChart prints a value under every bar', (function () {
  var h = barChart([0, 2, 3]);
  return (h.match(/class="bval/g) || []).length === 3 &&
         h.indexOf('>0<') >= 0 && h.indexOf('>2<') >= 0 && h.indexOf('>3<') >= 0;
})());
ok('barChart is empty with no data', barChart([]) === '' && barChart(null) === '');
ok('all-zero data shows the empty message, not a row of bars', (function () {
  var h = barChart([0, 0, 0], { emptyMsg: 'nothing yet' });
  return h.indexOf('nothing yet') >= 0 && h.indexOf('bfill') < 0;
})());
ok('zero bars render as a baseline, never as a fill', (function () {
  var h = barChart([0, 4]);
  return (h.match(/bzero/g) || []).length === 1 && (h.match(/bfill/g) || []).length === 1;
})());
ok('a fixed scale keeps bar height absolute', (function () {
  // on a 1-5 scale a 4 is 80% tall; auto-scaling would inflate it to full height
  var fixed = barChart([2, 4], { scale: 5 }), auto = barChart([2, 4]);
  return /height:40%/.test(fixed) && /height:80%/.test(fixed) &&
         /height:50%/.test(auto) && /height:100%/.test(auto);
})());
ok('only the most recent bar is highlighted', (function () {
  var h = barChart([1, 2, 3]);
  return (h.match(/bfill now/g) || []).length === 1 && h.lastIndexOf('bfill now') > h.indexOf('bfill');
})());
ok('axis is dropped when it would be wider than the chart', (function () {
  var few = barChart([1, 2], { from: 'a', to: 'b' }), many = barChart([1, 2, 3, 4], { from: 'a', to: 'b' });
  return few.indexOf('baxis') < 0 && many.indexOf('baxis') >= 0;
})());
ok('chart labels are escaped', (function () {
  var h = barChart([1, 2, 3, 4], { label: '<img src=x>', from: '<b>', to: 'y' });
  return h.indexOf('<img src=x>') < 0 && h.indexOf('&lt;img') >= 0;
})());

ok('drillList lite tier is core-only and shorter', (function () {
  var F = FOCI.cstrafe;
  var lite = drillList(F, { profile: { time: '10' } });
  var full = drillList(F, { profile: { time: '30' } });
  return lite.length < full.length && lite.every(function (it) { return it.d.core; });
})());
ok('drillList preserves original drill indices', (function () {
  var lite = drillList(FOCI.cstrafe, { profile: { time: '10' } });
  return lite.every(function (it) { return FOCI.cstrafe.drills[it.i] === it.d; });
})());

// --- v0.10.3: don't scold a brand-new user for days before their plan existed ---
var everyDayPlan = { weekly: { 0:'cstrafe',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'cstrafe',6:'cstrafe' } };
ok('a plan created TODAY never claims you missed yesterday', (function () {
  var st = { plan: Object.assign({ created: '2026-07-21' }, everyDayPlan), sessions: {} };
  return missedYesterday(st, new Date('2026-07-21T12:00:00')) === false;
})());
ok('a plan created yesterday does not scold you for the day before it', (function () {
  var st = { plan: Object.assign({ created: '2026-07-20' }, everyDayPlan), sessions: {} };
  return missedYesterday(st, new Date('2026-07-21T12:00:00')) === false; // yesterday IS the created day
})());
ok('an established user who actually missed yesterday still gets nagged', (function () {
  var st = { plan: Object.assign({ created: '2026-07-01' }, everyDayPlan), sessions: { '2026-07-15': { warm: true } } };
  return missedYesterday(st, new Date('2026-07-21T12:00:00')) === true;
})());
ok('no nag when yesterday was trained', (function () {
  var st = { plan: Object.assign({ created: '2026-07-01' }, everyDayPlan), sessions: { '2026-07-20': { warm: true } } };
  return missedYesterday(st, new Date('2026-07-21T12:00:00')) === false;
})());
ok('no nag when yesterday was a rest or match day', (function () {
  var restWeek = { created: '2026-07-01', weekly: { 0:'rest',1:'rest',2:'rest',3:'rest',4:'rest',5:'rest',6:'match' } };
  return missedYesterday({ plan: restWeek, sessions: {} }, new Date('2026-07-21T12:00:00')) === false;
})());

ok('someone who has never trained is never nagged, however old the plan', (function () {
  var st = { plan: Object.assign({ created: '2026-01-01' }, everyDayPlan), sessions: {} };
  return missedYesterday(st, new Date('2026-07-21T12:00:00')) === false;
})());

// --- v0.10.2: rank language follows the platform the player actually uses ---
ok('quiz asks which platform before asking rank', (function () {
  var ids = QUIZ.map(function (q) { return q.id; });
  return ids.indexOf('platform') >= 0 && ids.indexOf('platform') < ids.indexOf('rank');
})());
ok('rank options adapt to the chosen platform', (function () {
  var rank = QUIZ.filter(function (q) { return q.id === 'rank'; })[0];
  if (typeof rank.opts !== 'function') return false;
  var f = rank.opts({ platform: 'faceit' }), pr = rank.opts({ platform: 'premier' }), es = rank.opts({ platform: 'esea' });
  return /Level 7–8/.test(f[2][1]) && /15–20k/.test(pr[2][1]) && !/k|Level/.test(es[2][1]);
})());
ok('every platform still yields the same four rank VALUES the logic needs', (function () {
  var rank = QUIZ.filter(function (q) { return q.id === 'rank'; })[0];
  return ['premier','faceit','esea','mix','casual',undefined].every(function (pf) {
    var vals = rank.opts({ platform: pf }).map(function (o) { return o[0]; });
    return ['new','mid','good','high','unsure'].every(function (v) { return vals.indexOf(v) >= 0; });
  });
})());
ok('rank label follows platform', rankLabel({ platform:'faceit', rank:'good' }) === 'LEVEL 7–8' &&
   rankLabel({ platform:'premier', rank:'good' }) === '15–20K' &&
   rankLabel({ platform:'esea', rank:'good' }) === 'SOLID');
ok('a pre-platform profile still reads as Premier (what it answered against)',
  rankLabel({ rank:'high' }) === '20K+');
ok('bench hint flags that its numbers are Premier-derived off-platform', (function () {
  var onPrem = benchHint('Counter-strafing %', { rank:'good', platform:'premier' });
  var offPrem = benchHint('Counter-strafing %', { rank:'good', platform:'faceit' });
  return onPrem.indexOf('Premier data') < 0 && offPrem.indexOf('Premier data') >= 0;
})());

// --- v0.10.1: match nights are the user's, not Fri/Sat by assumption ---
var oddWeek = { weekly: { 0:'cstrafe', 1:'match', 2:'awp', 3:'rest', 4:'match', 5:'rest', 6:'cstrafe' } };
ok('trainingDayCount counts the plan\'s training days wherever they fall',
  trainingDayCount(oddWeek) === 3);                                  // Sun, Tue, Sat
ok('trainingDayCount ignores match and rest', trainingDayCount({ weekly: { 0:'match',1:'rest',2:'rest',3:'rest',4:'rest',5:'rest',6:'rest' } }) === 0);
ok('a Sunday training day counts toward the week (was excluded by the Mon-Thu assumption)', (function () {
  // week of Mon 2026-07-13; Sunday is 2026-07-19
  var st = { plan: oddWeek, sessions: { '2026-07-19': { warm: true } } };
  return weekdayCount(st, new Date('2026-07-13T00:00:00')) === 1;
})());
ok('a match night does NOT count toward the training target', (function () {
  var st = { plan: oddWeek, sessions: { '2026-07-13': { warm: true } } };  // Mon = match in oddWeek
  return weekdayCount(st, new Date('2026-07-13T00:00:00')) === 0;
})());
ok('isTrainingDay follows the edited week', (function () {
  var sun = new Date('2026-07-19T12:00:00'), mon = new Date('2026-07-13T12:00:00');
  return isTrainingDay(oddWeek, sun) === true && isTrainingDay(oddWeek, mon) === false;
})());

// --- v0.10: cues, rules, calm reset, coach protocols ---
ok('every training drill carries a cue', (function () {
  var skip = { match: 1, rest: 1 };
  return Object.keys(FOCI).filter(function (k) { return !skip[k]; })
    .every(function (k) { return FOCI[k].drills.every(function (d) { return d.cue && d.cue.length > 3; }); });
})());
ok('drill model keeps cue and rule as strings (never undefined)', Object.keys(FOCI).every(function (k) {
  return FOCI[k].drills.every(function (d) { return typeof d.cue === 'string' && typeof d.rule === 'string'; });
}));
ok('CALM reset exists and is non-core', !!(CALM && CALM.t && CALM.cue && CALM.core === false));
ok('the protocol is well-formed', (function () {
  if (!PROTOCOLS.length) return false;
  var P = PROTOCOLS[0];
  return P.id && P.name && P.by && P.model && P.after && P.blocks.length >= 8 &&
         P.blocks.every(function (b) { return b.t && b.sub && b.m && typeof b.dur === 'number'; });
})());
ok('protocol runs 30-35 min as advertised', (function () {
  var t = 0; PROTOCOLS[0].blocks.forEach(function (b) { t += b.dur || 0; });
  return t >= 30 && t <= 35;
})());
ok('the protocol ends on the calm reset', (function () {
  var b = PROTOCOLS[0].blocks;
  return b[b.length - 1].t === CALM.t;
})());

// --- v0.9.5: never register a service worker in the desktop webview ---
// A stale SW there shadows every future build and survives reinstalls. It trapped the app on v1
// for months. These lock the invariant so it can never regress.
var NAV = { serviceWorker: {} };
ok('SW registers on a normal https web origin',
  shouldRegisterSW(NAV, { protocol: 'https:', hostname: 'jacquesvn.github.io' }, false) === true);
ok('SW never registers when the Tauri bridge is present',
  shouldRegisterSW(NAV, { protocol: 'http:', hostname: 'tauri.localhost' }, true) === false);
ok('SW never registers on the Tauri origin EVEN IF __TAURI__ has not loaded yet (the race)',
  shouldRegisterSW(NAV, { protocol: 'http:', hostname: 'tauri.localhost' }, false) === false);
ok('SW never registers under the tauri: protocol (macOS/linux form)',
  shouldRegisterSW(NAV, { protocol: 'tauri:', hostname: 'localhost' }, false) === false);
ok('SW does not register from file://',
  shouldRegisterSW(NAV, { protocol: 'file:', hostname: '' }, false) === false);
ok('SW does not register where unsupported',
  shouldRegisterSW({}, { protocol: 'https:', hostname: 'example.com' }, false) === false);
ok('isTauriOrigin recognises the desktop origins',
  isTauriOrigin({ hostname: 'tauri.localhost', protocol: 'http:' }) &&
  isTauriOrigin({ hostname: 'x', protocol: 'tauri:' }) &&
  !isTauriOrigin({ hostname: 'jacquesvn.github.io', protocol: 'https:' }));

// --- v0.9.1: movement focus + workshop-map drills ---
ok('movement focus exists with drills', !!(FOCI.movement && FOCI.movement.name && FOCI.movement.drills.length >= 3));
ok('movement keystone builds a plan with a target (buildTargets must not throw)', (function () {
  var P = generatePlan({ rank:'mid', weapon:'rifle', weak:['movement'], time:'30', days:'4', goal:'aim' });
  return P.keystone === 'movement' && P.targets.length >= 2 && P.targets.every(function (t) { return t.n && t.h; });
})());
ok('every FOCI key has a buildTargets entry (no keystone can crash)', (function () {
  return ['cstrafe','consistency','placement','spray','utility','positioning','movement','clutch','entry']
    .every(function (k) { try { return buildTargets(k, ['awp']).length >= 2; } catch (e) { return false; } });
})());
ok('drills now reference the workshop kit', (function () {
  var all = Object.keys(FOCI).map(function (k) {
    return FOCI[k].drills.map(function (d) { return d.where + ' ' + d.sub; }).join(' ');
  }).join(' ');
  // names verified against the live Steam Workshop pages 2026-07-23:
  // "Aim Training CS2Labs" (Jyken) and "CST Labs (BETA6)" (SAZONISCHE) are DIFFERENT maps
  return ['Aim Arena','TRAINING.01','Movement Mirage','Movement Hub','Target Training','CST Labs','CS2Labs','Yprac Hub']
    .every(function (m) { return all.indexOf(m) >= 0; });
})());
// Every one of these was in the app and wrong. The full sweep of the Workshop kit
// (2026-07-23) checked each title against its live page; these are the corrections.
ok('no drill uses a map name that does not exist', (function () {
  var all = Object.keys(FOCI).map(function (k) {
    return FOCI[k].drills.map(function (d) { return d.where + ' ' + d.sub + ' ' + d.why; }).join(' ');
  }).join(' ');
  return [
    'Aim Training Reflex Dots',  // real title is "Aim Reflex Training DOTS" (kEam) — dropped, 53k subs
    'Reflex Dots',               // same map, same problem
    'Training 01',               // real title is "TRAINING.01 — Warmup Map"
    'Yprac Prefire',             // CS:GO-era; the CS2 Hub replaced all per-map Yprac maps
  ].every(function (m) { return all.indexOf(m) < 0; });
})());
// The workshop kit lists map names too, and was never covered — it kept "Reflex Dots"
// and "Yprac Prefire (one per map)" long after the drills would have been corrected.
ok('the workshop kit lists real Workshop titles', (function () {
  var kit = practiceCard();
  var good = ['Aim Botz - Aim Training (CS2)','Recoil Master - Spray Training (CS2)',
              'Aim Arena — Bot Training','Aim Training CS2Labs','TRAINING.01 — Warmup Map',
              'Yprac Hub by Yesber','Movement Hub','Fruit Ninja - Aim Training'];
  var bad  = ['Aim Training Reflex Dots','Yprac Prefire (one per map)','Training 01 '];
  return good.every(function (m) { return kit.indexOf(m) >= 0; })
      && bad.every(function (m) { return kit.indexOf(m) < 0; });
})());

// --- v0.16: one-click "Get the maps" — Workshop links, id verified 2026-07-24 ---
ok('WORKSHOP entries are all well-formed', WORKSHOP.length >= 12 && WORKSHOP.every(function (m) {
  return /^[0-9]+$/.test(m.id) && m.t && m.d && ['aim','pre','mov','fun'].indexOf(m.g) >= 0;
}));
ok('WORKSHOP ids are unique (no accidental duplicate/paste)', (function () {
  var ids = WORKSHOP.map(function (m) { return m.id; });
  return ids.filter(function (v, i) { return ids.indexOf(v) === i; }).length === ids.length;
})());
ok('workshopUrl builds a real Steam Workshop link', workshopUrl('3070244462') ===
  'https://steamcommunity.com/sharedfiles/filedetails/?id=3070244462');
ok('every map renders as a clickable Workshop link in the kit', (function () {
  var kit = workshopKit();
  return WORKSHOP.every(function (m) {
    return kit.indexOf('href="' + workshopUrl(m.id) + '"') >= 0;
  }) && kit.indexOf('target="_blank"') >= 0;
})());
ok('the start-here trio is exactly Aim Botz, TRAINING.01, Yprac Hub', (function () {
  var starters = WORKSHOP.filter(function (m) { return m.s; }).map(function (m) { return m.id; }).sort();
  // 3070244462 aim_botz · 3604696412 TRAINING.01 · 3070715607 Yprac Hub
  return JSON.stringify(starters) === JSON.stringify(['3070244462','3070715607','3604696412']);
})());
// Desktop regression guard: in a Tauri webview a plain <a target="_blank"> opens a
// chrome-less in-app window, so external links MUST be routed to the native opener.
// (The Rust `open_url` command itself is compile-checked by the desktop-build CI job.)
ok('native builds route external links through open_url', (function () {
  var s = script; // the real inline <script>, captured at the top of this file
  return s.indexOf('open_url') >= 0 && /a\[target="_blank"\]/.test(s);
})());
// --- v0.16.2 accessibility guards ---
// Section labels and workshop groups must expose heading semantics so a screen-reader
// user can navigate by heading — they render as styled <div>/<span>, not <h2>/<h3>.
ok('workshop group labels are ARIA headings', (function () {
  var kit = workshopKit();
  // four groups, each a level-3 heading
  return (kit.match(/class="wsgrouph" role="heading" aria-level="3"/g) || []).length >= 3;
})());
ok('section dividers carry heading semantics', /class="ml" role="heading" aria-level="2"/.test(practiceCard()));
// The death-audit leak bar is colour-only, so it must carry a text summary and a legend.
ok('the death-audit leak bar is not colour-only', (function () {
  var st = { plan: null, sessions: {}, settings: {}, metrics: {}, lineups: {}, planReviews: {},
             reviews: {} };
  st.reviews[dateKey(new Date())] = { pos: 3, aim: 1 };
  var card = deathCard(st);
  return /class="leakbar" role="img" aria-label="Deaths by cause/.test(card) &&
         /class="calleg"/.test(card) && card.indexOf('Position 3') >= 0;
})());
ok('counter-strafe drills never send you to Recoil Master', (function () {
  // Recoil Master - Spray Training (CS2) is ghosthair spray-pattern practice only.
  // It has no movement or stop-then-shoot training of any kind.
  return FOCI.cstrafe.drills.every(function (d) {
    return (d.where + ' ' + d.sub).indexOf('Recoil Master') < 0;
  });
})());
ok('every drill still has text, measure and duration', Object.keys(FOCI).every(function (k) {
  return FOCI[k].drills.every(function (d) { return d.t && d.m && typeof d.dur === 'number'; });
}));

// --- v0.8: map prep library (Active Duty pool verified Jul 2026) ---
var MAPIDS = MAPS.map(function (m) { return m.id; });
ok('MAPS covers the 7 Active Duty maps',
  MAPS.length === 7 && ['mirage','dust2','inferno','nuke','ancient','anubis','cache'].every(function (id) { return MAPIDS.indexOf(id) >= 0; }));
ok('MAPS ids are unique', MAPIDS.filter(function (v, i) { return MAPIDS.indexOf(v) === i; }).length === MAPS.length);
ok('every map has T jobs, CT jobs and prefire routes', MAPS.every(function (m) {
  return m.n && Array.isArray(m.t) && m.t.length > 0 && Array.isArray(m.ct) && m.ct.length > 0 &&
         Array.isArray(m.r) && m.r.length > 0 &&
         m.r.every(function (x) { return Array.isArray(x) && x.length === 2 && x[0] && x[1]; });
}));
ok('reserve maps (Train/Overpass/Vertigo) are not in the pool',
  !MAPIDS.some(function (id) { return ['train','overpass','vertigo'].indexOf(id) >= 0; }));
ok('Cache carries its rework caveat', (function () {
  var cache = MAPS.filter(function (m) { return m.id === 'cache'; })[0];
  return !!(cache && cache.note && /rework/i.test(cache.note));
})());

// --- v0.11: optional Leetify read (guidelines: no storing, no rescaling) ---
ok('parses a steam64 out of a pasted profile link',
  (lfyParseId('https://leetify.com/app/player/76561198012345678') || {}).id === '76561198012345678');
ok('parses a bare steam64', (lfyParseId('  76561198012345678 ') || {}).kind === 'steam64');
ok('parses a leetify uuid link',
  (lfyParseId('https://leetify.com/app/profile/3f2504e0-4f89-11d3-9a0c-0305e82c3301') || {}).kind === 'id');
ok('rejects junk', lfyParseId('hello') === null && lfyParseId('') === null && lfyParseId(null) === null);
ok('normalises 0-1 ratios and leaves 0-100 alone',
  lfyPct(0.62) === 62 && lfyPct(73) === 73 && lfyPct(1) === 100 && lfyPct(undefined) === null);

// Shaped like a real response — verified against live profiles Jul 2026.
// Note clutch/opening come back ~0.05 while aim/positioning/utility are 0-100.
var LFY_SAMPLE = {
  steam64_id: '76561198012345678', name: 'tester',
  rating: { aim: 89.4, positioning: 62.5, utility: 73.9, clutch: 0.106, opening: 0.044 },
  stats: { counter_strafing_good_shots_ratio: 77.8, preaim: 10.28, spray_accuracy: 44.2, reaction_time_ms: 640 }
};
ok('suggests the standout-weakest of the three comparable 0-100 scores', (function () {
  var t = lfySuggest(LFY_SAMPLE, { rank: 'mid' }).ticks;   // positioning 62.5 vs aim 89.4
  return t.indexOf('positioning') >= 0 && t.indexOf('utility') < 0;
})());
// REGRESSION: clutch(0.106) and opening(0.044) are on a different scale from the
// 0-100 scores. Ranking them together ticked both for every player alive.
ok('never ranks clutch/opening against the 0-100 scores', (function () {
  var t = lfySuggest(LFY_SAMPLE, { rank: 'mid' }).ticks;
  return t.indexOf('clutch') < 0 && t.indexOf('entry') < 0;
})());
ok('a balanced profile gets no tick at all', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.rating.aim = 74; d.rating.positioning = 71; d.rating.utility = 70;  // gap < 8
  d.stats.counter_strafing_good_shots_ratio = 81; d.stats.preaim = 8.1;
  return lfySuggest(d, { rank: 'mid' }).ticks.length === 0;
})());
ok('flags counter-strafing below the bracket benchmark', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.stats.counter_strafing_good_shots_ratio = 55;          // vs ~73 for mid
  return lfySuggest(d, { rank: 'mid' }).ticks.indexOf('cstrafe') >= 0;
})());
ok('flags crosshair placement worse than the bracket benchmark', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.stats.preaim = 13.2;                                   // vs ~10.5 for mid, higher is worse
  return lfySuggest(d, { rank: 'mid' }).ticks.indexOf('placement') >= 0;
})());
ok('mechanics that beat the benchmark are left alone', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.stats.counter_strafing_good_shots_ratio = 81; d.stats.preaim = 8.1;
  var t = lfySuggest(d, { rank: 'mid' }).ticks;
  return t.indexOf('cstrafe') < 0 && t.indexOf('placement') < 0;
})());
ok('mechanics are judged independently of the aim score', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.rating.aim = 98;                                       // great aim overall...
  d.stats.counter_strafing_good_shots_ratio = 55;          // ...but still moving when shooting
  return lfySuggest(d, { rank: 'mid' }).ticks.indexOf('cstrafe') >= 0;
})());
ok('benchmarks follow the player bracket, not a fixed number', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.stats.counter_strafing_good_shots_ratio = 68;          // under mid(73), over new(62)
  return lfySuggest(d, { rank: 'mid' }).ticks.indexOf('cstrafe') >= 0 &&
         lfySuggest(d, { rank: 'new' }).ticks.indexOf('cstrafe') < 0;
})());
ok('never suggests consistency or movement (no API signal for either)', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.rating.positioning = 10; d.stats.counter_strafing_good_shots_ratio = 20; d.stats.preaim = 20;
  var t = lfySuggest(d, { rank: 'mid' }).ticks;
  return t.indexOf('consistency') < 0 && t.indexOf('movement') < 0;
})());
ok('every suggested tick is a real quiz option', (function () {
  var weak = QUIZ.filter(function (q) { return q.id === 'weak'; })[0];
  var valid = weak.opts.map(function (o) { return o[0]; });
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.rating.positioning = 10; d.stats.counter_strafing_good_shots_ratio = 20; d.stats.preaim = 20;
  var r = lfySuggest(d, { rank: 'mid' });
  return r.ticks.length > 0 && r.ticks.every(function (t) { return valid.indexOf(t) >= 0; });
})());
ok('every suggestion carries a reason the user can read', (function () {
  var d = JSON.parse(JSON.stringify(LFY_SAMPLE));
  d.rating.positioning = 30; d.stats.preaim = 14;
  var r = lfySuggest(d, { rank: 'mid' });
  return r.ticks.length > 0 && r.ticks.every(function (t) { return typeof r.why[t] === 'string' && r.why[t].length > 10; });
})());
ok('survives an empty or partial payload', (function () {
  return lfySuggest(null, {}).ticks.length === 0 &&
         lfySuggest({}, {}).ticks.length === 0 &&
         lfySuggest({ rating: { aim: 50 } }, { rank: 'mid' }).ticks.length === 0;
})());
ok('benchmark table matches the numbers benchHint already shows', (function () {
  return /~73%/.test(benchHint('Counter-strafing %', { rank: 'mid' })) && LFY_BENCH.cstrafe.mid === 73 &&
         /~10\.5/.test(benchHint('Crosshair placement (°)', { rank: 'mid' })) && LFY_BENCH.placement.mid === 10.5;
})());
// benchHint (strings) and LFY_BENCH (numbers) are hand-mirrored — pin EVERY bracket, not
// just mid, so the two copies can't silently drift apart.
ok('benchHint and LFY_BENCH agree on every bracket', (function () {
  function num(name, rank) {
    var m = benchHint(name, { rank: rank, platform: 'premier' }).match(/averages\s*~?([0-9.]+)/);
    return m ? parseFloat(m[1]) : null;
  }
  return ['new','mid','good','high','unsure'].every(function (r) {
    return num('Counter-strafing %', r) === LFY_BENCH.cstrafe[r] &&
           num('Crosshair placement (°)', r) === LFY_BENCH.placement[r];
  });
})());
ok('profile url points back at leetify for attribution',
  /^https:\/\/leetify\.com\//.test(lfyProfileUrl(LFY_SAMPLE)) &&
  lfyProfileUrl(null) === 'https://leetify.com/');

// --- v0.11.3: quiz progress bar must not be pinned to a question count ---
// It was grid-template-columns:repeat(7,1fr) while QUIZ had 8 entries, so the
// last segment silently wrapped to a second row. Source-level guards, because
// the sandbox has no layout engine to measure with.
ok('progress bar does not hardcode a column count', (function () {
  var m = html.match(/\.segs\{[^}]*\}/);
  return !!m && !/repeat\(\s*\d+/.test(m[0]) && /grid-auto-flow:\s*column/.test(m[0]);
})());
ok('intro copy derives its question count from QUIZ', (function () {
  return html.indexOf("Answer '+QUIZ.length+' quick questions") >= 0 &&
         !/Answer \d+ quick questions/.test(html);
})());
ok('every quiz entry is a real question', QUIZ.length >= 7 && QUIZ.every(function (q) { return !!q.id; }));

// --- v0.11.4: grids must not pin a column count to a data array's length ---
// Same class as the .segs wrap: a repeat(N,...) that silently tracked how many
// items the JS happened to produce. These four follow arrays that can grow.
['segs','stats4','causes','cps'].forEach(function (cls) {
  var m = html.match(new RegExp('\.' + cls + '\{[^}]*\}'));
  ok(cls + ' grid is not pinned to a fixed column count',
     !!m && !/grid-template-columns:\s*repeat\(\s*\d/.test(m[0]));
});
// the death-audit grid follows CAUSES; the checkpoint grid follows its own list
ok('causes grid can hold every CAUSES entry', Object.keys(reviewTotals({ reviews: {} })).length === 5);

// --- stated protocol length must still match the blocks it is made of ---
PROTOCOLS.forEach(function (p) {
  var summed = 0;
  (p.blocks || []).forEach(function (b) { summed += parseInt(b.mins || b.dur || 0, 10) || 0; });
  var range = String(p.mins).split(/[^0-9]+/).filter(Boolean).map(Number);
  var lo = range[0], hi = range.length > 1 ? range[1] : range[0];
  ok(p.name + ' stated length (' + p.mins + ') matches its blocks (' + summed + ')',
     summed >= lo && summed <= hi);
});

// --- v0.11.5: drill copy shown on the session screen ---
// The cue is displayed directly under the description, so a description that
// restates it is noise on a screen read at a glance mid-drill.
function normSub(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
ok('no drill description restates its own cue', (function () {
  var bad = [];
  Object.keys(FOCI).forEach(function (k) {
    FOCI[k].drills.forEach(function (d) {
      var sub = normSub(d.sub), cue = normSub(d.cue);
      if (cue && sub && sub.indexOf(cue) >= 0) bad.push(k + '/' + d.t);
    });
  });
  return bad.length === 0;
})());
// Bound comes from the layout, not taste: .ssub is capped at 54ch on desktop,
// so 108 is two full lines. Longer than that and the drill card starts to
// ribbon again, which was the original complaint.
ok('drill descriptions fit two lines at the rendered width', (function () {
  var over = [];
  Object.keys(FOCI).forEach(function (k) {
    FOCI[k].drills.forEach(function (d) { if (d.sub && d.sub.length > 108) over.push(d.t + ' (' + d.sub.length + ')'); });
  });
  if (over.length) console.log('      over: ' + over.join(', '));
  return over.length === 0;
})());
ok('session description is not left at caption-grey', (function () {
  // This asserted #session .ssub for a long time after the session screen stopped emitting
  // it — v0.12 split that prose blob into labelled facts (DO / GOAL / RIGHT / WRONG / MIND)
  // and .ssub survived only as CSS. So the guard passed while protecting nothing, and only
  // deleting the dead rule revealed it. Re-pointed at the class that carries the job now.
  var m = css.match(/#session \.sdotxt\{[^}]*\}/);
  if (!m) { console.log('      no #session .sdotxt rule — has the session screen changed again?'); return false; }
  // the thing you are actually doing must read as body text, never as a caption
  return /color:var\(--text\)/.test(m[0]) && !/--muted|--faint/.test(m[0]);
})());
ok('session type scales up past the phone breakpoint', (function () {
  // Same story: the .ssub half of this was checking a class the screen no longer renders.
  // The drill NAME still clamps, and the body text still steps up at the breakpoint — assert
  // both against what is actually on screen, and require the step to be a real increase.
  var name = /#session \.sname\{font-size:clamp\(3\d/.test(css);
  var base = (css.match(/#session \.sdotxt\{[^}]*font-size:(\d+)px/) || [])[1];
  var wide = (css.match(/#session \.sdotxt\{font-size:(\d+)px\}/g) || []).join(' ');
  var stepped = /#session \.sdotxt\{font-size:18px/.test(css) && +base === 16;
  if (!name || !stepped) console.log('      name-clamp=' + name + ' base=' + base + ' stepped=' + stepped);
  return name && stepped;
})());


// --- v0.12: the session screen reads as labelled facts, not a prose blob ---
// Every drill answers: which map, what to do there, how to execute, what good
// looks like. `where` and `sub` must stay separate or it collapses back to prose.
ok('every real drill names a map or venue', (function () {
  var missing = [];
  Object.keys(FOCI).forEach(function (k) {
    if (k === 'match' || k === 'rest') return;   // these are not workshop work
    FOCI[k].drills.forEach(function (d) { if (!d.where) missing.push(k + '/' + d.t); });
  });
  if (missing.length) console.log('      no map: ' + missing.join(', '));
  return missing.length === 0;
})());
ok('map and method are separate fields, not one blob', (function () {
  var fused = [];
  Object.keys(FOCI).forEach(function (k) {
    FOCI[k].drills.forEach(function (d) {
      // an em-dash join was the old "map — approach" shape
      if (d.where && d.sub && d.sub.indexOf(d.where) >= 0) fused.push(k + '/' + d.t);
    });
  });
  return fused.length === 0;
})());
ok('protocol blocks carry a map too (same screen renders them)', (function () {
  return PROTOCOLS.every(function (p) {
    return (p.blocks || []).filter(function (b) { return !!b.where; }).length >= (p.blocks || []).length - 1;
  });
})());
ok('every drill still has title, method, measure and duration', Object.keys(FOCI).every(function (k) {
  return FOCI[k].drills.every(function (d) {
    return d.t && d.sub && d.m && typeof d.dur === 'number' && typeof d.where === 'string';
  });
}));
ok('session renders each fact under its own label', (function () {
  // MAP chip · DO card · GOAL line · RIGHT/WRONG pair · MINDSET callout
  return ['>MAP<', '>DO<', '>GOAL<', '>RIGHT<', '>WRONG<'].every(function (l) { return html.indexOf(l) >= 0; }) &&
         html.indexOf('class="smind"') >= 0;
})());


// --- v0.12.1: every drill carries a read-ahead "why" (Plan library), distinct
// from its live cue (TIP). The cue is the compressed reminder; why is the fuller
// explanation. They must not be the same string, or one surface is redundant.
ok('every real drill has a why', (function () {
  var missing = [];
  Object.keys(FOCI).forEach(function (k) {
    if (k === 'match' || k === 'rest') return;
    FOCI[k].drills.forEach(function (d) { if (!d.why || d.why.length < 40) missing.push(k + '/' + d.t); });
  });
  if (missing.length) console.log('      thin/no why: ' + missing.join(', '));
  return missing.length === 0;
})());
ok('every protocol block has a why', (function () {
  return PROTOCOLS.every(function (p) {
    return (p.blocks || []).every(function (b) { return b.why && b.why.length >= 40; });
  });
})());
ok('the why is fuller than the cue, never a copy of it', (function () {
  var bad = [];
  function all(list) { list.forEach(function (d) {
    if (d.cue && d.why && (d.why === d.cue || d.why.length <= d.cue.length)) bad.push(d.t);
  }); }
  Object.keys(FOCI).forEach(function (k) { all(FOCI[k].drills); });
  PROTOCOLS.forEach(function (p) { all(p.blocks || []); });
  return bad.length === 0;
})());
ok('adding why did not shift any drill field', Object.keys(FOCI).every(function (k) {
  return FOCI[k].drills.every(function (d) {
    return typeof d.t === 'string' && typeof d.where === 'string' && typeof d.sub === 'string' &&
           typeof d.m === 'string' && typeof d.dur === 'number' && typeof d.cue === 'string' &&
           typeof d.rule === 'string' && typeof d.why === 'string';
  });
}));
ok('Plan library renders the why line', html.indexOf('class="lwhy"') >= 0);


// --- v0.12.2: top-of-app update banner (desktop only) ---
// updateBanner()/UPD are gated on isNative, which is a closure const set from
// window.__TAURI__ at boot. The default sandbox boots web (no bridge), so build a
// SECOND sandbox with a mocked bridge to exercise the native path.
(function () {
  var nsb = {
    module: { exports: {} },
    window: { matchMedia: () => ({ matches: false }), addEventListener() {}, __TAURI__: { core: { invoke: () => Promise.resolve() } } },
    document: documentStub,
    localStorage: { _d: {}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} },
    navigator: {}, location: { protocol: 'http:', hostname: 'localhost' },
    setInterval: () => 0, clearInterval(){}, setTimeout: () => 0, clearTimeout(){}, console,
  };
  nsb.window.document = nsb.document;
  vm.createContext(nsb);
  vm.runInContext(script, nsb, { filename: 'docs/index.html#native' });
  var nUPD = nsb.module.exports.UPD, nBanner = nsb.module.exports.updateBanner;

  ok('web build never shows the update banner', updateBanner() === '' && (function () {
    // in the web sandbox (this file's own), even forcing state yields nothing
    var w = sandbox.module.exports; w.UPD.state = 'available'; w.UPD.version = '9.9.9';
    var out = w.updateBanner() === ''; w.UPD.state = 'idle'; return out;
  })());
  ok('native + available renders the banner with the version and an update action', (function () {
    nUPD.state = 'available'; nUPD.version = '0.12.2'; nUPD.dismissed = null;
    var h = nBanner();
    return h.indexOf('0.12.2') >= 0 && h.indexOf('data-updnow') >= 0 && h.indexOf('data-upddismiss') >= 0;
  })());
  ok('native + idle/current shows nothing', (function () {
    nUPD.state = 'current'; var a = nBanner();
    nUPD.state = 'idle'; var b = nBanner();
    return a === '' && b === '';
  })());
  ok('dismissing this version hides the banner; a newer one brings it back', (function () {
    nUPD.state = 'available'; nUPD.version = '0.12.2'; nUPD.dismissed = '0.12.2';
    var hidden = nBanner() === '';
    nUPD.version = '0.12.3';                       // a newer release arrives
    var backAgain = nBanner().indexOf('0.12.3') >= 0;
    nUPD.dismissed = null;
    return hidden && backAgain;
  })());
  ok('installing state shows progress, not the update button', (function () {
    nUPD.state = 'installing';
    var h = nBanner();
    nUPD.state = 'idle';
    return /UPDATING/i.test(h) && h.indexOf('data-updnow') < 0;
  })());
  // --- v0.17: desktop map-download badges (Get the maps) ---
  var nKit = nsb.module.exports.workshopKit, nWSCAN = nsb.module.exports.WSCAN, nWORK = nsb.module.exports.WORKSHOP;
  ok('map badges: a scanned install marks installed maps ✓ and the rest as missing', (function () {
    nWSCAN.done = true; nWSCAN.ok = true; nWSCAN.busy = false;
    nWSCAN.installed = {}; nWSCAN.installed[nWORK[0].id] = true;   // first map present, others not
    var h = nKit();
    // these badges used to be .wsinst / .wsmiss — the maps screen's own private status
    // vocabulary. They now speak through the one shell, and MISSING is idle, never warn.
    var pass = h.indexOf('class="st live"') >= 0 && h.indexOf('class="st idle"') >= 0 &&
               h.indexOf('data-wsrecheck') >= 0 && h.indexOf('class="st warn') < 0;
    nWSCAN.done = false; nWSCAN.ok = false; nWSCAN.installed = {};
    return pass;
  })());
  ok('map badges FAIL SAFE: Steam unreadable (ok:false) shows NO badges, never false "missing"', (function () {
    nWSCAN.done = true; nWSCAN.ok = false; nWSCAN.busy = false; nWSCAN.installed = {};
    var h = nKit();
    // assert on the CHIPS, not on dead class names — after the .wsinst/.wsmiss rules were
    // deleted this test passed for free, which is no guard at all. START HERE is a due chip
    // and is unconditional, so exclude it and check only the two scan-dependent roles.
    var pass = h.indexOf('class="st live"') < 0 && h.indexOf('class="st idle"') < 0 &&
               h.indexOf('data-wsrecheck') < 0;
    nWSCAN.done = false;
    return pass;
  })());
})();
// --- v0.19: first-run guided tour + Maps tab ---
ok('the tour walks every section with content on every step', (function () {
  var SECTIONS = ['today','plan','drills','maps','progress','gear','setup'];
  if (!Array.isArray(TOUR) || TOUR.length < 8) return false;
  var screens = TOUR.map(function (s) { return s.screen; }).filter(Boolean);
  var allSections = SECTIONS.every(function (sc) { return screens.indexOf(sc) >= 0; });
  var okScreens = TOUR.every(function (s) { return !s.screen || SECTIONS.indexOf(s.screen) >= 0; });
  var okContent = TOUR.every(function (s) { return s.title && s.body; });
  return allSections && okScreens && okContent;
})());
ok('every tour anchor points at a real element, not just the step list', (function () {
  var refs = TOUR.map(function (s) { return s.sel; }).filter(Boolean).join(' ').match(/data-tour="([^"]+)"/g) || [];
  return refs.length >= 4 && refs.every(function (r) {
    return (html.split(r).length - 1) >= 2;   // once in the TOUR sel + at least once on an element
  });
})());
ok('every screen still routes and renders after the 7->5 nav change', (function () {
  return ['maps','drills','gear','plan','progress'].every(function (s) {
    return html.indexOf('screen==="' + s + '"') >= 0 &&
           html.indexOf('function html' + s.charAt(0).toUpperCase() + s.slice(1)) >= 0;
  });
})());
ok('the nav is FIVE destinations and every screen belongs to exactly one', (function () {
  var SCREENS = ['today','plan','drills','maps','progress','gear','setup'];
  if (!Array.isArray(DESTS) || DESTS.length !== 5) return false;
  var seen = {};
  DESTS.forEach(function (d) { d.screens.forEach(function (s) { seen[s] = (seen[s] || 0) + 1; }); });
  var everyScreenOnce = SCREENS.every(function (s) { return seen[s] === 1; });
  var noExtras = Object.keys(seen).length === SCREENS.length;
  var routesBack = SCREENS.every(function (s) { return destOf(s).screens.indexOf(s) >= 0; });
  return everyScreenOnce && noExtras && routesBack;
})());
ok('"Practice", never "Train" — a TRAIN tab beside a MAPS tab collides with the map Train', (function () {
  var grouped = DESTS.filter(function (d) { return d.screens.length > 1; });
  return grouped.length === 2 &&
         DESTS.some(function (d) { return d.k === 'practice' && d.l === 'PRACTICE'; }) &&
         !DESTS.some(function (d) { return /TRAIN/i.test(d.l); });
})());
ok('the dock shows labels permanently — hiding them to fit seven icons was the old bug', (function () {
  // the old rule literally hid them; it must be gone, and the tab label must be display:block
  return html.indexOf('#tabbar .tab span{display:none;}') < 0 &&
         /#tabbar \.tab span\{display:block/.test(html) &&
         /#tabbar \.tab\{min-width:71px;min-height:56px/.test(html);
})());
ok('the Practice sub-tab selection is unambiguous (accent fill + facet + caption), not a 1px outline', (function () {
  var plan = subTabs('plan'), drills = subTabs('drills');
  return /class="subtab on facet"/.test(plan) && /aria-selected="true"/.test(plan) &&
         /role="tablist"/.test(plan) && /VIEWING PLAN/.test(plan) && /VIEWING DRILLS/.test(drills) &&
         /\.subtab\.on\{background:var\(--acc\)/.test(html) &&
         subTabs('today') === '' && subTabs('maps') === '';   // only Practice has sub-tabs
})());
ok('Plan is now just strategy — drills, protocol and maps moved off it', (function () {
  // `([^\n]*)` captured ONE line. htmlPlan's return is two, so altCard + adviceCard +
  // drillsPointer + mapsPointer — half of what the screen renders — was never checked, and
  // anything moved back onto Plan on that second line would have passed silently.
  function returnOf(fn) {
    var i = script.indexOf('function ' + fn + '(');
    if (i < 0) return null;
    var next = script.indexOf('\n  function ', i + 10);
    var body = script.slice(i, next < 0 ? undefined : next);
    var r = body.lastIndexOf('\n    return ');
    if (r < 0) return null;
    var tail = body.slice(r + 1);
    var stop = tail.search(/;\r?\n {2}\}/);                 // the whole statement, however many lines
    return stop < 0 ? null : tail.slice(0, stop + 1);
  }
  var planRet = returnOf('htmlPlan'), drillsRet = returnOf('htmlDrills'), gearRet = returnOf('htmlGear');
  if (planRet && planRet.split('\n').length < 2) console.log('      htmlPlan return captured as one line — check returnOf');
  return planRet && ['practiceCard','mapPrep','protocolCard','+lib+','+tg+'].every(function (x) { return planRet.indexOf(x) < 0; }) &&
         planRet.indexOf('adviceCard') >= 0 &&                                   // proof we read past line one
         drillsRet && drillsRet.indexOf('protocolCard') >= 0 &&                   // drills owns the library + protocol
         gearRet && gearRet.indexOf('loadoutSec') >= 0 &&                         // gear owns the config
         html.indexOf('data-go="drills"') >= 0 && html.indexOf('data-go="maps"') >= 0;   // pointers on Plan
})());
// --- v0.25: desktop reads sens + launch options from CS2 ---
ok('desktop can self-fill Gear from CS2; web never sees the button', (function () {
  return script.indexOf('read_cs_config') >= 0 &&
         /isNative\?[\s\S]*?READ FROM CS2/.test(script) &&                 // button is native-gated
         /function readCsConfig\(\)\{\s*if\(!isNative\)return/.test(script);  // no-op on web (gate is first line)
})());
ok('the CS2 read fills only sensitivity + launch (DPI and crosshair stay manual)', (function () {
  return /loadout\.sens=r\.sensitivity/.test(script) && /loadout\.launch=r\.launch/.test(script) &&
         script.indexOf('loadout.dpi=r.') < 0 && script.indexOf('loadout.cross=r.') < 0;
})());
// --- v0.22: automatic backup — continue where you left off ---
ok('desktop mirrors state to a file and restores it when localStorage is empty', (function () {
  var s = script;
  // `s.indexOf('mirrorBackup(st)')` was satisfied by the DECLARATION — function
  // mirrorBackup(st){ contains that substring — so deleting the call from save() left this
  // green and the auto-backup silently stopped following the state. Scope it to save()'s
  // own body, which is the only place the wiring can actually be.
  var saveBody = s.slice(s.indexOf('function save(st){'));
  saveBody = saveBody.slice(0, saveBody.indexOf('\n'));
  return s.indexOf('backup_write') >= 0 && s.indexOf('backup_read') >= 0 &&
         /function mirrorBackup\(st\)\{\s*if\(!isNative\)return/.test(s) &&   // mirror is desktop-only (gate is the first line)
         /mirrorBackup\(st\);/.test(saveBody) &&                              // genuinely wired into save()
         saveBody.indexOf('function mirrorBackup') < 0;                       // and we are not reading the declaration again
})());
ok('the backup restore only fires when there is no local plan (localStorage stays authoritative)', (function () {
  // in the init: restore is inside the `if(st.plan){...return}` else-path, gated on isNative
  return /if\(st\.plan\)\{bootSettled\(\);boot\("today"\);return;\}/.test(script) &&
         // pictures are pulled back out to IndexedDB before the state reaches localStorage
         /backup_read[\s\S]*?takeBackupImages\(o\);bootSettled\(\);save\(o\)/.test(script);
})());
ok('no boot-time save can mirror pre-restore state over the backup file', (function () {
  // The bug this exists for: on a wiped WebView cache the init path save()s a BLANK state
  // twice before the restore lands (version stamp, then GSI token). mirrorBackup's 800ms
  // debounce carried that blank state over lockin-state.json — so opening the app destroyed
  // the only surviving copy at the exact moment it was being used to recover, and a second
  // cache wipe meant total silent loss. Three independent audit agents reproduced it.
  var mb = (script.match(/function mirrorBackup\(st\)\{[\s\S]*?\n  \}/) || [''])[0];
  var gated = /if\(!_bootDone\)return;/.test(mb);
  // and the flag must actually be flipped on EVERY terminal branch of init, or a boot that
  // ends down an unsettled path silently stops backing up for the whole session
  var init = script.slice(script.lastIndexOf('/* ---------- init ---------- */'));
  var exits = (init.match(/renderOnboard\(\)|boot\("today"\)/g) || []).length;
  var settles = (init.match(/bootSettled\(\)/g) || []).length;
  // restore uses save(), not a raw setItem, so `mem` is set and the mirror re-arms correctly
  var savesNotSetItem = init.indexOf('localStorage.setItem(KEY,JSON.stringify(o))') < 0;
  if (!gated || settles < exits || !savesNotSetItem)
    console.log('      gated=' + gated + ' exits=' + exits + ' settles=' + settles + ' savesNotSetItem=' + savesNotSetItem);
  return gated && settles >= exits && savesNotSetItem &&
         /function bootSettled\(\)\{[\s\S]*?mirrorBackup\(load\(\)\)/.test(script);
})());
ok('web asks the browser to keep storage persistent', (function () {
  return script.indexOf('navigator.storage') >= 0 && script.indexOf('.persist(') >= 0;
})());
// --- v0.21: optional gamertag ---
ok('playerTag reads settings.tag and is empty by default', (function () {
  return playerTag({ settings: {} }) === '' && playerTag({ settings: { tag: 'Zywoo' } }) === 'Zywoo' &&
         playerTag({}) !== undefined;   // never throws on a missing settings bucket
})());
ok('the gamertag is asked at onboarding and editable in Setup', (function () {
  return html.indexOf('id="tagIn"') >= 0 &&        // welcome screen input
         html.indexOf('data-tag') >= 0 &&          // Setup edit field + its handler
         html.indexOf('settings.tag') >= 0;
})());
ok('every place the tag is shown escapes it (no HTML injection)', (function () {
  // each HTML use of playerTag() must be wrapped in esc(); canvas fillText is not HTML.
  var uses = html.match(/playerTag\([^)]*\)/g) || [];
  // find HTML-context uses: those concatenated into a string near esc(). Assert the
  // source never interpolates a raw playerTag() straight into markup without esc.
  return html.indexOf("+playerTag()+") < 0 && html.indexOf("+playerTag(st)+") < 0 && uses.length >= 4;
})());
ok('web build shows plain map links, never a download badge', (function () {
  // .wsinst / .wsmiss were renamed to the shared status chips in v3 and this guard was left
  // naming the dead classes, so it could only ever pass. Assert the text the chips actually
  // render — and assert the chips DO exist somewhere, or the guard goes hollow the next time
  // the copy changes.
  var h = workshopKit();   // default sandbox is web (isNative false) — must never badge
  var chipsExist = /statusChip\("live","Installed"\)/.test(script) && /statusChip\("idle","Not downloaded"\)/.test(script);
  return chipsExist &&
         h.indexOf('Installed') < 0 && h.indexOf('Not downloaded') < 0 &&
         h.indexOf('class="st live"') < 0 && h.indexOf('class="st idle"') < 0 &&
         h.indexOf('data-wsrecheck') < 0 &&
         h.indexOf('steamcommunity.com') >= 0;      // it does still render the plain links
})());
// the native command that backs the badges, and its fail-safe contract, live in Rust —
// assert the frontend actually calls it and treats an un-ok scan as "show nothing"
ok('frontend invokes scan_workshop and only badges on ok', (function () {
  return script.indexOf('scan_workshop') >= 0 && /WSCAN\.done\s*&&\s*WSCAN\.ok/.test(script);
})());
ok('update banner mounts in the app shell, above the screen content', (function () {
  return html.indexOf('id="updbar"') >= 0 && html.indexOf('id="updbar"') < html.indexOf('id="main"');
})());
ok('the banner is sticky so it stays visible while scrolling', (function () {
  var m = html.match(/#updbar\{[^}]*\}/);
  return !!m && /position:sticky/.test(m[0]) && /top:0/.test(m[0]);
})());


// --- v0.12.3: every drill states goal + mindset + a good rep vs a bad rep ---
ok('every real drill has a goal', (function () {
  var m = [];
  Object.keys(FOCI).forEach(function (k) {
    if (k === 'match' || k === 'rest') return;
    FOCI[k].drills.forEach(function (d) { if (!d.goal || d.goal.length < 12) m.push(k + '/' + d.t); });
  });
  if (m.length) console.log('      no goal: ' + m.join(', '));
  return m.length === 0;
})());
ok('every real drill states BOTH a good rep and a bad rep', (function () {
  var m = [];
  function chk(list, tag) { list.forEach(function (d) {
    if (!d.m || d.m.length < 8) m.push(tag + '/' + d.t + ' (RIGHT)');
    if (!d.rule || d.rule.length < 8) m.push(tag + '/' + d.t + ' (WRONG)');
  }); }
  Object.keys(FOCI).forEach(function (k) { if (k === 'match' || k === 'rest') return; chk(FOCI[k].drills, k); });
  PROTOCOLS.forEach(function (p) { chk(p.blocks || [], 'proto'); });
  if (m.length) console.log('      missing: ' + m.join(', '));
  return m.length === 0;
})());
ok('the previously-empty WRONG lines are now filled', (function () {
  var rp = FOCI.awp.drills.filter(function (d) { return d.t === 'Repeek discipline'; })[0];
  var cc = FOCI.clutch.drills.filter(function (d) { return d.t === 'Clock craft'; })[0];
  return rp && rp.rule.length > 10 && cc && cc.rule.length > 10;
})());
ok('goal appended without shifting any field', Object.keys(FOCI).every(function (k) {
  if (k === 'match' || k === 'rest') return true;
  return FOCI[k].drills.every(function (d) {
    return typeof d.where === 'string' && typeof d.sub === 'string' && typeof d.cue === 'string' &&
           typeof d.m === 'string' && typeof d.rule === 'string' && typeof d.why === 'string' &&
           typeof d.goal === 'string' && typeof d.dur === 'number';
  });
}));
ok('drill screen labels the right-vs-wrong contrast', (function () {
  return html.indexOf('>RIGHT<') >= 0 && html.indexOf('>WRONG<') >= 0 &&
         html.indexOf('srwc rgood') >= 0 && html.indexOf('srwc rbad') >= 0;
})());
ok('Plan surfaces carry the same depth (drillDepth)', (function () {
  return html.indexOf('function drillDepth') >= 0 &&
         html.indexOf('ld-mind') >= 0 && html.indexOf('ld-right') >= 0 && html.indexOf('ld-wrong') >= 0;
})());


// --- v0.13: week-4 / week-8 plan review ---
// The review makes claims about the user's progress, so the honesty rules matter
// more than the suggestion itself: never report a metric it can't measure, and
// never recommend a change off too little data.
function revState(opts) {
  opts = opts || {};
  var created = opts.created || '2026-06-01';
  var plan = generatePlan({ rank:'mid', weapon:'rifle', role:'entry', weak:['cstrafe'], time:'30', days:'4', goal:'aim' });
  plan.created = created;
  var st = { plan: plan, sessions: {}, settings: {}, metrics: {}, reviews: {}, lineups: {}, planReviews: opts.planReviews || {} };
  // n warm days starting the day after created
  var d = new Date(created + 'T00:00:00');
  for (var i = 0; i < (opts.trained || 0); i++) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    st.sessions[dateKey(x)] = { warm: true, feel: opts.feel || 3 };
  }
  if (opts.metrics) st.metrics = opts.metrics;
  // deaths land INSIDE the block by default (day created+3). `deathDay` places them
  // elsewhere — used to prove that deaths outside the block are not counted.
  if (opts.deaths) {
    var dd = new Date(created + 'T00:00:00');
    dd.setDate(dd.getDate() + (opts.deathDay != null ? opts.deathDay : 3));
    st.reviews[dateKey(dd)] = opts.deaths;
  }
  return st;
}
var REV_NOW = new Date('2026-07-06T00:00:00');   // week 6 of a plan created 2026-06-01

ok('no review before week 5', planReview(revState({ trained: 10 }), new Date('2026-06-15T00:00:00')) === null);
ok('week-4 review appears once week 5 starts', (function () {
  var r = planReview(revState({ trained: 10 }), REV_NOW);
  return !!r && r.n === 4;
})());
ok('a completed review does not come back', (function () {
  return planReview(revState({ trained: 10, planReviews: { '4': { action: 'kept' } } }), REV_NOW) === null;
})());
ok('too few sessions -> flagged thin, and it refuses to suggest anything', (function () {
  var r = planReview(revState({ trained: 2, deaths: { pos: 20, aim: 1, util: 0, info: 0, trade: 0 } }), REV_NOW);
  return r.thin === true && r.suggest === null;
})());
// HONESTY: a metric is only reported when BOTH numbers exist
ok('a metric with no base is never reported as movement', (function () {
  var key = tkey(planReview(revState({ trained: 10 }), REV_NOW) && 'Counter-strafing %');
  var m = {}; m[key] = { w4: 74 };                       // checkpoint but no base
  return planReview(revState({ trained: 10, metrics: m }), REV_NOW).moved.length === 0;
})());
ok('a metric with base + checkpoint is reported with direction', (function () {
  var m = {}; m[tkey('Counter-strafing %')] = { base: 61, w4: 74 };
  var r = planReview(revState({ trained: 10, metrics: m }), REV_NOW);
  var row = r.moved.filter(function (x) { return /Counter-strafing/.test(x.n); })[0];
  return !!row && row.better === true && row.delta === 13;
})());
ok('lower-is-better metrics are read the right way round', (function () {
  var m = {}; m[tkey('Crosshair placement (°)')] = { base: 12.1, w4: 9.8 };
  var plan = generatePlan({ rank:'mid', weapon:'rifle', weak:['placement'], time:'30', days:'4', goal:'aim' });
  var st = revState({ trained: 10, metrics: m }); st.plan.targets = plan.targets; st.metrics = m;
  var r = planReview(st, REV_NOW);
  var row = r.moved.filter(function (x) { return /Crosshair placement/.test(x.n); })[0];
  return !!row && row.better === true;                    // 12.1 -> 9.8 is an improvement
})());
ok('a dominant logged leak drives the suggestion', (function () {
  var r = planReview(revState({ trained: 12, deaths: { pos: 9, aim: 4, util: 3, info: 2, trade: 4 } }), REV_NOW);
  return !!r.suggest && r.suggest.key === 'positioning' && /9 of your 22/.test(r.suggest.why);
})());
ok('a scattered death log suggests nothing', (function () {
  var r = planReview(revState({ trained: 12, deaths: { pos: 3, aim: 3, util: 3, info: 3, trade: 3 } }), REV_NOW);
  return r.suggest === null;                              // no cause clears the 35% bar
})());
ok('counter-strafing past its plateau graduates to placement', (function () {
  var m = {}; m[tkey('Counter-strafing %')] = { base: 70, w4: 79 };
  var r = planReview(revState({ trained: 12, metrics: m }), REV_NOW);
  return !!r.suggest && r.suggest.key === 'placement' && /plateau/i.test(r.suggest.why);
})());
// --- v0.16.1 quality-pass regression guards ---
// A faster jump-course time is an IMPROVEMENT. Direction now comes from an explicit
// `lower` flag on the target, not a regex on its label (which missed this one metric
// and painted real movement progress red as "gone the wrong way").
ok('a faster jump-course time reads as progress, not a regression', (function () {
  var plan = generatePlan({ rank:'mid', weapon:'rifle', weak:['movement'], time:'30', days:'4', goal:'aim' });
  plan.created = '2026-06-01';
  var m = {}; m[tkey('Jump-course best time')] = { base: 30, w4: 25 };   // 5s faster
  var st = { plan: plan, sessions:{}, settings:{}, metrics: m, reviews:{}, lineups:{}, planReviews:{} };
  var jc = planReview(st, REV_NOW).moved.filter(function (x) { return /Jump-course/.test(x.n); })[0];
  return !!jc && jc.delta === -5 && jc.better === true;
})());
ok('the keystone target carries an explicit lower-is-better flag', (function () {
  var lowers = ['placement','positioning','movement'].every(function (k) { return buildTargets(k, ['rifle'])[0].lower === true; });
  var highers = ['cstrafe','spray','utility','clutch','entry'].every(function (k) { return !buildTargets(k, ['rifle'])[0].lower; });
  return lowers && highers;
})());
// The review says "in the block" — so deaths logged OUTSIDE the block must not count.
// (Under the old last-28-days-from-today window, a death on 2026-07-20 WOULD have been
// counted into a weeks-1-4 review. It must not be.)
ok('deaths logged outside the block do not drive the review', (function () {
  var r = planReview(revState({ trained: 12, deaths: { pos: 9, aim: 4, util: 3, info: 2, trade: 4 }, deathDay: 49 }), REV_NOW);
  return r.leakSum === 0 && r.suggest === null;
})());
// Completing the week-8 review must not resurface a long-past week-4 review at week 9+.
ok('the week-4 review does not resurface after week 9', (function () {
  var WK10 = new Date('2026-08-05T00:00:00');                 // ~week 10 of a plan created 2026-06-01
  return planReview(revState({ trained: 12, planReviews: { '8': true } }), WK10) === null;
})());
ok('a returning user at week 9+ gets the week-8 review, not a stale week-4', (function () {
  var WK10 = new Date('2026-08-05T00:00:00');
  var r = planReview(revState({ trained: 12 }), WK10);        // never saw the week-4 card
  return !!r && r.n === 8;
})());
ok('applying a review keeps the created date, so the 12-week clock runs on', (function () {
  var st = revState({ trained: 12 }), before = st.plan.created;
  var p2 = applyReview(st, 'positioning');
  return p2.created === before && p2.keystone === 'positioning';
})());
ok('applying a review preserves the user\'s own match nights', (function () {
  var st = revState({ trained: 12 });
  st.plan.weekly = { 0:'rest', 1:'cstrafe', 2:'match', 3:'cstrafe', 4:'rest', 5:'rifle', 6:'match' };
  var p2 = applyReview(st, 'positioning');
  return p2.weekly[2] === 'match' && p2.weekly[6] === 'match' &&
         p2.weekly[0] === 'rest' && p2.weekly[4] === 'rest';
})());
ok('applying a review actually changes the training days to the new focus', (function () {
  var st = revState({ trained: 12 });
  st.plan.weekly = { 0:'rest', 1:'cstrafe', 2:'match', 3:'cstrafe', 4:'rest', 5:'rifle', 6:'match' };
  var p2 = applyReview(st, 'positioning');
  var training = [1,3,5].map(function (d) { return p2.weekly[d]; });
  return training.indexOf('positioning') >= 0;
})());
ok('generatePlan can be pinned to a focus without breaking normal selection', (function () {
  var pinned = generatePlan({ rank:'mid', weapon:'rifle', weak:['cstrafe'], time:'30', days:'4', goal:'aim' }, 'clutch');
  var normal = generatePlan({ rank:'mid', weapon:'rifle', weak:['cstrafe'], time:'30', days:'4', goal:'aim' });
  return pinned.keystone === 'clutch' && normal.keystone === 'cstrafe';
})());


// --- v0.13.1: copy must not contradict the verified research ---
// research_cs2_coaching_facts (Jul 2026) is explicit: rifle accuracy returns below
// ~34% of max speed, a counter-strafe reaches it instantly, and we must NOT tell
// rifle players they need to be "fully stopped". The AWP is the exception — it
// genuinely needs a near-full stop. These guards pin that distinction.
ok('rifle counter-strafe copy never asserts a dead stop (drills AND protocol blocks)', (function () {
  var bad = [];
  function scan(label, obj, fields) {
    fields.forEach(function (f) {
      var v = obj[f] || '';
      // "the stop" / drill names are idiomatic; asserting you must BE stopped is not
      if (/(you're|you are|until|wait for (a|the))\s+(fully\s+)?stopped/i.test(v) ||
          /\bfully stopped\b/i.test(v)) bad.push(label + '.' + f);
    });
  }
  FOCI.cstrafe.drills.forEach(function (d) { scan(d.t, d, ['goal', 'm', 'rule', 'why', 'sub']); });
  // the guard used to scan ONLY FOCI.cstrafe.drills, so a dead-stop assertion living in a PROTOCOLS
  // block (an AK/rifle drill) shipped unchecked — scan every protocol block's text too, skipping
  // anything AWP-flavoured (a near-full stop is genuinely correct there).
  PROTOCOLS.forEach(function (p) {
    (p.blocks || []).forEach(function (b) {
      if (/awp/i.test((b.where || '') + (b.t || ''))) return;
      scan(b.t || 'block', b, ['sub', 'm', 'cue', 'rule', 'why', 'goal']);
    });
  });
  if (bad.length) console.log('      dead-stop wording: ' + bad.join(', '));
  return bad.length === 0;
})());
ok('the 34% threshold is stated where counter-strafing is taught',
  /34%/.test(FOCI.cstrafe.why) || FOCI.cstrafe.drills.some(function (d) { return /34%/.test((d.goal||'') + (d.why||'')); }));
ok('the AWP keeps its stricter near-full-stop rule', (function () {
  var txt = FOCI.awp.drills.map(function (d) { return (d.why||'') + (d.m||''); }).join(' ');
  return /near-full stop|almost fully stopped/i.test(txt) && /stricter than a rifle/i.test(txt);
})());
ok('counter-strafe benchmarks match the researched per-rank data', (function () {
  // 1K=61.9, 10K=72.7, 15K=75.9, 20K=77.7 and it plateaus ~78 — never promise more
  var b = LFY_BENCH.cstrafe;
  return b.new === 62 && b.mid === 73 && b.good === 76 && b.high === 78 &&
         Object.keys(b).every(function (k) { return b[k] <= 82; });   // 85%+ is unrealistic
})());
ok('crosshair placement benchmarks stay lower-is-better and monotonic', (function () {
  var b = LFY_BENCH.placement;
  return b.new > b.mid && b.mid > b.good && b.good > b.high && b.good === 9.9;  // 15K bracket
})());
ok('the app never claims Leetify Rating as an absolute target', /zero-sum/i.test(html));
ok('grenade command is the post-rename CS2 one', (function () {
  return /sv_grenade_trajectory_prac_pipreview/.test(html) &&
         !/sv_grenade_trajectory(?![_a-z])/.test(html);
})());
ok('reserve maps stay out of the Active Duty pool', (function () {
  var ids = MAPS.map(function (m) { return m.id; });
  return ['overpass', 'train', 'vertigo'].every(function (x) { return ids.indexOf(x) < 0; });
})());


// --- v0.14: coming back after a lapse ---
// Counted in MISSED TRAINING DAYS, not calendar days, so the threshold matches
// the user's own cadence. A brand-new user must NEVER see this (same class as the
// never-miss-twice bug a tester reported).
function lapseState(weekly, warmKeys) {
  var plan = generatePlan({ rank:'mid', weapon:'rifle', weak:['cstrafe'], time:'30', days:'4', goal:'aim' });
  plan.created = '2026-06-01';
  if (weekly) plan.weekly = weekly;
  var st = { plan: plan, sessions: {}, settings: {}, metrics: {}, reviews: {}, lineups: {}, planReviews: {} };
  (warmKeys || []).forEach(function (k) { st.sessions[k] = { warm: true }; });
  return st;
}
var FOURDAY = { 0:'rest', 1:'cstrafe', 2:'cstrafe', 3:'cstrafe', 4:'cstrafe', 5:'match', 6:'match' };
var TWODAY  = { 0:'rest', 1:'cstrafe', 2:'rest', 3:'rest', 4:'cstrafe', 5:'match', 6:'rest' };
var NOW = new Date('2026-07-20T00:00:00');   // a Monday

ok('a brand-new user with no sessions never sees a lapse', lapseInfo(lapseState(FOURDAY, []), NOW) === null);
ok('training today or yesterday is not a lapse', (function () {
  return lapseInfo(lapseState(FOURDAY, ['2026-07-20']), NOW) === null &&
         lapseInfo(lapseState(FOURDAY, ['2026-07-19']), NOW) === null;
})());
ok('a normal gap on a 2-day plan is not a lapse', (function () {
  // last trained Thu 16th; on a Mon-and-Thu plan only Thu was missed
  return lapseInfo(lapseState(TWODAY, ['2026-07-13']), NOW) === null;
})());
ok('the same calendar gap IS a lapse on a 4-day plan', (function () {
  var lp = lapseInfo(lapseState(FOURDAY, ['2026-07-13']), NOW);
  return !!lp && lp.missed >= 3;                      // Tue/Wed/Thu missed
})());
ok('a real lapse reports the gap, the week and what survived', (function () {
  var lp = lapseInfo(lapseState(FOURDAY, ['2026-07-06', '2026-07-07']), NOW);
  return !!lp && lp.days === 13 && lp.week === 8 && lp.best === 2 && lp.total === 2;   // 49 days in = week 8
})());
ok('it knows whether you can train today, and names the next day if not', (function () {
  var sat = new Date('2026-07-25T00:00:00');          // Saturday = match night on FOURDAY
  var lp = lapseInfo(lapseState(FOURDAY, ['2026-07-06']), sat);
  return !!lp && lp.canTrainToday === false && lp.next === 'Monday';
})());
ok('the lapse card offers a way back in, never a reprimand', (function () {
  var lp = lapseInfo(lapseState(FOURDAY, ['2026-07-06']), NOW);
  var h = lapseCard(lp);
  return /WELCOME BACK/.test(h) && /does not restart/.test(h) &&
         /data-quickstart/.test(h) && !/warnbanner|missed yesterday|non-negotiable/i.test(h);
})());
ok('the lapse card never uses the warning colour', (function () {
  var m = html.match(/\.lapsecard\{[^}]*\}/);
  return !!m && /--hero/.test(m[0]) && !/--bad/.test(m[0]);
})());
ok('never-miss-twice is suppressed while the welcome-back card is up',
  /!lapse&&isTrainingDay/.test(html));
ok('logging a session clears the lapse immediately', (function () {
  var st = lapseState(FOURDAY, ['2026-07-06']);
  var before = lapseInfo(st, NOW);
  st.sessions[dateKey(NOW)] = { warm: true };         // train today
  return !!before && lapseInfo(st, NOW) === null;
})());


// --- v0.15: arousal reappraisal on match nights ---
// The first feature in this app that ships with a citation. Sharpe et al. (2024),
// N=44 CS players, pre-registered: accuracy 66%->72%. The completion-time effect
// was NOT significant, so the app must never promise speed. These guards exist
// because overstating this claim is the exact failure mode the research pass was
// run to prevent.
ok('the reappraisal card quotes the accuracy finding as raw means', (function () {
  var h = reappraisalCard();
  return h.indexOf('66%') >= 0 && h.indexOf('72%') >= 0;
})());
ok('it never promises speed — the study found no significant speed effect', (function () {
  // every mention of speed must be a NEGATION. Find each one and check it is
  // preceded by "not" within a short window, so a positive claim can't slip in.
  var h = reappraisalCard().toLowerCase().replace(/<[^>]*>/g, '');
  var hits = [], re = /faster|quicker|speed/g, m;
  while ((m = re.exec(h)) !== null) hits.push(m.index);
  if (!hits.length) return false;                 // it must address speed at all
  return hits.every(function (i) { return /\bnot\b[^.]{0,30}$/.test(h.slice(Math.max(0, i - 40), i)); });
})());
ok('it carries the sample and the pre-registration', (function () {
  var h = reappraisalCard();
  return /44 players/.test(h) && /pre-registered/i.test(h);
})());
ok('it carries the limits rather than hiding them', (function () {
  var h = reappraisalCard().toLowerCase();
  return /university/.test(h) && /practice map|not ranked|rather than ranked/.test(h) && /single occasion|once/.test(h);
})());
ok('it is a reappraisal script, not a calm-down instruction', (function () {
  // the intervention reframes arousal as useful; telling players to relax is the opposite
  var h = reappraisalCard().toLowerCase();
  return /do not need to calm down/.test(h) && /getting ready|body/.test(h);
})());
ok('it only renders on match nights, and still BEFORE the gate checklist (the study order)',
  /if\(focusKey==="match"&&!backfill\)\{\s*tierGate=reappraisalCard\(\)\+gateCard/.test(html));

// --- v0.26: CS2 auto-tracking via Game State Integration ---
ok('match log and off-plan log are part of the state, blank and defaulted on load', (function () {
  return /blank\(\)\{return \{[^\n]*matches:\{\}/.test(script) && script.indexOf('o.matches=o.matches||{}') >= 0 &&
         /blank\(\)\{return \{[^\n]*offPlan:\{\}/.test(script) && script.indexOf('o.offPlan=o.offPlan||{}') >= 0;
})());
ok('a decided LOSS logs the match AND bumps tonight’s stop-loss counter', (function () {
  var st = { sessions: {}, matches: {} };
  applyGsiMatch(st, { result: 'loss', ct: 13, t: 16, map: 'de_mirage' }, 'D', 1e6);
  return st.matches['D'].length === 1 && st.matches['D'][0].result === 'loss' && st.sessions['D'].losses === 1;
})());
ok('a WIN/TIE/UNKNOWN is logged but never counts as a loss', (function () {
  var win = { sessions: {}, matches: {} }, tie = { sessions: {}, matches: {} }, unk = { sessions: {}, matches: {} };
  applyGsiMatch(win, { result: 'win', ct: 16, t: 9, map: 'a' }, 'D', 1e6);
  applyGsiMatch(tie, { result: 'tie', ct: 15, t: 15, map: 'b' }, 'D', 1e6);
  applyGsiMatch(unk, { result: 'unknown', ct: 16, t: 5, map: 'c' }, 'D', 1e6);
  return win.matches['D'].length === 1 && !win.sessions['D'] &&
         tie.matches['D'].length === 1 && !tie.sessions['D'] &&
         unk.matches['D'].length === 1 && !unk.sessions['D'];
})());
ok('the SAME finished match re-POSTed seconds later (app restart mid-scoreboard) is deduped', (function () {
  var st = { sessions: {}, matches: {} }, m = { result: 'loss', ct: 10, t: 16, map: 'de_nuke' };
  applyGsiMatch(st, m, 'D', 1e6); applyGsiMatch(st, m, 'D', 1e6 + 5000);   // 5s later, inside the window
  return st.matches['D'].length === 1 && st.sessions['D'].losses === 1;
})());
ok('two IDENTICAL losses a full match apart BOTH count (the old content-only dedup dropped the 2nd)', (function () {
  var st = { sessions: {}, matches: {} }, m = { result: 'loss', ct: 13, t: 16, map: 'de_mirage' };
  applyGsiMatch(st, m, 'D', 1e6); applyGsiMatch(st, m, 'D', 1e6 + 40 * 60 * 1000);   // 40 min apart
  return st.matches['D'].length === 2 && st.sessions['D'].losses === 2;
})());
ok('a re-post straddling midnight into a new day bucket is still deduped (no cross-day double-count)', (function () {
  var st = { sessions: {}, matches: {} }, m = { result: 'loss', ct: 12, t: 16, map: 'de_ancient' };
  applyGsiMatch(st, m, '2026-08-06', 1e6); applyGsiMatch(st, m, '2026-08-07', 1e6 + 120000);   // 2 min later, next day
  return st.matches['2026-08-06'].length === 1 && (st.matches['2026-08-07'] || []).length === 0 &&
         st.sessions['2026-08-06'].losses === 1 && !st.sessions['2026-08-07'];
})());
ok('two DISTINCT losses in a night stack to 2 (stop-loss territory)', (function () {
  var st = { sessions: {}, matches: {} };
  applyGsiMatch(st, { result: 'loss', ct: 13, t: 16, map: 'a' }, 'D', 1e6);
  applyGsiMatch(st, { result: 'loss', ct: 8, t: 16, map: 'b' }, 'D', 1e6 + 1000);
  return st.matches['D'].length === 2 && st.sessions['D'].losses === 2;
})());
ok('an auto-loss augments an existing session — it never clobbers warm-up / drills', (function () {
  var st = { sessions: { D: { warm: true, drills: { x: true }, losses: 1 } }, matches: {} };
  applyGsiMatch(st, { result: 'loss', ct: 5, t: 16, map: 'z' }, 'D', 1e6);
  return st.sessions['D'].warm === true && st.sessions['D'].drills.x === true && st.sessions['D'].losses === 2;
})());
ok('a payload with no result is ignored (fail-safe)', (function () {
  var st = { sessions: {}, matches: {} };
  applyGsiMatch(st, null, 'D', 1e6); applyGsiMatch(st, {}, 'D', 1e6);
  return Object.keys(st.matches).length === 0 && Object.keys(st.sessions).length === 0;
})());
ok('the app writes CS2’s GSI config and runs a local listener, both native-gated (no-op on web)', (function () {
  var s = script;
  return s.indexOf('write_gsi_config') >= 0 && s.indexOf('start_gsi') >= 0 &&
         /function startGsi\(\)\{\s*if\(!isNative\)return/.test(s) &&
         /function writeGsiConfig\(\)\{\s*if\(!isNative\)return/.test(s) &&
         script.indexOf('startGsi();') >= 0;                                  // wired into init
})());
ok('the listener + config both carry the shared token; only "loss" moves the stop-loss', (function () {
  var s = script;
  return /start_gsi",\{port:GSI_PORT,token:gsiToken\(\)\}/.test(s) &&
         /write_gsi_config",\{token:gsiToken\(\),port:GSI_PORT\}/.test(s) &&
         /if\(m\.result==="loss"\)\{var s=st\.sessions\[dk\]/.test(s);
})());
ok('the setup section + connected status are desktop-only; the Gate shows live status when connected', (function () {
  var s = script;
  return /if\(isNative\)\{\s*var live=gsiLive\(\);\s*gsiSec=/.test(s) &&     // section behind isNative
         s.indexOf('data-gsi-setup') >= 0 && s.indexOf('CS2 AUTO-TRACKING') >= 0 &&
         /var auto=gsiLive\(\)\?/.test(s) && /auto\+stop\+/.test(s);          // Gate indicator, gsiLive-gated
})());


// --- v0.27: audit remediation guards ---
ok('erasing data clears the backup AND cancels the pending mirror (no debounced write resurrects it)', (function () {
  // `clearTimeout(_mirrorT);_mirrorT=null;` is unique to the reset handler (mirrorBackup re-arms with
  // setTimeout, never nulls) — assert it cancels the mirror, then wipes storage, then deletes the file.
  return script.indexOf('backup_delete') >= 0 &&
         /clearTimeout\(_mirrorT\);_mirrorT=null;[\s\S]{0,140}removeItem\(KEY\)[\s\S]{0,320}invoke\("backup_delete"\)/.test(script);
})());
ok('a failed WRITE keeps mem authoritative; a successful READ never re-flips storageOk true', (function () {
  return /function load\(\)\{\s*if\(!storageOk&&mem\)return mem;/.test(script) &&
         script.indexOf('getItem(KEY);storageOk=true') < 0;   // the read no longer heals the write-blocked flag
})());
ok('GSI dedup is identity+time based (settings.lastGsi within a window), not today’s-last-entry content', (function () {
  // This used to be /applyGsiMatch\(st,m,dk,now\)/, which the DECLARATION satisfies —
  // `function applyGsiMatch(st,m,dk,now){` contains it — so deleting the argument at the
  // call site left the guard green and the dedup window comparing against the wrong clock.
  // Match a CALL: the statement, not the definition.
  var calls = (script.match(/(^|[^n])\s*applyGsiMatch\(st,m,dk,now\);/gm) || []).length;
  return script.indexOf('st.settings.lastGsi') >= 0 && /\(now-last\.at\)<600000/.test(script) &&
         calls >= 1 &&                                                     // now is threaded through at the call site
         !/function applyGsiMatch\(st,m,dk,now\);/.test(script);           // and that match is not the declaration
})());
ok('external CS2-triggered renders are focus-safe (skip while a text field is focused)', (function () {
  // bound to gsiRender's OWN body: the fix is the early-return-on-focused-input, so a hollow
  // `function gsiRender(){render();}` must fail this — not merely reach a later activeElement.
  return /function gsiRender\(\)\{var a=document\.activeElement;\s*if\(a&&\([\s\S]{0,220}\)\)return;\s*render\(\);\}/.test(script) &&
         /gsi-match"[\s\S]{0,80}onGsiMatch/.test(script);
})());
ok('the live "connected" indicator self-clears when heartbeats stop', (function () {
  return /gsiOffT=setTimeout\(gsiRender,\s*95000\)/.test(script);
})());
ok('the CS2 connection status is announced to screen readers via a persistent live region', (function () {
  return html.indexOf('id="gsiann"') >= 0 && /role="status" aria-live="polite"/.test(html) &&
         /gsiAnnounce\("CS2 auto-tracking connected/.test(script);
})());
ok('the guided tour is a real modal — inert on the app/tab bar while open, cleared on close', (function () {
  // the tour uses its own var names (ap/tbn) — distinct from the guided-session overlay's (app/tb) —
  // and a bounded window, so the unbounded lazy match can't fall through to the session overlay's
  // inert calls and pass when the tour's own inert lines are removed.
  return /function startTour\(\)\{[\s\S]{0,700}if\(tbn\)tbn\.setAttribute\("inert",""\)/.test(script) &&
         /function endTour\(\)\{[\s\S]{0,700}if\(tbn\)tbn\.removeAttribute\("inert"\)/.test(script);
})());
ok('long unbreakable user text wraps instead of forcing horizontal scroll', (function () {
  return /\.dsp\{[^}]*overflow-wrap:anywhere/.test(html) && /\.lnrow \.lnb b\{[^}]*overflow-wrap:anywhere/.test(html);
})());
ok('best streak honors the freeze budget the live streak uses (record can’t go backwards)', (function () {
  return /function bestStreak\(st\)\{[\s\S]*?freezeBudget\(st\)[\s\S]*?computeStreak\(st,parseKey\(keys\[i\]\),fb\)/.test(script);
})());

// --- v0.28: lineup library groups + spaced review ---
ok('a fresh lineup is due immediately; got-it climbs the ladder 1→3→7→14→30 and caps', (function () {
  if (String(LSRS) !== '1,3,7,14,30') return false;
  var l = { n: 'x', t: 'y' };
  if (!lineupIsDue(l, '2026-08-07')) return false;
  srsAnswer(l, true, new Date(2026, 7, 7));   // first success → +1 day
  if (l.srs.s !== 0 || l.srs.due !== '2026-08-08') return false;
  srsAnswer(l, true, new Date(2026, 7, 8));   // → +3
  if (l.srs.s !== 1 || l.srs.due !== '2026-08-11') return false;
  srsAnswer(l, true, new Date(2026, 7, 11));  // → +7
  srsAnswer(l, true, new Date(2026, 7, 18));  // → +14
  if (l.srs.s !== 3 || l.srs.due !== '2026-09-01') return false;
  srsAnswer(l, true, new Date(2026, 8, 1));   // → +30
  if (l.srs.s !== 4 || l.srs.due !== '2026-10-01') return false;
  srsAnswer(l, true, new Date(2026, 9, 1));   // capped at the 30-day rung
  return l.srs.s === 4 && l.srs.due === '2026-10-31';
})());
ok('shaky drops back to the start of the ladder (tomorrow again)', (function () {
  var l = { n: 'x', srs: { s: 3, due: '2026-08-01' } };
  srsAnswer(l, false, new Date(2026, 7, 7));
  return l.srs.s === 0 && l.srs.due === '2026-08-08';
})());
ok('the due list spans every map and skips throws not yet due', (function () {
  var st = { lineups: {} };
  st.lineups[MAPS[0].id] = [{ n: 'a', t: '' }];                                  // never reviewed → due
  st.lineups[MAPS[1].id] = [{ n: 'b', t: '', srs: { s: 1, due: '2099-01-01' } },
                            { n: 'c', t: '', srs: { s: 0, due: '2020-01-01' } }];
  var due = dueLineups(st, new Date(2026, 7, 7));
  return due.length === 2 && due[0].l.n === 'a' && due[1].l.n === 'c';
})());
ok('the review card is recall-first: throw hidden until revealed, then a self-grade', (function () {
  var st = { lineups: {} };
  st.lineups[MAPS[0].id] = [{ n: 'A exec smoke', t: 'stand on the box, aim at antenna', g: 'A executes' }];
  var hidden = lineupReviewCard(st, false), shown = lineupReviewCard(st, true);
  return hidden.indexOf('antenna') < 0 && hidden.indexOf('data-lrshow') >= 0 &&
         shown.indexOf('antenna') >= 0 && shown.indexOf('data-lrok') >= 0 && shown.indexOf('data-lrno') >= 0 &&
         shown.indexOf('A EXECUTES') >= 0;
})());
// --- v3 Group A: ten-minutes-one-tap, leak of the week, you-vs-you, privacy ---
ok('"the ten" is core drills capped at ten minutes, never more than the promise', (function () {
  var bad = [];
  Object.keys(FOCI).forEach(function (k) {
    var F = FOCI[k]; if (!F.drills || !F.drills.length) return;
    var plan = { profile: {}, weekly: {} };
    var list = tenList(F, plan), mins = tenMins(F, plan);
    if (!list.length) { bad.push(k + ':empty'); return; }        // must always offer something
    if (mins > 10) bad.push(k + ':' + mins + 'min');             // must never exceed the promise
    if (!list.every(function (it) { return it.d.core || F.drills.filter(function (d) { return d.core; }).length === 0; }))
      bad.push(k + ':non-core');
  });
  if (bad.length) console.log('      ' + bad.join(', '));
  return bad.length === 0;
})());
ok('the five-minute escape hatch is gone — the app promises the ten and now offers it', (function () {
  return html.indexOf('⚡ 5 MIN') < 0 && /DO THE TEN · '\+tenMin\+' MIN/.test(script) &&
         /remain:deloadDur\(list\[0\]\.d,dl\)\*60/.test(script) &&  // no hardcoded 300s any more
         script.indexOf('remain:quick?300') < 0;
})());
ok('the ten is the ONE primary action; the full session is secondary', (function () {
  return /\.tenbtn\{[^}]*min-height:52px/.test(html) && /\.tenbtn\{[^}]*background:var\(--acc\)/.test(html) &&
         /class="tenbtn facet"/.test(script) &&
         /\.fullbtn\{[^}]*background:transparent/.test(html);   // secondary carries no accent fill
})());
ok('leak of the week names the cause you actually logged most, with its real share', (function () {
  var st = { reviews: {} };
  var k = dateKey(new Date());
  st.reviews[k] = { aim: 2, pos: 7, util: 1 };                  // 10 logged, position dominant
  var L = leakOfWeek(st);
  return L && L.k === 'pos' && L.label === 'Position' && L.n === 7 && L.total === 10 && L.pct === 70 &&
         /Position/.test(leakCard(st)) && /70%/.test(leakCard(st)) && /7 of 10/.test(leakCard(st));
})());
ok('leak of the week stays silent until there is enough logged to mean anything', (function () {
  var st = { reviews: {} };
  st.reviews[dateKey(new Date())] = { aim: 2 };                 // only 2 deaths logged
  return leakOfWeek(st) === null && leakCard(st) === '' && leakCard({ reviews: {} }) === '';
})());
ok('it reads a 7-day window, not all time', (function () {
  var st = { reviews: {} };
  var old = new Date(); old.setDate(old.getDate() - 30);
  st.reviews[dateKey(old)] = { aim: 50 };                       // old, out of window
  st.reviews[dateKey(new Date())] = { pos: 6 };
  var L = leakOfWeek(st);
  return L && L.k === 'pos' && L.total === 6;
})());
ok('Progress states you-vs-you and the app has no leaderboard anywhere', (function () {
  var y = youVsYou();
  // this used to pin the source adjacency `youVsYou()+insightsCard`, which broke the moment
  // the cards were reordered even though the claim was still rendered. Assert that it is IN
  // the Progress assembly, not who it happens to sit next to.
  var assembly = script.slice(script.indexOf('function htmlProgress('));
  assembly = assembly.slice(0, assembly.indexOf('\n  function ', 10));
  var rendered = /return hd\+[\s\S]*?youVsYou\(\)/.test(assembly);
  return /no leaderboard/i.test(y) && /own past/i.test(y) && rendered &&
         !/leaderboard/i.test(html.replace(/no leaderboard/ig, ''));   // only ever mentioned to deny it
})());
ok('the privacy card states all four claims and the line only a free app can write', (function () {
  var m = html.match(/NOTHING LEAVES THIS DEVICE[\s\S]{0,900}/);
  var s = m ? m[0] : '';
  return /No account/.test(s) && /No server/.test(s) && /No telemetry/.test(s) &&
         /Backups are yours and manual/.test(s) &&
         /Paid coaching apps cannot say this/.test(s);
})());

// --- v3 Group C: plan intelligence ---
(function () {
  function planAt(week) { // a plan whose programme week is `week`
    var created = new Date(); created.setDate(created.getDate() - (week - 1) * 7);
    return { weekly:{0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match'},
             keystone:'cstrafe', used:['cstrafe'], profile:{}, created: dateKey(created) };
  }
  ok('deload lands on every 4th programme week and nowhere else', (function () {
    var hits = [];
    for (var w = 1; w <= 12; w++) if (isDeloadWeek({ plan: planAt(w), settings:{} }, new Date())) hits.push(w);
    return hits.join(',') === '4,8,12';
  })());
  ok('deload HALVES the real load — the card cannot quote a lighter session than it runs', (function () {
    var F = FOCI.cstrafe, plan = planAt(4);
    var normal = focusMins(F, plan, false), light = focusMins(F, plan, true);
    // every drill halves (rounded, min 1), and the session timer uses the same function
    var perDrill = F.drills.every(function (d) { return deloadDur(d, true) === Math.max(1, Math.round((d.dur||1)/2)); });
    var card = deloadCard({ plan: plan, settings:{} }, F, plan, new Date());
    return perDrill && light < normal && light > 0 &&
           card.indexOf(light + ' min today, against ' + normal) >= 0 &&
           // the session's own deload flag must be DERIVED, not a literal, or the card can
           // advertise a halved load the timer quietly ignores
           /var dl=isDeloadWeek\(st,new Date\(\)\);/.test(script) &&
           /remain:deloadDur\(list\[0\]\.d,dl\)\*60/.test(script) &&        // start of session
           /SESS\.remain=deloadDur\(SESS\.list\[SESS\.idx\]\.d,SESS\.deload\)\*60/.test(script);  // and each advance
  })());
  ok('deload says nothing on a normal week', (function () {
    return deloadCard({ plan: planAt(3), settings:{} }, FOCI.cstrafe, planAt(3), new Date()) === '';
  })());
  ok('"why this drill" cites only what we actually know, and flags the optional ones', (function () {
    var st = { plan: planAt(2), sessions:{}, settings:{}, reviews:{}, lineups:{} };
    var F = FOCI.cstrafe, core = F.drills.filter(function (d) { return d.core; })[0];
    var opt = F.drills.filter(function (d) { return !d.core; })[0];
    var src = whySource(st, F, planAt(2));
    var pCore = whyPanel(st, F, core, planAt(2));
    var pOpt = opt ? whyPanel(st, F, opt, planAt(2)) : '';
    return /Quiz · your keystone/.test(src) &&           // cstrafe IS the keystone here
           /WHY THIS DRILL/.test(pCore) && pCore.indexOf('optional') < 0 &&
           (!opt || /does not cost you the day/.test(pOpt));
  })());
  ok('the why button is a SIBLING of the tick, never nested inside it', (function () {
    // nesting is invalid HTML and is exactly how opening an explanation ticks the drill off
    var wrap = script.indexOf('class="drowwrap');
    var order = /<div class="drowwrap[\s\S]{0,900}?<button class="drow"[\s\S]{0,900}?<\/button>'\+[\s\S]{0,200}?data-why=/;
    return wrap >= 0 && order.test(script);
  })());
  ok('"aim is not the bottleneck" uses the audit\'s OWN rows and introduces no new number', (function () {
    var st = { plan: planAt(5), reviews:{}, sessions:{}, settings:{} };
    st.plan.profile = { weak: 'aim' };
    st.reviews[dateKey(new Date())] = { aim: 6, pos: 8, info: 4, trade: 2 };   // 20 total, 14 before-aim
    var h = bottleneckCard(st);
    return /70%/.test(h) && /8 holding a losing angle/.test(h) && /4 with no information/.test(h) &&
           /2 with nobody to trade/.test(h) && /out of 20/.test(h) &&
           /You said aim\. Your deaths say position\./.test(h);
  })());
  ok('it stays silent when the data agrees with the player, or when there is too little of it', (function () {
    var agree = { plan: planAt(5), reviews:{}, sessions:{}, settings:{} };
    agree.plan.profile = { weak:'aim' };
    agree.reviews[dateKey(new Date())] = { aim: 16, pos: 2, info: 1, trade: 1 };   // aim really is it
    var thin = { plan: planAt(5), reviews:{}, sessions:{}, settings:{} };
    thin.plan.profile = { weak:'aim' };
    thin.reviews[dateKey(new Date())] = { pos: 4 };
    var notAim = { plan: planAt(5), reviews:{}, sessions:{}, settings:{} };
    notAim.plan.profile = { weak:'utility' }; notAim.plan.keystone = 'utility';
    notAim.reviews[dateKey(new Date())] = { pos: 9, info: 8, trade: 4 };
    return bottleneckCard(agree) === '' && bottleneckCard(thin) === '' && bottleneckCard(notAim) === '';
  })());
  ok('the tilt card claims NO prediction and invents no rating drop', (function () {
    var st = { sessions:{}, plan: planAt(3), settings:{} };
    var late = new Date(); late.setHours(23, 40, 0, 0);
    st.sessions[dateKey(late)] = { losses: 2 };
    var h = tiltCard(st, late);
    return /Two losses, and it is 23:40/.test(h) &&
           /not something anyone can tell you/.test(h) &&
           !/predict/i.test(h) && !/rating/i.test(h) && !/\bwill lose\b/i.test(h) &&
           /DO THE TEN INSTEAD/.test(h) && /QUEUE ANYWAY/.test(h);
  })());
  ok('the tilt card needs BOTH conditions — two losses and late — or it stays quiet', (function () {
    var st = { sessions:{}, plan: planAt(3), settings:{} };
    var late = new Date(); late.setHours(23, 40, 0, 0);
    var early = new Date(); early.setHours(20, 0, 0, 0);
    st.sessions[dateKey(late)] = { losses: 1 };
    var oneLossLate = tiltCard(st, late);
    st.sessions[dateKey(early)] = { losses: 3 };
    var manyLossesEarly = tiltCard(st, early);
    return oneLossLate === '' && manyLossesEarly === '';
  })());
  ok('off-plan work is recorded and explicitly not counted against you', (function () {
    var st = { offPlan:{}, sessions:{}, settings:{} };
    var empty = offPlanCard(st, 'D');
    st.offPlan['D'] = [{ k:'dm' }, { k:'scrim' }];
    var full = offPlanCard(st, 'D');
    // the status shell uppercases via CSS, so the literal string is sentence case now
    return /not counted against you/i.test(empty) && OFFPLAN.length === 5 &&
           /Deathmatch/.test(full) && /Scrim/.test(full) &&
           (full.match(/data-offdel=/g) || []).length === 2 &&
           /never counts as a missed day or a completed one/.test(empty);
  })());
})();

// --- v3 status language: five roles, one shell, no sixth ---
ok('there are exactly five status roles and one 22px shell', (function () {
  return ST_ROLES.join(',') === 'live,idle,cap,due,warn' &&
         /\.st\{[^}]*height:22px/.test(html) &&
         ST_ROLES.every(function (r) { return new RegExp('\\.st\\.' + r + '\\{').test(html); });
})());
ok('an unknown role falls back rather than inventing a sixth treatment', (function () {
  var made = statusChip('sparkly', 'Whatever');
  return /class="st cap"/.test(made) && made.indexOf('sparkly') < 0;
})());
ok('idle is a HOLLOW dot and is never red — nothing is broken', (function () {
  return /\.st\.idle\{[^}]*color:var\(--faint\)/.test(html) &&
         /\.st\.idle i\{border:1px solid var\(--faint\)\}/.test(html.replace(/;\s*\}/g, '}')) &&
         !/\.st\.idle[^}]*var\(--bad\)/.test(html);
})());
ok('capability carries NO colour — a second hue would read as a second accent', (function () {
  var m = html.match(/\.st\.cap\{([^}]*)\}/);
  var rule = m ? m[1] : '';
  return rule && !/--good|--bad|--acc/.test(rule) && /--muted/.test(rule) &&
         statusChip('cap', 'Auto-logged').indexOf('<i') < 0;   // and no status dot either
})());
ok('the ad-hoc chips I invented are gone — status goes through the shell', (function () {
  // live/idle are chosen by a ternary at the call site, so match the role strings passed in
  return /statusChip\(live\?"live":"idle"/.test(script) &&
         /statusChip\("cap"/.test(script) && /statusChip\("due"/.test(script) &&
         // and the old inline status colouring for the connection state is gone
         script.indexOf('"● CONNECTED":"○ NOT DETECTED"') < 0;
})());
ok('no second status vocabulary: every chip-SHAPED rule is .st or is a control', (function () {
  // The previous version of this guard named .adchip and .ofchip explicitly — a whitelist of
  // the two I happened to remember — so .chip, .chip.opt, .wstag, .wsinst and .wsmiss all
  // sailed past it and the maps screen kept a whole parallel vocabulary. Match by SHAPE, not
  // by name: a tiny tracked label with its own enclosure IS a chip whatever it's called.
  // Controls are exempt (they carry cursor:pointer or are button/a rules) — a chip is inert.
  var re = /([^{}@]+)\{([^}]*)\}/g, m, bad = [];
  while ((m = re.exec(css))) {
    var sel = m[1].trim().replace(/\s+/g, ' ').replace(/\/\*[\s\S]*?\*\//g, '').trim(), b = m[2];
    var size = b.match(/font-size:\s*([\d.]+)px/);
    if (!size || +size[1] > 11) continue;                   // chips are tiny
    if (!/letter-spacing/.test(b)) continue;                // and tracked
    if (!/(^|;)\s*(border|background)\s*:|border-color\s*:/.test(b)) continue;   // and enclosed
    if (/cursor:\s*pointer/.test(b) || /\b(button|a|input|select)\b/.test(sel)) continue;
    if (/^\.st\b/.test(sel)) continue;                      // the one sanctioned shell
    bad.push(sel);
  }
  if (bad.length) console.log('      rival chip shells: ' + bad.join(', '));
  return bad.length === 0;
})());
ok('--line2 never PAINTS anything — it is a ~1.6:1 divider, not a colour', (function () {
  // Twice now this token has hidden something. First it outlined transparent buttons whose
  // only affordance was that border. Then — the one the user actually noticed — it filled
  // the history bars: .bfill measured 1.65:1 dark / 1.55:1 light, so "Sessions / week, last
  // 8 weeks" drew ONE accent bar and SEVEN ghosts and read as an empty panel.
  // So the rule is now absolute rather than a list of the misuses I happened to find:
  // --line2 may appear only in a directional border (a hairline divider). It may never be a
  // background, a full border, or a border-color. --edge (3.4-4.2:1) is the visible one.
  var bad2 = (css.match(/(?:background(?:-color)?|border(?:-color)?)\s*:[^;}]*var\(--line2\)/g) || []);
  if (bad2.length) console.log('      --line2 painting: ' + bad2.join(' | '));
  return bad2.length === 0 && /--edge\s*:/.test(css);
})());
ok('Progress card order: milestones open, achievements close, and the leak follows its audit', (function () {
  // "Derived from the audit above" was rendering ABOVE the audit — the copy was telling a lie
  // about the page, which is an ordering bug with a factual consequence, not a taste one.
  var a = script.slice(script.indexOf('function htmlProgress('));
  a = a.slice(0, a.indexOf('\n  function ', 10));
  var ret = (a.match(/return hd\+[\s\S]*?glossary\(\);/) || [''])[0];
  function at(name) { return ret.indexOf(name); }
  var milestones = at('milestoneRail('), insights = at('insightsCard('),
      audit = at('deathCard('), leak = at('leakCard('),
      badges = at('milestonesCard('), share = at('sharePreview(');
  var found = [milestones, insights, audit, leak, badges, share].every(function (i) { return i >= 0; });
  if (!found) { console.log('      missing from the assembly: ' + JSON.stringify({ milestones: milestones, insights: insights, audit: audit, leak: leak, badges: badges, share: share })); return false; }
  return milestones < insights &&        // the "where am I" anchor opens the screen
         audit < leak &&                 // the leak is derived from the audit ABOVE it
         insights < badges && leak < badges &&   // trophies close, they do not interrupt
         share < badges &&                       // share card, then the badges, as in the art
         /Derived from the audit above/.test(script);
})());
ok('RESUME NOW keeps the promise the pause card made — the streak survives it', (function () {
  // settings.pause was the ONLY record of a pause, and RESUME NOW deleted it. That did not
  // end the pause going forward, it erased the days already served and turned them into
  // ordinary missed training days. Measured on a 16-day streak paused for two weeks: one
  // click took the held streak to 0, spent both freezes, dropped adherence 100% -> 58% and
  // popped the WELCOME BACK lapse card — right after the card said "held, not broken".
  var plan = generatePlan({ rank: 'good', weapon: 'rifle', role: 'entry', weak: ['cstrafe'], time: '10', days: '4', goal: 'consistency' });
  plan.created = '2026-01-05'; plan.startedOn = '2026-01-05';
  var st = { plan: plan, sessions: {}, settings: {}, metrics: {}, matches: {}, lineups: {}, reviews: {} };
  var start = new Date(2026, 0, 5);
  for (var w = 0; w < 4; w++) for (var o = 0; o < 7; o++) {
    var d = new Date(start); d.setDate(d.getDate() + w * 7 + o);
    if (isTrainingDay(plan, d)) st.sessions[dateKey(d)] = { warm: true };
  }
  st.settings.pause = { from: '2026-01-30', weeks: 2 };
  var now = new Date(2026, 1, 9);
  var before = streakDetail(st, now, freezeBudget(st)), bestBefore = bestStreak(st);
  // close the pause the way the handler now does
  var p = pauseInfo(st);
  st.settings.pause = { from: p.fromKey, weeks: p.weeks, endedOn: dateKey(now) };
  var after = streakDetail(st, now, freezeBudget(st));
  var held = before.days === 16 && after.days === before.days && after.spent === before.spent;
  var bestKept = bestStreak(st) === bestBefore;
  var noLapse = !lapseInfo(st, now);
  // the served window must still read as paused; today onward must not
  var servedStillPaused = isPausedOn(st, new Date(2026, 1, 2));
  var todayLiveAgain = !isPausedOn(st, now);
  if (!held || !bestKept || !noLapse) console.log('      before=' + JSON.stringify(before) + ' after=' + JSON.stringify(after) + ' best ' + bestBefore + '->' + bestStreak(st));
  return held && bestKept && noLapse && servedStillPaused && todayLiveAgain &&
         // and the record is closed, never deleted
         /s2\.settings\.pause=\{from:p\.fromKey,weeks:p\.weeks,endedOn:dateKey\(now\)\}/.test(script) &&
         script.indexOf('delete s2.settings.pause') < 0;
})());
ok('the streak walk floors on startedOn, which a resumed pause never moves', (function () {
  // plan.created is the PROGRAMME CLOCK and gets pushed forward on every resume, so flooring
  // history on it let a pause retroactively truncate the past — an all-time best of 16 became
  // 9, the exact failure bestStreak exists to prevent.
  var fn = script.slice(script.indexOf('function streakDetail('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  return /st\.plan\.startedOn\|\|st\.plan\.created/.test(fn) &&
         // and it must actually be stamped, or the fallback silently restores the old bug
         /plan\.startedOn=\(st\.plan&&\(st\.plan\.startedOn\|\|st\.plan\.created\)\)\|\|plan\.created/.test(script);
})());
ok('a normal weekend is NOT a lapse — the quiet week never fires on a perfect user', (function () {
  // The bug: quietWeek measured the gap in CALENDAR days while lapseInfo — the app's other,
  // correct detector — counts MISSED TRAINING DAYS. On the default 4-day plan a perfect week
  // has a Thu->Mon gap of 4 calendar days and zero missed training days, so `4 < LAPSE_MIN+1`
  // was false and every Monday armed a quiet week. QUIET_DAYS is 4 and there are 4 training
  // days a week, so it re-armed before it could expire: from week two onward every user was
  // permanently on core-only drills, told "a lighter week back" on days they never missed.
  // Measured before the fix: fired on 12 of 16 perfectly-trained days.
  var plan = generatePlan({ rank: 'good', weapon: 'rifle', role: 'entry', weak: ['cstrafe'], time: '10', days: '4', goal: 'consistency' });
  plan.created = '2026-01-05';
  var st = { plan: plan, sessions: {}, settings: {}, metrics: {}, matches: {}, lineups: {}, reviews: {} };
  var start = new Date(2026, 0, 5), fired = 0, total = 0;
  for (var w = 0; w < 4; w++) for (var off = 0; off < 7; off++) {
    var d = new Date(start); d.setDate(d.getDate() + w * 7 + off);
    if (!isTrainingDay(plan, d)) continue;
    st.sessions[dateKey(d)] = { warm: true };
    total++; if (quietWeek(st, d)) fired++;
  }
  // and a REAL lapse must still be caught, or the fix has just deleted the feature
  var st2 = { plan: plan, sessions: {}, settings: {}, metrics: {}, matches: {}, lineups: {}, reviews: {} };
  st2.sessions['2026-01-05'] = { warm: true };
  st2.sessions['2026-01-06'] = { warm: true };
  st2.sessions['2026-01-26'] = { warm: true };        // back after three weeks away
  var realLapse = quietWeek(st2, new Date(2026, 0, 26));
  if (fired) console.log('      quiet week fired on ' + fired + ' of ' + total + ' perfect days');
  // slice to the END of the function, not a fixed character count — the explanatory comment
  // above the loop pushed the code past a 1200-char window and the check silently read blank
  var fn = script.slice(script.indexOf('function quietWeek('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  return total === 16 && fired === 0 && !!realLapse &&
         // it must count the same thing lapseInfo counts, not calendar days
         /isTrainingDay\(plan,d\)&&!isPausedOn\(st,d\)\)missed\+\+/.test(fn) &&
         fn.indexOf('gapDays') < 0;
})());
ok('a round is recorded once, and a re-post of the same round is not a second round', (function () {
  // CS2 can re-post an edge, and round numbers repeat every match — so neither the round
  // number nor the map alone is a key. Same map+round inside two minutes is one round.
  var st = {}, dk = dateKey(new Date()), now = Date.now();
  var r = { round: 5, map: 'de_mirage', died: true, deathMs: 14200, buyMoney: 800, buyEquip: 3600, leftOver: 650, roundKills: 1, won: false };
  applyGsiRound(st, r, dk, now);
  applyGsiRound(st, r, dk, now + 1000);            // duplicate post
  var once = st.rounds.length === 1;
  applyGsiRound(st, r, dk, now + 200000);          // same round number, a later match
  var laterMatchCounts = st.rounds.length === 2;
  // a different round in the same match is always its own record
  applyGsiRound(st, { round: 6, map: 'de_mirage', died: false, buyMoney: 4200, buyEquip: 200, roundKills: 0, won: true }, dk, now + 210000);
  return once && laterMatchCounts && st.rounds.length === 3;
})());
ok('the audit stores facts and never a verdict, and stays bounded', (function () {
  var st = {}, dk = dateKey(new Date()), now = Date.now();
  applyGsiRound(st, { round: 1, map: 'de_dust2', died: true, deathMs: 9000, buyMoney: 1150, buyEquip: 4200, leftOver: 2300, roundKills: 0, won: false }, dk, now);
  var rec = st.rounds[0];
  // every field is something that happened; nothing here is an opinion about it
  var factsOnly = Object.keys(rec).every(function (k) { return ['s', 'd', 'at', 'x', 'ms', 'bm', 'be', 'lo', 'k', 'w'].indexOf(k) >= 0; });
  // unknown outcome must be null, never false — false would read as a lost round
  applyGsiRound(st, { round: 2, map: 'de_dust2', died: false, buyMoney: 800, buyEquip: 0, roundKills: 0, won: null }, dk, now + 1);
  var unknownIsNull = st.rounds[1].w === null;
  // and it cannot grow without bound in a 5MB localStorage budget
  for (var i = 0; i < ROUND_CAP + 40; i++) {
    applyGsiRound(st, { round: i, map: 'de_x' + i, died: false, buyMoney: 0, buyEquip: 0, roundKills: 0, won: true }, dk, now + 1000 + i);
  }
  return factsOnly && unknownIsNull && st.rounds.length === ROUND_CAP;
})());
ok('the audit stays silent until it has seen enough, and reports counts not conclusions', (function () {
  var st = { rounds: [] }, dk = dateKey(new Date()), now = Date.now();
  function add(n, died, ms, kills, left) {
    for (var i = 0; i < n; i++) st.rounds.push({ s: 'm#' + (st.rounds.length), d: dk, at: now + i,
      x: died ? 1 : 0, ms: died ? ms : null, bm: 800, be: 3600, lo: left || 0, k: kills || 0, w: 0 });
  }
  add(5, true, 9000, 0, 0);
  var quietEarly = autoAuditCard(st) === '';        // 5 rounds proves nothing
  add(25, true, 9000, 0, 2400);
  var h = autoAuditCard(st);
  var s = roundStats(st, 60);
  var speaksLater = h.length > 0 && s.rounds === 30 && s.early === 30 && s.deaths === 30;
  // it must frame itself as observation — the coaching claim is not earned yet
  var honest = /observations, not advice/.test(h) && /you did not log any of it/.test(h) &&
               !/you are|too early|should have|stop /i.test(h);
  return quietEarly && speaksLater && honest && AUDIT_MIN_ROUNDS >= 20;
})());
ok('the backup nudge fires only where data can actually be lost, and only once it matters', (function () {
  // "No account" is a promise; this is its cost. Desktop mirrors state to a file on every
  // save, so the nudge must NEVER appear there — a warning that fires when the risk is not
  // real is how people learn to dismiss the one that is.
  var now = new Date();
  function withSessions(n, extra) {
    var st = { sessions: {}, settings: extra || {} };
    for (var i = 0; i < n; i++) { var d = new Date(now); d.setDate(d.getDate() - i); st.sessions[dateKey(d)] = { warm: true }; }
    return st;
  }
  var quietEarly = !needsBackup(withSessions(3), now);          // 3 sessions: an evening, not a season
  var firesLater = needsBackup(withSessions(20), now);          // enough work to hurt
  // an export silences it, and a stale one brings it back
  var fresh = withSessions(20, { lastExport: dateKey(now) });
  var stale = (function () { var d = new Date(now); d.setDate(d.getDate() - 40);
    return withSessions(20, { lastExport: dateKey(d) }); })();
  var silencedByExport = !needsBackup(fresh, now);
  var returnsWhenStale = needsBackup(stale, now);
  // "not now" snoozes rather than switching it off forever
  var snoozed = withSessions(20, { bkSnooze: dateKey(now) });
  var oldSnooze = (function () { var d = new Date(now); d.setDate(d.getDate() - 30);
    return withSessions(20, { bkSnooze: dateKey(d) }); })();
  var snoozeWorks = !needsBackup(snoozed, now) && needsBackup(oldSnooze, now);
  // and the card names the real stake rather than saying "back up your data"
  var card = backupCard(withSessions(20), now);
  var namesTheStake = /live in this browser and nowhere else/.test(card) &&
                      /Clearing site data would take all of it/.test(card) && /20 sessions/.test(card);
  // BOTH buttons must be reachable from wire(), which is what actually runs on every render.
  // The export button originally reused data-rec="export" — an attribute wired ONLY inside the
  // RECOVER screen's own renderer — so the one safeguard against losing everything was a dead
  // control. Assert the attribute this card uses is handled in wire(), not merely present.
  var wired = /\[data-bkexport\]/.test(script) && /\[data-bkdismiss\]/.test(script) &&
              /bke\.onclick=function\(\)\{exportData\(\);/.test(script) &&
              card.indexOf('data-rec=') < 0;
  return quietEarly && firesLater && silencedByExport && returnsWhenStale && snoozeWorks && namesTheStake && wired &&
         /if\(isNative\)return false;/.test(script.slice(script.indexOf('function needsBackup(')));
})());
ok('what-changed never greets a brand-new user, and a silent patch stays silent', (function () {
  // Someone who just installed has nothing "new" to be told about; showing them a changelog
  // for the version they arrived at is noise dressed as a feature.
  var fresh = whatsNew({ settings: {} });
  var upgraded = whatsNew({ settings: { seenVersion: '0.0.1' } });
  // must be the CURRENT version, not WHATSNEW's first key — those stopped being the same
  // thing the moment the changelog held more than one entry, and the test quietly broke
  var current = whatsNew({ settings: { seenVersion: VERSION } });
  var noEntry = whatsNew({ settings: { seenVersion: '0.0.1' } });
  // first load stamps the version, so the NEXT update has something to compare against
  var st = { settings: {} };
  var stamped = markVersionSeen(st) === true && !!st.settings.seenVersion;
  var doesNotRestamp = markVersionSeen(st) === false;
  // skipping releases must not swallow them: an upgrade across several versions shows all
  // of their entries, not just the one for the version you landed on
  var spans = newSince('0.0.1');
  var ordered = spans.slice().sort(vcmp).join(',') === spans.join(',');
  var neverFuture = spans.every(function (v) { return vcmp(v, VERSION) <= 0; });
  return fresh === '' &&                                  // brand new: silent
         current === '' &&                                // already on it: silent
         stamped && doesNotRestamp && ordered && neverFuture &&
         vcmp('0.9.0', '0.10.0') < 0 &&                   // numeric, not lexical
         (Object.keys(WHATSNEW).length === 0 || typeof noEntry === 'string') &&
         /if\(!seen\)return "";/.test(script) &&
         /if\(!vs\.length\)return "";/.test(script);   // nothing since your version, no card
})());
ok('the core-left count reflects CORE drills only, and vanishes when the work is done', (function () {
  // "0 CORE LEFT" is a worse way of saying the day is finished, so it must hide rather than
  // render a zero — and it must not count the optional drill, which is the whole point.
  var src = script.slice(script.indexOf('var coreLeft=0;'));
  src = src.slice(0, src.indexOf('body=') + 400);
  return /shown\[ci\]\.d\.core&&!dstate\[shown\[ci\]\.i\]/.test(src) &&   // core AND not done
         /coreLeft\?'<span class="divitag">'\+coreLeft\+' CORE LEFT<\/span>':''/.test(src) &&
         /\.divitag\{order:3/.test(css);       // rides the divider, after the hairline
})());
ok('off-plan work is shown BACK, and never invents a duration it did not record', (function () {
  var st = { offPlan: {} }, now = new Date();
  function k(d) { return dateKey(d); }
  var d2 = new Date(now); d2.setDate(d2.getDate() - 2);
  var d5 = new Date(now); d5.setDate(d5.getDate() - 5);
  st.offPlan[k(d2)] = [{ k: 'dm' }];
  st.offPlan[k(d5)] = [{ k: 'scrim' }];
  var rows = offPlanRecent(st, dateKey(now), 14);
  var labelled = rows.length === 2 && rows[0].label === 'Deathmatch' && rows[1].label === 'Scrim / team';
  var dayNamed = rows.every(function (r) { return typeof r.day === 'string' && r.day.length > 0; });
  // today is excluded — it is already shown as pills directly below
  var excludesToday = (function () {
    var s2 = { offPlan: {} }; s2.offPlan[k(now)] = [{ k: 'dm' }];
    return offPlanRecent(s2, dateKey(now), 14).length === 0;
  })();
  // the art shows a duration per session; we do not capture one, so none is printed
  var fn = script.slice(script.indexOf('function offPlanHistory('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  var noFakeDuration = !/\bm<\/|minutes|mins/.test(fn);
  return labelled && dayNamed && excludesToday && noFakeDuration;
})());
ok('a gear tile is a real value or an honest blank, never a guess', (function () {
  var fn = script.slice(script.indexOf('function gearTiles('));
  fn = fn.slice(0, fn.indexOf('\n  var XHAIR_DYNAMIC'));
  // the em-dash placeholder plus a pointer to where the value comes from
  var blanks = /\(has\?esc\(val\):'—'\)/.test(fn) && /has\?'':'<div class="gth">'/.test(fn);
  // and the source chip distinguishes "read from your config" from "you typed this"
  var sourced = /FROM CFG/.test(fn) && /YOURS/.test(fn);
  return blanks && sourced && /\.gtile\{/.test(css) && /clip-path:var\(--facet\)/.test(css);
})());
ok('the plan-in-one-screenshot prints only numbers the app already holds', (function () {
  var st = { sessions: {}, settings: {}, plan: { weekly: { 0: 'cstrafe' }, used: ['cstrafe', 'utility'],
             keystone: 'cstrafe', created: dateKey(new Date()), targets: [] } };
  var h = planShot(st);
  var cells = (h.match(/class="pscell"/g) || []).length;
  return cells === 4 && /CROP HERE/.test(h) &&
         /class="psk">STREAK<\/div><div class="psv">0</.test(h) &&   // real streak, not a placeholder
         /FOCUS<\/span> Counter-strafing/.test(h) &&
         planShot({ settings: {} }) === '';        // no plan, no block
})());
ok('the sessions chart draws the weekly target it is judged against', (function () {
  var withTarget = barChart([1, 2, 3, 4], { target: 5 });
  var without = barChart([1, 2, 3, 4], {});
  // the target must also lift the axis, or a target above every bar would sit off the chart
  var lifted = /style="bottom:100.0%"/.test(withTarget);
  return /class="btarget"/.test(withTarget) && /target 5/.test(withTarget) && lifted &&
         without.indexOf('btarget') < 0 &&
         /\.btarget\{[^}]*border-top:1px dashed var\(--edge\)/.test(css);
})());
ok('the share card is previewed before it is sent, and copy degrades honestly', (function () {
  // The app's own copy says it spreads by being posted. You used to click SAVE PNG blind,
  // get a file, then go find it and attach it. The preview renders the SAME canvas the
  // buttons produce, so what you see is what you send.
  var fn = script.slice(script.indexOf('function sharePreview('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  // The <img> src must still be the PNG of the canvas shareCard() built — that is the whole
  // "what you see is what you send" claim. It is now encoded once and cached (toDataURL is a
  // synchronous encode that used to run on every Progress render), so assert the chain:
  // shareCard -> toDataURL -> the cached url -> the img.
  var sameCanvas = /var c=shareCard\(st\);/.test(fn) &&
                   /src=c\.toDataURL\("image\/png"\);_shareSig=sig;_shareUrl=src;/.test(fn) &&
                   /src="'\+src\+'"/.test(fn);
  // shareCard now RETURNS the canvas instead of downloading it — that split is the feature
  var gen = script.slice(script.indexOf('function shareCard('));
  gen = gen.slice(0, gen.indexOf('\n  function ', 10));
  var pureGen = /return c;/.test(gen) && gen.indexOf('a.download') < 0 && gen.indexOf('.click()') < 0;
  // ClipboardItem is absent on older webviews and any non-secure origin. The button must be
  // HIDDEN there rather than offered and failing, and the failure paths must say what to do.
  var guarded = /window\.ClipboardItem&&navigator\.clipboard&&navigator\.clipboard\.write/.test(fn);
  var cp = script.slice(script.indexOf('function shareCardCopy('));
  cp = cp.slice(0, cp.indexOf('\n  // the preview'));
  var tellsYouWhy = /can’t copy images/.test(cp) && /Clipboard was blocked/.test(cp) &&
                    /use SAVE PNG instead/.test(cp);
  // toBlob and the clipboard promise can both hang forever on a throttled or unfocused
  // webview — I hit exactly that trying to verify this. A button that does nothing AND says
  // nothing is the worst of the three outcomes, so every path must settle exactly once.
  var cannotHang = /var settled=false/.test(cp) && /if\(settled\)return; settled=true/.test(cp) &&
                   /setTimeout\(function\(\)\{finish\(false,"Copying timed out/.test(cp);
  if (!cannotHang) console.log('      the copy path can hang silently');
  return sameCanvas && pureGen && guarded && tellsYouWhy && cannotHang &&
         /data-sharecopy/.test(fn) && /data-sharecard/.test(fn);
})());
ok('the twelve-week grid is the zoom-OUT: it follows the charts, never precedes them', (function () {
  var fn = script.slice(script.indexOf('function insightsCard('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  var ret = (fn.match(/return '<div class="divi">[\s\S]*?;/) || [''])[0];
  return ret.indexOf('rows') >= 0 && ret.indexOf('heatmap(') >= 0 &&
         ret.indexOf('rows') < ret.indexOf('heatmap(') &&
         ret.indexOf('data-sharecard') < 0;      // the share button no longer strands mid-screen
})());
ok('the settings audit never invents a setting CS2 does not have', (function () {
  // The reference art carries a "Raw input — Off — TURN IT ON" row. `m_rawinput` was removed
  // from CS2; raw input is always on and the cvar is absent from every config file on disk
  // (verified against a real cs2_user_convars_0_slot0.vcfg). Shipping that row would be
  // advice about a setting the game does not have — the same class of mistake as the radar
  // view-cone claim. Nor do we assert a "pros sit 700-1100" range we cannot source.
  // Scope to what is RENDERED, not to the source — the comment above settingsAudit explains
  // the absence and names the cvar, and a whole-file search flagged the explanation itself.
  var fn = script.slice(script.indexOf('function settingsAudit('));
  fn = fn.slice(0, fn.indexOf('\n  /* ---------- v0.7: loadout vault'));
  var body = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // match raw_input / rawinput / "raw input" — the first version of this guard checked only
  // the unseparated spelling and sailed past a `raw_input: Option<String>` added back to the
  // Rust struct. Caught by falsifying it, which is the only reason I know.
  var RAW = /raw[_\s-]?input/i;
  var noFakeRow = !RAW.test(body);
  var noUnsourcedRange = !/700\s*[-–]\s*1100/.test(body);
  // and the Rust side must not carry the field either, or it would drift back in
  var rust = fs.readFileSync(path.join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');
  var rustStruct = (rust.match(/struct CsConfig \{[\s\S]*?\n\}/) || [''])[0].replace(/\/\/.*$/gm, '');
  var noRustField = !RAW.test(rustStruct);
  return noFakeRow && noUnsourcedRange && noRustField;
})());
ok('the audit only reports values it actually read, and reads dynamic vs static right', (function () {
  // styles 0/2/3 are dynamic, 1/4/5 static — the distinction the coaching hangs on
  var dyn = ['0', '2', '3'].every(function (s) { return !!XHAIR_DYNAMIC[s]; });
  var stat = ['1', '4', '5'].every(function (s) { return !XHAIR_DYNAMIC[s]; });
  // and with nothing read, the whole card is absent rather than showing defaults
  var empty = settingsAudit({ settings: {} }, {}, null);
  return dyn && stat && empty === '';
})());
ok('SET FOCUS is only offered where a drill focus HONESTLY addresses the leak', (function () {
  // FOCI.placement is CROSSHAIR placement, an aim mechanic. Pointing a "you died out of
  // position" leak at it would look helpful and train the wrong thing, and there is no
  // positional focus in the library. So pos/info/trade must get NO button rather than a
  // plausible one — this guard exists to stop someone filling the gap to make the UI tidy.
  var mapped = Object.keys(LEAK_DRILL);
  var everyMappedIsReal = mapped.length > 0 && mapped.every(function (k) { return !!leakFocus(k); });
  var noFakePositional = !leakFocus('pos') && !leakFocus('info') && !leakFocus('trade');
  // and nothing may map to crosshair placement to paper over the gap
  var noPlacementFallback = mapped.every(function (k) { return LEAK_DRILL[k] !== 'placement'; });
  return everyMappedIsReal && noFakePositional && noPlacementFallback &&
         leakFocus('util') === 'utility' && leakFocus('aim') === 'spray';
})());
ok('SET FOCUS lands on the LAST training day and never clobbers tomorrow', (function () {
  var st = { plan: { weekly: { 0: 'cstrafe', 1: 'rest', 2: 'cstrafe', 3: 'match', 4: 'cstrafe', 5: 'rest', 6: 'rest' }, used: ['cstrafe'] }, settings: {} };
  var before = focusIsSet(st, 'util');
  applyLeakFocus(st, 'util');
  var landed = st.plan.weekly[4] === 'utility' && st.plan.weekly[0] === 'cstrafe' &&
               st.plan.weekly[3] === 'match' && st.plan.weekly[1] === 'rest';
  var tracked = (st.plan.used || []).indexOf('utility') >= 0;
  // an unmapped or unknown cause must not silently corrupt the plan
  var snapshot = JSON.stringify(st.plan.weekly);
  applyLeakFocus(st, 'pos');
  applyLeakFocus(st, 'nonsense');
  return !before && focusIsSet(st, 'util') && landed && tracked &&
         JSON.stringify(st.plan.weekly) === snapshot;
})());
ok('the leak card reads as a sentence: cause, arrow, focus, and the control', (function () {
  var st = { sessions: {}, settings: {}, plan: { weekly: { 0: 'cstrafe', 1: 'cstrafe' }, used: ['cstrafe'] }, reviews: {} };
  st.reviews[dateKey(new Date())] = { util: 4, aim: 1, pos: 1 };   // utility dominant — it maps
  var h = leakCard(st);
  if (!h) { console.log('      leak card did not render'); return false; }
  var sentence = /KILLED YOU MOST/.test(h) && /NEXT WEEK/.test(h) &&
    /class="lwarrow"/.test(h) && /class="leakbig lwfoc">Utility</.test(h) &&
    /data-setfocus="util"/.test(h) &&
    /67% of the deaths you logged — 4 of 6/.test(h) &&       // the raw counts, not just a %
    /Derived from the audit above, not from a fixed syllabus/.test(h);
  applyLeakFocus(st, 'util');
  var h2 = leakCard(st);
  var settled = h2.indexOf('data-setfocus') < 0 && /class="st live"/.test(h2);
  // and an UNMAPPED leak still shows the leak and its written fix, just no button
  var st2 = { sessions: {}, settings: {}, plan: { weekly: { 0: 'cstrafe' }, used: ['cstrafe'] }, reviews: {} };
  st2.reviews[dateKey(new Date())] = { pos: 5, aim: 1 };
  var h3 = leakCard(st2);
  var honest = /KILLED YOU MOST/.test(h3) && h3.indexOf('data-setfocus') < 0 &&
               h3.indexOf('NEXT WEEK') < 0 && /Where you stand is the fix/.test(h3);
  return sentence && settled && honest;
})());
ok('the milestone rungs sit evenly, not at their day value', (function () {
  // 3/7/14/30/60/100 placed linearly crams four of six into the left third and leaves a long
  // dead run to Global — arithmetically honest, useless as a picture. Even spacing reads as
  // "six steps". Assert the positions ARE even, so nobody "fixes" it back to linear.
  var st = { sessions: {}, plan: { weekly: {}, created: dateKey(new Date()) }, settings: {} };
  var h = milestoneRail(st);
  var pos = (h.match(/style="left:([\d.]+)%/g) || []).map(function (s) { return parseFloat(s.match(/([\d.]+)/)[1]); });
  if (pos.length < 2) { console.log('      no positioned rungs'); return false; }
  var step = pos[1] - pos[0], even = pos.every(function (p, i) { return Math.abs(p - i * step) < 0.05; });
  return even && pos[0] === 0 && Math.abs(pos[pos.length - 1] - 100) < 0.05 && pos.length === STREAK_TIERS.length;
})());
ok('the twelve-week heatmap is 7 rows by N weeks, and its ramp actually steps', (function () {
  var fn = script.slice(script.indexOf('function heatmap('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  var rowsFixed = /for\(var d=0;d<7;d\+\+\)/.test(fn);          // days are the fixed axis
  var colsFromData = /for\(var w=weeks-1;w>=0;w--\)/.test(fn);
  // fixed cell size — flex-filled cells blew up to 63px and made a 450px wall of squares
  var sized = /\.hm\{[^}]*width:12px;height:12px/.test(css);
  var flexed = /\.hmcol\{[^}]*flex:0 0 auto/.test(css);
  // and the four levels must be distinct stops, not two of them nearly touching
  var mix = (css.match(/\.hm\.l[123]\{background:[^}]*?(\d+)%,var\(--surface2\)/g) || [])
    .map(function (s) { return +s.match(/(\d+)%/)[1]; });
  var stepped = mix.length === 3 && mix[0] >= 40 && mix[1] - mix[0] >= 20 && mix[2] === undefined ? false : true;
  return rowsFixed && colsFromData && sized && flexed &&
         /\.hm\.l1\{[^}]*45%/.test(css) && /\.hm\.l2\{[^}]*75%/.test(css) && /\.hm\.l3\{background:var\(--acc\)/.test(css);
})());
ok('a trend is a LINE with its own numbers, not an unlabelled sparkline', (function () {
  var out = lineChart([2, 3, 3, 4, 5], { scale: 5, label: 'hand feel', from: 'a', to: 'b' });
  return /<polyline class="lcline"/.test(out) &&
         /<path class="lcfill"[^>]*url\(#/.test(out) &&      // the gradient falloff
         /linearGradient/.test(out) &&
         /class="lclast">5<small>\/5</.test(out) &&           // it carries its own number
         /aria-label="hand feel, latest 5 out of 5"/.test(out) &&
         /<div class="baxis"><span>a<\/span><span>b<\/span>/.test(out) &&
         lineChart([3], {}) === '' && lineChart([], {}) === '';   // one point is not a trend
})());
ok('the desktop rail is identity on top, status at the foot, in that order', (function () {
  // The reference art puts WHO YOU ARE directly under the wordmark and WHERE YOU STAND
  // pinned to the bottom. We had the identity block at the foot and no status block at all,
  // so the streak vanished the moment you left Today — on Maps, Gear and Setup the rail
  // said nothing. Assert the render order, not just that the pieces exist.
  var body = script.slice(script.indexOf('function renderSide('));
  body = body.slice(0, body.indexOf('\n  function ', 10));
  var iBrand = body.indexOf('class="brand"');
  var iTier = body.indexOf('tierIdentity(');
  var iNav = body.indexOf('<nav class="snav"');
  var iRail = body.indexOf('statusRail(');
  var ordered = iBrand >= 0 && iTier > iBrand && iNav > iTier && iRail > iNav;
  if (!ordered) console.log('      order brand/tier/nav/rail = ' + [iBrand, iTier, iNav, iRail].join('/'));
  return ordered;
})());
ok('the status rail carries streak, freeze reserve and anything that wants you', (function () {
  var fn = script.slice(script.indexOf('function statusRail('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  return /class="ml kicker">STATUS/.test(fn) &&
         /class="big-n srn"/.test(fn) &&
         /frzs/.test(fn) && /SHIELD/.test(fn) &&              // the reserve, drawn not described
         /next freeze in/.test(fn) &&
         /statusChip\(live\?"live":"idle"/.test(fn) &&        // and it speaks the status language
         /srdue/.test(fn) && /data-duego/.test(fn) &&         // the due button actually navigates
         /\.srail \.srn\{font-size:44px/.test(css);           // scoped so .big-n cannot outrank it
})());
ok('the active desktop nav item is a solid accent slab with the facet', (function () {
  // I built glass + a 2px tracer rail from the prose; the reference art shows a solid accent
  // fill with the chamfer on every single screen, the same gesture as the mobile dock.
  var rule = (css.match(/\.snav button\.on\{[^}]*\}/) || [''])[0];
  return /background:var\(--acc\)/.test(rule) && /clip-path:var\(--facet\)/.test(rule) &&
         /color:var\(--onAcc\)/.test(rule) &&
         css.indexOf('.snav button.on::before{content:""') < 0;   // the old tracer rail is gone
})());
ok('the tier is the loud line in the rail, not a whisper', (function () {
  // shipped as 8px --faint under a 12px display name — the identity read as the handle, and
  // the tier, which is the thing that changes and that people care about, was the small print.
  var tier = (css.match(/#side \.tiertx small\{[^}]*\}/) || [''])[0];
  var name = (css.match(/#side \.tiername\{[^}]*\}/) || [''])[0];
  function px(r) { var m = r.match(/font-size:([\d.]+)px/); return m ? +m[1] : 0; }
  return px(tier) > px(name) && /--accInk/.test(tier) && /--faint/.test(name);
})());
ok('every touch-reachable control clears 44px, with a SEPARATE desktop variant', (function () {
  // Section 2 names this as an already-shipped bug and it was shipped again: at 375px
  // nineteen control types sat under 44, the worst at 24-30px. Desktop legitimately keeps
  // its denser pointer-only chrome, which is exactly why this needs TWO variants rather
  // than one literal — so assert the touch block exists and actually covers the offenders.
  var block = (css.match(/@media \(max-width:719px\),\(pointer:coarse\)\{[\s\S]*?\n  \}/) || [''])[0];
  if (!block) { console.log('      no touch-target media block at all'); return false; }
  // match the min-height:44px RULE, not the whole block — .mchip also appears in a second
  // rule inside it, so a block-wide indexOf passed while the selector was actually removed
  // from the sizing list. That is the hollow-guard shape, caught by falsifying it.
  var sized = (block.match(/([^{}]*)\{\s*min-height:44px;\s*\}/) || [])[1] || '';
  var must = ['.mchip', '.rtoggle', '.btncopy', '.bftoggle', '.fbtn', '.gbtn', '.pbtn',
              '.startsession', '.iconbtn', '.lndel', '.segctl button'];
  var missing = must.filter(function (sel) { return sized.indexOf(sel) < 0; });
  if (missing.length) console.log('      not in the 44px rule: ' + missing.join(', '));
  return missing.length === 0 && /input\[type="text"\]/.test(block);
})());
ok('standard transitions stay inside the 380-680ms band, on the standard curve', (function () {
  // Section 2 gives 260-450ms. The user asked for the motion to linger — "it looks too good
  // to just have it for a second" — so the band was moved UP deliberately, not widened
  // because something failed. The floor still exists so nothing snaps, and the ceiling still
  // exists so entry motion on every render never feels like waiting for the UI.
  // Ambient and looping motion (spinner, scan, celebration bloom/ping) stays exempt.
  // Exempt: ambient/looping motion, AND the assemble's own frames — that moment is a one-off
  // with its own guard covering its timing, so holding it to the everyday band would be
  // measuring it against the wrong thing.
  var AMBIENT = /v3-spin|lk-scan|lk-blink|lk-ping|v3-bloom|v3-ping|v3-shardA|v3-shardB|v3-roll/;
  var re = /animation:([\w-]+)([^;}]*)/g, m, bad = [];
  while ((m = re.exec(css))) {
    if (AMBIENT.test(m[1])) continue;
    var rest = m[2];
    var times = (rest.match(/(?:^|\s)(\d*\.?\d+)(ms|s)(?=\s|$)/g) || [])
      .map(function (t) { t = t.trim(); return /ms$/.test(t) ? parseFloat(t) : parseFloat(t) * 1000; });
    if (times.length && (times[0] < 380 || times[0] > 680)) bad.push(m[1] + " " + times[0] + "ms");
    if (/\bease(-in|-out|-in-out)?\b/.test(rest) && !/cubic-bezier/.test(rest)) bad.push(m[1] + ' bare ease');
  }
  if (bad.length) console.log('      ' + Array.from(new Set(bad)).join(' | '));
  return bad.length === 0;
})());
ok('the two micro-label roles are distinct and both sit inside the spec type scale', (function () {
  // One .ml class was doing the work of two roles at 11px/0.14em — above the size range of
  // either and below the kicker's tracking. ~50 visible labels carried it, which is most of
  // why the app read chunkier than the prototype without any single label looking wrong.
  //   Data / stat label   --fm  8-10px   400/600  0.12-0.14em
  //   Section kicker      --fm  8-8.5px  400      0.18em
  var base = (css.match(/\.ml\{[^}]*\}/) || [''])[0];
  var kick = (css.match(/\.divi \.ml,\.ml\.kicker\{[^}]*\}/) || [''])[0];
  function px(r) { var m = r.match(/font-size:([\d.]+)px/); return m ? +m[1] : null; }
  function em(r) { var m = r.match(/letter-spacing:([-\d.]+)em/); return m ? +m[1] : null; }
  function wt(r) { var m = r.match(/font-weight:(\d+)/); return m ? +m[1] : null; }
  // The spec bands are 8-10px (stat) and 8-8.5px (kicker). Those were tuned in a mockup; in
  // a real window at real viewing distance they read small, and the user asked for a lift.
  // So the bands moved UP by a point on request — deliberately, the same way the motion band
  // did — rather than being widened because something failed. Both roles must still be
  // DISTINCT and the kicker must still be the quieter of the two, which is what this checks.
  var statOk = px(base) >= 9.5 && px(base) <= 11 && em(base) >= 0.12 && em(base) <= 0.14;
  var kickOk = px(kick) >= 9 && px(kick) <= 10 && em(kick) === 0.18 && wt(kick) === 400;
  var stillDistinct = px(kick) < px(base) && wt(kick) < (+(base.match(/font-weight:(\d+)/) || [])[1] || 600);
  // and the hero numeral is the TOP of the display range, not merely inside it
  var big = (css.match(/\.big-n\{[^}]*\}/) || [''])[0];
  var bigOk = px(big) === 68 && em(big) === -0.045;
  if (!statOk || !kickOk || !bigOk || !stillDistinct) console.log('      base=' + base + '\n      kicker=' + kick + '\n      big=' + big);
  return statOk && kickOk && bigOk && stillDistinct && base !== kick;
})());
ok('nothing renders below 9px — no text asks you to lean in', (function () {
  // "Some of the text is hard to read" was never a contrast problem: everything measured
  // 5.15:1 or better. It was SIZE. This sets a floor so the next small label cannot slip
  // under it, and so the type scale can only be lowered deliberately.
  // The `@` filter below exists to skip at-rule PREAMBLES, but it was silently exempting
  // real rules: for `@media (…){ .mtn small{font-size:7.5px} … }` the scan captured the
  // selector as "@media (…)" — the block opener — and dropped it for containing an @. So
  // the FIRST rule inside every media query was unguarded, and the app's one sub-floor rule
  // sat in exactly that slot, at 7.5px, for as long as this guard has existed. Strip the
  // at-rule openers first so every rule is scanned at the top level.
  function scanUnder9(text) {
    var flat = text.replace(/@(?:media|supports|container)[^{]*\{/g, ''), out = [];
    var re = /([^{}]*)\{([^}]*font-size:\s*([\d.]+)px[^}]*)\}/g, m;
    while ((m = re.exec(flat))) {
      var sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
      if (+m[3] < 9 && sel && sel.indexOf('@') < 0) out.push(sel.slice(-40) + ' = ' + m[3] + 'px');
    }
    return out;
  }
  var small = scanUnder9(css);
  if (small.length) console.log('      below the 9px floor: ' + small.join(' | '));
  // Self-falsifying: .mtn small IS the first rule inside a media query — the exact slot that
  // used to be exempt. Shrink it on a copy and the scan must catch it, or this guard is
  // hollow again and would report a clean floor on a screen full of 6px type.
  var doctored = scanUnder9(css.replace('.mtn small{font-size:9px', '.mtn small{font-size:6px'));
  var reaches = doctored.length === 1 && /\.mtn small/.test(doctored[0]);
  if (!reaches) console.log('      the scan does not reach inside @media — guard is hollow (' + doctored.length + ' hits)');
  return small.length === 0 && reaches;
})());
ok('a selected nav item is never signalled by text colour alone', (function () {
  // .snav .snsub.on set background:transparent AND ::before{display:none}, cancelling BOTH
  // affordances the nav uses for selection — so "you are on Plan, not Drills" came down to
  // --faint vs --accInk at 12px on a dark rail, which reads as nothing. Colour alone is also
  // the one signal a colour-blind user cannot use, so this is a real accessibility rule and
  // not just taste. Every .on rule in the side nav must carry a structural signal too.
  var bad = [];
  var re = /(\.snav[^{}]*\.on[^{}]*)\{([^}]*)\}/g, m;
  var sawSub = false;
  while ((m = re.exec(css))) {
    var sel = m[1].trim().replace(/\s+/g, ' '), body = m[2];
    if (/\.snsub/.test(sel)) sawSub = true;
    if (/::before/.test(sel) || /::after/.test(sel)) {
      if (/display:\s*none/.test(body)) bad.push(sel + ' hides its own rail');
      continue;
    }
    if (/background:\s*transparent/.test(body)) bad.push(sel + ' has no background');
  }
  if (bad.length) console.log('      colour-only selection: ' + bad.join(' | '));
  // and the sub-item must actually be covered by this sweep, not silently absent
  return bad.length === 0 && sawSub &&
         /\.snav \.snsub\.on\{background:var\(--glass\)/.test(css);
})());
ok('the pre-v3 amber identity is gone from every shipped surface', (function () {
  // The redesign changed the tokens but left the hard-coded hexes behind, so the app was
  // violet while the taskbar icon, the favicon, the browser theme-colour and — worst — the
  // shareable progress card users POST were all still the old amber. Hard-coded hexes are
  // exactly what a token system cannot protect, so they get their own guard.
  var amber = /#(EAC54F|322D14|1b1b18|ECE9E0|9A9482|332F22|78735F)\b/gi;
  var files = { 'index.html': html };
  try { files['landing.html'] = fs.readFileSync(path.join(__dirname, '..', 'docs', 'landing.html'), 'utf8'); } catch (e) {}
  try { files['manifest'] = fs.readFileSync(path.join(__dirname, '..', 'docs', 'manifest.webmanifest'), 'utf8'); } catch (e) {}
  try { files['icon.svg'] = fs.readFileSync(path.join(__dirname, '..', 'docs', 'icon.svg'), 'utf8'); } catch (e) {}
  var bad = [];
  Object.keys(files).forEach(function (f) {
    var m = files[f].match(amber);
    if (m) bad.push(f + ': ' + m.join(','));
  });
  if (bad.length) console.log('      stale identity: ' + bad.join(' | '));
  // and the share card must actually paint in the v3 palette
  var card = script.slice(script.indexOf('function shareCard('));
  card = card.slice(0, card.indexOf('\n  function ', 10));
  return bad.length === 0 && /#E38EFD/i.test(card) && /#09070C/i.test(card);
})());
ok('an entry animation never leaves its element invisible at rest', (function () {
  // v3 motion animates in from opacity:0 / scale(0) / scaleX(0). With fill-mode BOTH the
  // element also holds that invisible 0% frame BEFORE the animation starts — so anything
  // that stalls the start leaves it blank. The end frame of every one of these equals the
  // element's resting style, so no fill is needed at all... EXCEPT where there is a delay:
  // during a delay, no-fill shows the resting state and then snaps to 0%, which flashes.
  // Hence: delay => must carry a fill; no delay => must NOT carry a backwards fill.
  var entry = /animation:(lk-snap|lk-rise|v3-shardA|v3-shardB|v3-bloom|v3-rise|v3-roll|v3-pop|v3-growX|v3-badge|v3-cell|v3-tick)([^;}]*)/g;
  var m, bad = [];
  while ((m = entry.exec(css))) {
    var rest = m[2];
    // a delay is a SECOND time value in the shorthand (the first is the duration)
    var times = rest.match(/(?:^|\s)-?[\d.]+m?s/g) || [];
    var hasDelay = times.length >= 2;
    var backwards = /\b(both|backwards)\b/.test(rest);
    if (hasDelay !== backwards) bad.push(m[1] + ' delay:' + hasDelay + ' backwardsFill:' + backwards);
  }
  if (bad.length) console.log('      ' + bad.join(' | '));
  // and the calendar specifically must survive a stalled clock: 36 cells is the bulk of the
  // Progress screen, so its entry may scale but must never fade from opacity 0.
  var cell = (css.match(/@keyframes v3-cell\{[^}]*\}[^}]*\}/) || [''])[0];
  var cellSafe = cell && !/opacity:\s*0(\D|$)/.test(cell) && /scale\(\.86\)/.test(cell);
  return bad.length === 0 && cellSafe;
})());
ok('no blanket element selector can outrank a status chip nested inside a component', (function () {
  // .lnrow .lnb span (0,2,1) silently beat .st.due (0,2,0) and rendered the DUE chip grey.
  // Component rules that style a bare element must be scoped to direct children.
  var bad = [];
  var re = /\.[a-z][a-z0-9-]*\s+\.[a-z][a-z0-9-]*\s+(span|b|i|small)\{([^}]*)\}/g, m;
  while ((m = re.exec(html))) { if (/color:/.test(m[2])) bad.push(m[0].slice(0, 40)); }
  if (bad.length) console.log('      unscoped: ' + bad.join(' | '));
  return bad.length === 0;
})());
ok('the scarcity rule has a mechanism: a chip can drop to outline', (function () {
  return /\.st\.ghost\{background:transparent/.test(html) &&
         /class="st due ghost"/.test(statusChip('due', 'N due', true));
})());

// --- v3 motion: the signature moment must actually be wired, not just defined ---
ok('"the assemble" is BUILT: both shards, bloom, ping and the rolling numeral', (function () {
  // the v3 keyframes existed for four releases while celebrate() still used the old lk-*
  // markup — defined-but-dead CSS. These assert the moment is actually rendered.
  return /\.asm \.shA\{animation:v3-shardA/.test(html) &&
         /\.asm \.shB\{animation:v3-shardB/.test(html) &&
         /\.asmbloom\{[^}]*animation:v3-bloom/.test(html) &&
         /\.asmping\{[^}]*animation:v3-ping/.test(html) &&
         /\.asmn\{[^}]*animation:v3-roll/.test(html) &&
         /class="shA" d="'\+EMBLEM_A/.test(script) &&      // the real emblem paths, not a placeholder
         /class="shB" d="'\+EMBLEM_B/.test(script);
})());
ok('the assemble lingers, still self-clears, and its motion finishes before it does', (function () {
  // Section 5.1 caps the assemble at 1.3s. The user has seen it and asked for it to linger —
  // that is their call over the spec, so the band moved to 3.2s DELIBERATELY. What must not
  // move is the invariant underneath: it clears itself, and no frame is still animating when
  // it goes, or the moment ends mid-flight instead of landing.
  var m = script.match(/celeT=setTimeout\(done,(\d+)\)/);
  if (!m) { console.log('      no self-clear timer at all'); return false; }
  var clearsAt = +m[1];
  // the latest-finishing frame in the assemble: its delay plus its duration
  var latest = 0;
  var re = /animation:(v3-shardA|v3-shardB|v3-bloom|v3-ping|v3-rise|v3-roll|lk-rise)\s+([\d.]+)s(?:\s+cubic-bezier\([^)]*\))?(?:\s+([\d.]+)s)?/g, x;
  while ((x = re.exec(css))) {
    var dur = parseFloat(x[2]) * 1000, delay = x[3] ? parseFloat(x[3]) * 1000 : 0;
    if (dur + delay > latest) latest = dur + delay;
  }
  var fn = (script.match(/function celebrate\([\s\S]*?\n  \}/) || [''])[0];
  if (latest >= clearsAt) console.log('      motion ends at ' + latest + 'ms but it clears at ' + clearsAt + 'ms');
  return clearsAt <= 3600 && latest > 0 && latest < clearsAt &&   // lands before it leaves
         fn.indexOf('TAP OR PRESS') < 0 &&                        // no instruction to dismiss
         /celeKey=function\(e\)\{if\(e\.key==="Escape"/.test(script);   // but Esc still works
})());
ok('every v3 keyframe we define is actually used somewhere', (function () {
  var defined = (html.match(/@keyframes (v3-[a-zA-Z]+)/g) || []).map(function (s) { return s.replace('@keyframes ', ''); });
  var used = {};
  (html.match(/animation:[^;]*?(v3-[a-zA-Z]+)/g) || []).forEach(function (s) {
    var m = s.match(/(v3-[a-zA-Z]+)/); if (m) used[m[1]] = 1;
  });
  var dead = defined.filter(function (k) { return !used[k]; });
  if (dead.length) console.log('      dead keyframes: ' + dead.join(', '));
  return dead.length === 0;
})());
ok('bars animate with scaleX so the inline width stays the true percentage', (function () {
  // animating width itself would make the number a function of the animation
  return /@keyframes v3-growX\{0%\{transform:scaleX\(0\)\}/.test(html) &&
         /\.skbar i\{[^}]*animation:v3-growX/.test(html) &&
         /\.lhbars i\{[^}]*animation:v3-growX/.test(html) &&
         !/@keyframes v3-growX\{[^}]*width:/.test(html);
})());

// --- v3 Group E: lifecycle ---
(function () {
  function mkPlanE(weeksIn) {
    var created = new Date(); created.setDate(created.getDate() - (weeksIn - 1) * 7);
    return { weekly:{0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match'},
             keystone:'cstrafe', keystoneName:'Counter-strafing', used:['cstrafe'],
             profile:{ weak:['cstrafe'], time:'30', days:'4', rank:'mid', platform:'premier' },
             created: dateKey(created), targets:[{n:'Counter-strafing %', h:'Leetify'}] };
  }
  ok('the first week says there is nothing to compare you against yet, then gets out of the way', (function () {
    var st = { plan: mkPlanE(1), sessions:{}, settings:{}, reviews:{}, metrics:{}, lineups:{} };
    var day1 = firstWeekCard(st, new Date());
    for (var i = 0; i < 7; i++) { var d = new Date(); d.setDate(d.getDate() - i);
      st.sessions[dateKey(d)] = { warm:true, drills:{0:true}, fk:'cstrafe' }; }
    var after = firstWeekCard(st, new Date());
    return /Day one\./.test(day1) && /no streak to defend yet/.test(day1) &&
           /only target is showing up/.test(day1) && after === '';
  })());
  ok('graduation offers three EQUAL choices and never frames stopping as failure', (function () {
    var st = { plan: mkPlanE(12), sessions:{}, settings:{}, reviews:{}, metrics:{}, lineups:{} };
    st.sessions[dateKey(new Date())] = { warm:true, drills:{0:true}, fk:'cstrafe' };
    var h = graduateCard(st, new Date());
    var opts = (h.match(/class="gbtn"/g) || []).length;
    return /Twelve weeks\./.test(h) && /a choice, not a continuation/.test(h) &&
           opts === 3 && h.indexOf('pbtn') < 0 &&                    // no primary among them
           /KEEP MAINTAINING/.test(h) && /BUILD A NEW PLAN/.test(h) && /STOP HERE/.test(h) &&
           !/fail|quit|give up/i.test(h) &&
           /\.gradopts \.gbtn\{flex:1/.test(html);                    // laid out as equals
  })());
  ok('graduation only appears at week 12, and can be acknowledged away', (function () {
    var early = { plan: mkPlanE(8), sessions:{}, settings:{}, reviews:{}, metrics:{}, lineups:{} };
    var done  = { plan: mkPlanE(12), sessions:{}, settings:{ gradAck:'maintain' }, reviews:{}, metrics:{}, lineups:{} };
    return graduateCard(early, new Date()) === '' && graduateCard(done, new Date()) === '';
  })());
  ok('the alternatives come from the REAL generator, not hand-written plans', (function () {
    var st = { plan: mkPlanE(3), sessions:{}, settings:{}, reviews:{}, metrics:{}, lineups:{} };
    var alts = altPlans(st);
    if (!alts.length) return false;
    // A hand-rolled alternative would still LOOK coherent (real focus, real drill), so the
    // output alone can't tell them apart — the branch must actually run the generator, which
    // is free to return a different keystone than the answer asked for.
    return /p2=generatePlan\(plan\.profile\|\|\{\},k\)/.test(script) &&
           alts.every(function (a) {
             var F = FOCI[a.k];
             return F && a.name && a.first && F.drills.some(function (d) { return d.t === a.first; });
           }) &&
           alts.every(function (a) { return a.k !== st.plan.keystone; });   // never offers what you already have
  })());
  ok('the alternatives are given an honest case, not made to look obviously wrong', (function () {
    var st = { plan: mkPlanE(3), sessions:{}, settings:{}, reviews:{}, metrics:{}, lineups:{} };
    var h = altCard(st);
    return /YOURS/.test(h) && /class="altrow picked"/.test(h) &&
           /not written to look worse/.test(h) &&
           !/worse|inferior|weaker|bad choice/i.test(h.replace(/not written to look worse/, '')) &&
           (h.match(/class="altw"/g) || []).length >= 2;      // each alternative states its own case
  })());
  ok('the beginner note is writable, echoes back, and stays on the device', (function () {
    var st = { plan: mkPlanE(4), sessions:{}, settings:{}, reviews:{}, metrics:{}, lineups:{} };
    var blank = adviceCard(st, new Date());
    st.settings.advice = 'Stop chasing headshots when the spray is landing.';
    var filled = adviceCard(st, new Date());
    var tooEarly = adviceCard({ plan: mkPlanE(1), sessions:{}, settings:{}, reviews:{}, metrics:{}, lineups:{} }, new Date());
    return /week 4/.test(blank) && /data-advice/.test(blank) &&
           /WEEK-ONE PLAYERS WILL SEE/.test(filled) &&
           /Stop chasing headshots/.test(filled) &&
           /Nothing is uploaded/.test(filled) &&
           tooEarly === '';                                   // nothing to say in the first fortnight
  })());
  ok('the beginner note escapes what you type', (function () {
    var st = { plan: mkPlanE(4), sessions:{}, settings:{ advice:'<img src=x onerror=1>' }, reviews:{}, metrics:{}, lineups:{} };
    var h = adviceCard(st, new Date());
    return h.indexOf('<img') < 0 && h.indexOf('&lt;img') >= 0;
  })());
})();

// --- v3 Group D: evidence ---
(function () {
  function dk(n) { var d = new Date(); d.setDate(d.getDate() - n); return dateKey(d); }
  function mkPlanD() {
    var created = new Date(); created.setDate(created.getDate() - 60);
    return { weekly:{0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match'},
             keystone:'cstrafe', keystoneName:'Counter-strafing', used:['cstrafe'],
             profile:{ weak:['spray'], time:'30' }, created: dateKey(created),
             targets:[{n:'Counter-strafing %', h:'Leetify'}] };
  }
  ok('leaks closed compares SHARES, so logging more deaths never reads as a leak closing', (function () {
    var st = { plan: mkPlanD(), sessions:{}, settings:{}, reviews:{}, metrics:{} };
    // early window: aim is 50% of 20. recent: aim is 20% of 40 — MORE aim deaths, smaller share
    st.reviews[dk(45)] = { aim:10, pos:5, util:5 };
    st.reviews[dk(10)] = { aim:8, pos:16, util:16 };
    var rows = leakHistory(st, new Date());
    var aim = rows.filter(function (r) { return r.k === 'aim'; })[0];
    return aim && aim.was === 50 && aim.now === 20 && aim.drop === 30;
  })());
  ok('the leak bars ARE the percentages, not decorative widths', (function () {
    var st = { plan: mkPlanD(), sessions:{}, settings:{}, reviews:{}, metrics:{} };
    st.reviews[dk(45)] = { aim:10, pos:5, util:5 };
    st.reviews[dk(10)] = { aim:8, pos:16, util:16 };
    var h = leakHistoryCard(st, new Date());
    return h.indexOf('width:50%') >= 0 && h.indexOf('width:20%') >= 0 &&
           /deaths you tagged yourself/.test(h);        // and it says where the numbers came from
  })());
  ok('leaks closed stays silent without enough on BOTH sides of the comparison', (function () {
    var st = { plan: mkPlanD(), sessions:{}, settings:{}, reviews:{}, metrics:{} };
    st.reviews[dk(10)] = { aim:20, pos:20 };          // recent only, nothing to compare to
    return leakHistory(st, new Date()).length === 0 && leakHistoryCard(st, new Date()) === '';
  })());
  ok('what-changed reports the quiz answer and only checkpoints the player actually entered', (function () {
    var st = { plan: mkPlanD(), sessions:{}, settings:{}, reviews:{}, metrics:{} };
    var noMetrics = changedSince(st);
    st.metrics[tkey('Counter-strafing %')] = { base:70, w4:78 };
    var withMetric = changedSince(st);
    var h = changedCard(st);
    return noMetrics && noMetrics.moved.length === 0 &&
           withMetric.moved.length === 1 && withMetric.moved[0].delta === 8 &&
           /Spray \/ recoil control/.test(h) && /70 → 78/.test(h) && /\+8/.test(h) &&
           /you entered from Leetify/.test(h);          // sourcing is stated
  })());
  ok('proof names a real source per row and never claims Lockin measured the metric', (function () {
    var st = { plan: mkPlanD(), sessions:{}, settings:{}, reviews:{}, metrics:{} };
    st.metrics[tkey('Counter-strafing %')] = { base:70, w4:78 };
    for (var i = 0; i < 21; i++) { var d = new Date(); d.setDate(d.getDate() - i);
      if (!isTrainingDay(st.plan, d)) continue;
      st.sessions[dateKey(d)] = { warm:true, drills:{0:true}, fk:'cstrafe' }; }
    var rows = proofRows(st, new Date()), h = proofCard(st, new Date());
    var metricRow = rows.filter(function (r) { return /Counter-strafing/.test(r.label); })[0];
    var daysRow = rows.filter(function (r) { return /Days trained/.test(r.label); })[0];
    return metricRow && /not measured by Lockin/.test(metricRow.src) &&
           daysRow && /counted by the app/.test(daysRow.src) &&
           /What this does not prove:<\/b> your rank/.test(h) &&
           !/measured in Recoil Master/.test(h);         // the spec's example claim we cannot make
  })());
  ok('proof refuses to make a case from a single row', (function () {
    var st = { plan: mkPlanD(), sessions:{}, settings:{}, reviews:{}, metrics:{} };
    return proofCard(st, new Date()) === '';            // no metrics, no leaks, no days
  })());
  ok('the honest export is human-readable, sourced, and states its own limit', (function () {
    var st = { plan: mkPlanD(), sessions:{}, settings:{ tag:'van_' }, reviews:{}, metrics:{} };
    st.metrics[tkey('Counter-strafing %')] = { base:70, w4:78 };
    st.sessions[dateKey(new Date())] = { warm:true, drills:{0:true}, fk:'cstrafe' };
    var t = honestExport(st, new Date());
    return t.indexOf('<') < 0 && t.indexOf('{') < 0 &&           // prose, not JSON or markup
           /LOCKIN — van_'s progress/.test(t) &&
           /entered from Leetify, not measured by Lockin/.test(t) &&
           /What this does not prove: rank/.test(t) &&
           /Counter-strafing %: 70 -> 78 \(\+8\)/.test(t);
  })());
})();

// --- v3 Group C part 2: drift, the coach's question, the skipped drill ---
(function () {
  function mkPlan() {
    var created = new Date(); created.setDate(created.getDate() - 28);
    return { weekly:{0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match'},
             keystone:'cstrafe', used:['cstrafe'], profile:{time:'30'}, created: dateKey(created),
             targets:[{n:'Counter-strafing %', h:'Leetify'}] };
  }
  function trainAll(st, days) {
    var now = new Date();
    for (var i = 0; i < days; i++) { var d = addDaysT(now, -i);
      if (!isTrainingDay(st.plan, d)) continue;
      st.sessions[dateKey(d)] = { warm:true, drills:{0:true}, fk:'cstrafe' }; }
  }
  function addDaysT(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }

  ok('drift needs BOTH halves — high adherence AND a metric the player entered that stalled', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{}, metrics:{}, reviews:{} };
    trainAll(st, 21);
    var noMetric = driftCheck(st, new Date());              // showed up, but nothing measured
    st.metrics[tkey('Counter-strafing %')] = { base: 70, w4: 70.5 };   // barely moved
    var both = driftCheck(st, new Date());
    st.metrics[tkey('Counter-strafing %')] = { base: 70, w4: 79 };     // clearly moved
    var moved = driftCheck(st, new Date());
    return noMetric === null && moved === null &&
           both && both.adherence >= 75 && both.metric.n === 'Counter-strafing %';
  })());
  ok('drift stays silent when the habit IS the problem — it never blames the player', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{}, metrics:{}, reviews:{} };
    trainAll(st, 4);                                        // barely showed up
    st.metrics[tkey('Counter-strafing %')] = { base: 70, w4: 70.2 };
    return driftCheck(st, new Date()) === null;
  })());
  ok('the drift card blames the plan and offers both ways out', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{}, metrics:{}, reviews:{} };
    trainAll(st, 21);
    st.metrics[tkey('Counter-strafing %')] = { base: 70, w4: 70.5 };
    var h = driftCard(st, new Date());
    return /The habit is not the problem/.test(h) && /the plan is wrong, not you/.test(h) &&
           /RETAKE THE QUIZ/.test(h) && /data-driftfocus/.test(h) && /70 → 70\.5/.test(h);
  })());
  ok('the coach asks on Sundays only, once a week', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{} };
    var sunday = new Date(2026,0,4), monday = new Date(2026,0,5);   // 4 Jan 2026 is a Sunday
    var asksSun = coachAsk(st, sunday), asksMon = coachAsk(st, monday);
    applyCoachAnswer(st, 'none', sunday);
    return sunday.getDay() === 0 && asksSun && !asksMon && coachAsk(st, sunday) === null;
  })());
  ok('every answer does something genuinely different — including the one that does nothing', (function () {
    var sunday = new Date(2026,0,4);
    var eco = { plan: mkPlan(), sessions:{}, settings:{} };
    var buy = { plan: mkPlan(), sessions:{}, settings:{} };
    var clutch = { plan: mkPlan(), sessions:{}, settings:{} };
    var beforeBuy = JSON.stringify(buy.plan.weekly);
    applyCoachAnswer(eco, 'eco', sunday);
    applyCoachAnswer(buy, 'buy', sunday);
    applyCoachAnswer(clutch, 'clutch', sunday);
    var ecoHas = JSON.stringify(eco.plan.weekly).indexOf('utility') >= 0;
    var clutchHas = JSON.stringify(clutch.plan.weekly).indexOf('clutch') >= 0;
    var buyUnchanged = JSON.stringify(buy.plan.weekly) === beforeBuy;
    var says = COACH_ANSWERS.filter(function (a) { return a.k === 'buy'; })[0].changes;
    return COACH_ANSWERS.length === 4 && ecoHas && clutchHas && buyUnchanged &&
           /Nothing changes/.test(says);          // and it SAYS it changes nothing
  })());
  ok('answering shows a WHAT CHANGES receipt for that week', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{} };
    var sunday = new Date(2026,0,4);
    applyCoachAnswer(st, 'eco', sunday);
    var h = coachCard(st, sunday);
    return /WHAT CHANGES/.test(h) && /An eco round/.test(h) && /Utility takes one of your training days/.test(h);
  })());
  ok('per-drill adherence counts ONLY stamped sessions — unattributable days are skipped', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{} };
    var now = new Date();
    st.sessions[dateKey(now)] = { warm:true, drills:{0:true}, fk:'cstrafe' };
    st.sessions[dateKey(addDaysT(now,-1))] = { warm:true, drills:{0:true} };   // NO stamp
    var rows = drillAdherence(st, 21, now);
    var shown = rows.reduce(function (t, r) { return t + r.shown; }, 0);
    return rows.length === FOCI.cstrafe.drills.length &&      // one row per drill of that focus
           shown === FOCI.cstrafe.drills.length;              // only the stamped day counted
  })());
  ok('the skipped-drill bars render REAL percentages, not decorative widths', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{} };
    var now = new Date(), n = FOCI.cstrafe.drills.length;
    // 6 stamped sessions: every drill done each time EXCEPT the last one, done once
    for (var i = 0; i < 6; i++) {
      var dr = {}; for (var j = 0; j < n; j++) dr[j] = true;
      if (i > 0) delete dr[n-1];
      st.sessions[dateKey(addDaysT(now,-i))] = { warm:true, drills:dr, fk:'cstrafe' };
    }
    var s = skippedDrill(st, now);
    if (!s) return false;
    var h = skippedCard(st, now);
    var worstPct = Math.round(1/6*100);                       // 17%
    return s.worst.pct === worstPct && s.restMin === 100 &&
           h.indexOf('width:' + worstPct + '%') >= 0 &&       // the bar IS the number
           h.indexOf('width:100%') >= 0 &&
           /MAKE IT EASIER/.test(h) && /SWAP IT OUT/.test(h) && /KEEP IT/.test(h) &&
           /not laziness/.test(h);
  })());
  ok('it stays quiet unless one drill is a genuine outlier', (function () {
    var st = { plan: mkPlan(), sessions:{}, settings:{} };
    var now = new Date(), n = FOCI.cstrafe.drills.length;
    for (var i = 0; i < 6; i++) {                             // everything done every time
      var dr = {}; for (var j = 0; j < n; j++) dr[j] = true;
      st.sessions[dateKey(addDaysT(now,-i))] = { warm:true, drills:dr, fk:'cstrafe' };
    }
    return skippedDrill(st, now) === null && skippedCard(st, now) === '';
  })());
})();

// --- v3 Group B: streak integrity ---
(function () {
  // 4-day plan (Mon-Thu train, Fri/Sat match, Sun rest) — the default shape
  // created on the day training starts, as it is in reality — the walk-back stops there
  function planFor() { return { weekly: {0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match'},
                                keystone:'cstrafe', created:'2026-01-05', used:['cstrafe'] }; }
  function stWith(days) { var st = { plan: planFor(), sessions: {}, settings: {}, lineups: {} };
    days.forEach(function (d) { st.sessions[d] = { warm:true, drills:{0:true} }; }); return st; }

  ok('streakDetail reports the freeze spend, not just the length', (function () {
    // W1 Mon-Thu + W2 Mon,Wed,Thu (W2-Tue missed) = 7 warm days -> 1 freeze earned
    var st = stWith(['2026-01-05','2026-01-06','2026-01-07','2026-01-08',
                     '2026-01-12','2026-01-14','2026-01-15']);
    var d = streakDetail(st, new Date(2026,0,15), freezeBudget(st));
    return freezeBudget(st) === 1 && d.days === 7 && d.spent === 1 && d.held === 0;
  })());
  ok('a streak that needed no freeze reports none spent', (function () {
    var st = stWith(['2026-01-05','2026-01-06','2026-01-07','2026-01-08',
                     '2026-01-12','2026-01-13','2026-01-14']);
    var d = streakDetail(st, new Date(2026,0,14), freezeBudget(st));
    return d.days === 7 && d.spent === 0;
  })());
  ok('the freeze row names the spend and what is still held', (function () {
    var st = stWith(['2026-01-05','2026-01-06','2026-01-07','2026-01-08',
                     '2026-01-12','2026-01-14','2026-01-15']);
    var h = freezeRow(st, new Date(2026,0,15));
    return /FREEZE 1 OF 1 SPENT/.test(h) && /class="frzs spent"/.test(h);
  })());
  ok('a paused day is never a missed day, and never spends a freeze', (function () {
    var st = stWith(['2026-01-05','2026-01-06','2026-01-07','2026-01-08']);
    st.settings.pause = { weeks: 2, from: '2026-01-09' };
    // Mon 12th and Tue 13th fall inside the pause window
    return isPausedOn(st, new Date(2026,0,12)) && !isPausedOn(st, new Date(2026,0,26)) &&
           streakDetail(st, new Date(2026,0,20), 0).days === 4 &&   // streak intact with NO budget
           streakDetail(st, new Date(2026,0,20), 0).spent === 0 &&
           lapseInfo(st, new Date(2026,0,20)) === null;             // and no lapse card either
  })());
  ok('the pause card holds the programme week and says the plan will not restart', (function () {
    var st = stWith(['2026-01-05']);
    st.plan.created = '2026-01-01';
    st.settings.pause = { weeks: 6, from: '2026-01-08' };
    var wkAtPause = planWeek(st, new Date(2026,0,8));
    var wkLater   = planWeek(st, new Date(2026,1,10));   // a month into the pause
    var c = pauseCard(st, new Date(2026,1,10));
    return wkLater === wkAtPause &&                       // the clock is held
           /Paused for six weeks/.test(c) && /does not restart/.test(c) &&
           /held, not broken/.test(c) && /data-resume/.test(c) &&
           PAUSE_WEEKS.join(',') === '2,4,6';
  })());
  ok('rest completes the week rather than leaving a hole', (function () {
    var st = stWith([]);
    st.plan.weekly = {0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'rest',6:'match'};
    var mon = new Date(2026,0,5);                          // Mon 5 Jan 2026
    var r0 = restWeek(st, mon);
    st.sessions['2026-01-09'] = { rest:true };             // Fri
    st.sessions['2026-01-11'] = { rest:true };             // Sun
    var r1 = restWeek(st, mon);
    return r0.planned === 2 && r0.logged === 0 && !r0.done &&
           r1.logged === 2 && r1.done &&
           /the week is complete, not incomplete/.test(restLine(st, mon)) &&
           restLine({ plan:{weekly:{}}, sessions:{} }, mon) === '';   // no rest days -> no line
  })());
  ok('the quiet week runs for a few days after a return, then stops on its own', (function () {
    var st = stWith(['2026-01-05','2026-01-06','2026-01-20']);   // trained, gap, returned on the 20th
    var day1 = quietWeek(st, new Date(2026,0,20));
    var day3 = quietWeek(st, new Date(2026,0,22));
    var after = quietWeek(st, new Date(2026,0,26));
    return QUIET_DAYS === 4 && day1 && day1.left === 4 && day3 && day3.left === 2 && after === null &&
           quietWeek(stWith(['2026-01-05','2026-01-06']), new Date(2026,0,6)) === null;   // no lapse, no quiet week
  })());
  ok('the tier identity reads the same source as the rail', (function () {
    var st = stWith([]); st.settings.tag = 'van_';
    var h = tierIdentity(st, 14);
    return /LOCKED IN, VAN_/.test(h) && /GOLD TIER/.test(h) &&
           milestoneState(14).reached.t === 'GOLD' &&
           /NO TIER YET/.test(tierIdentity(stWith([]), 0));
  })());
})();

// --- v3 Group A part 2: milestone rail, badges, auto-debrief ---
ok('the milestone ladder reports the tier reached and the honest distance to the next', (function () {
  var a = milestoneState(0), b = milestoneState(7), c = milestoneState(9), d = milestoneState(100);
  return a.reached === null && a.next.n === 3 && a.toGo === 3 &&
         b.reached.t === 'SILVER' && b.next.n === 14 && b.toGo === 7 &&
         c.reached.t === 'SILVER' && c.toGo === 5 &&
         d.reached.t === 'GLOBAL' && d.next === null && d.toGo === 0;
})());
ok('the rail marks reached rungs and flags exactly one as next', (function () {
  var st = { sessions: {}, plan: { weekly: {}, created: dateKey(new Date()) }, settings: {} };
  var h = milestoneRail(st);
  // now a TRACK: nodes positioned along one line, so also assert the geometry is real —
  // every rung placed by percent, and the travelled portion filled.
  var placed = (h.match(/class="mtn[^"]*" style="left:([\d.]+)%/g) || []);
  return (h.match(/class="mtn next"/g) || []).length === 1 &&
         STREAK_TIERS.length === 6 && placed.length === 6 &&
         /class="mtline"><i style="width:[\d.]+%"/.test(h) &&
         />3<\/b> days to BRONZE/.test(h);
})());
ok('the rail and the Fortnight badge agree — 14 is a rung on both', (function () {
  var onRail = STREAK_TIERS.some(function (t) { return t.n === 14; });
  var badge = ACHIEVEMENTS.filter(function (a) { return a.id === 'fortnight'; })[0];
  return onRail && badge && badge.goal === 14;
})());
ok('badges: twelve, earned reads accent and locked reads outline (not a dimmed control)', (function () {
  // badges are hex now, lit when earned and padlocked when not — but the original intent
  // holds and is what this still asserts: locked must read as NOT YET, never as disabled.
  return ACHIEVEMENTS.length === 12 &&
         /\.achhex\{[^}]*clip-path:polygon\(50% 0,100% 25%/.test(css) &&
         /\.ach\.on \.achhex\{[^}]*background:var\(--acc\)/.test(css) &&
         !/\.ach\{[^}]*opacity:\.5/.test(css) &&
         /var LOCK=/.test(script) &&               // a padlock, not a dimmed medal
         /minmax\(96px,1fr\)/.test(css);           // still three per row on a phone
})());
ok('the vault badges count real saved lineups, maps and passed recalls', (function () {
  var st = { lineups: {}, settings: { recalls: 7 } };
  st.lineups[MAPS[0].id] = [{ n: 'a' }, { n: 'b' }];
  st.lineups[MAPS[1].id] = [{ n: 'c' }];
  st.lineups[MAPS[2].id] = [];                                  // empty map doesn't count
  return lineupCount(st) === 3 && lineupMaps(st) === 2 && recallCount(st) === 7 &&
         recallCount({}) === 0;
})());
ok('only a PASSED recall increments the counter — "passed 25 checks" has to mean it', (function () {
  return /if\(ok\)\{s2\.settings=s2\.settings\|\|\{\};s2\.settings\.recalls=\(s2\.settings\.recalls\|\|0\)\+1;\}/.test(script);
})());
ok('no badge claims something we cannot honestly compute (no per-focus attribution)', (function () {
  var names = ACHIEVEMENTS.map(function (a) { return a.t.toLowerCase(); }).join(' ');
  return !/spray tamer|prefire|clutch/.test(names) &&
         ACHIEVEMENTS.every(function (a) { return typeof a.val === 'function' && a.goal > 0; });
})());
ok('auto-debrief states the matches GSI already recorded, and nothing when it never ran', (function () {
  var st = { matches: {} };
  st.matches['D'] = [{ result: 'loss', ct: 13, t: 16, map: 'de_mirage' },
                     { result: 'win', ct: 16, t: 9, map: 'de_nuke' }];
  var h = autoDebrief(st, 'D');
  return /Auto-logged/.test(h) && /Lost/.test(h) && /Won/.test(h) &&
         /mirage/.test(h) && !/de_mirage/.test(h) &&          // the de_ prefix is stripped
         /13–16/.test(h) && /2 matches recorded/.test(h) &&
         autoDebrief({ matches: {} }, 'D') === '' &&           // GSI never ran -> silent
         autoDebrief({}, 'D') === '';
})());

// --- v3 Today tier system: rank by how fast the moment passes ---
ok('the gate (T1) OUTRANKS a lapse (T2) — queueing is the only trigger with a real expiry', (function () {
  var st = { lineups: {}, sessions: {} };
  var cards = todayCards(st, new Date(), { gate: '<div id="G"></div>', lapse: { days: 5 }, pr: null, lnDue: 0 });
  var gate = cards.filter(function (c) { return c.k === 'gate'; })[0];
  var lapse = cards.filter(function (c) { return c.k === 'lapse'; })[0];
  if (!gate || !lapse) return false;
  var out = todayStack(cards);
  // both are non-T3, so only the gate surfaces; the lapse falls behind the expander
  return gate.tier === 1 && lapse.tier === 2 &&
         out.indexOf('id="G"') >= 0 && /1 MORE WAITING/.test(out);
})());
ok('at most ONE non-T3 card shows, and T3 always shows alongside it', (function () {
  var st = { lineups: {}, sessions: {} };
  var cards = todayCards(st, new Date(), {
    gate: '<div id="G"></div>', lapse: { days: 5 }, pr: { week: 4 }, lnDue: 2,
    recap: null, debrief: '<div id="D"></div>'
  });
  var out = todayStack(cards);
  var shownNonT3 = ['id="G"', 'id="D"', 'lapsecard'].filter(function (m) { return out.indexOf(m) >= 0; });
  return out.indexOf('id="G"') >= 0 &&            // the T1 wins the single slot
         out.indexOf('duecard') >= 0 &&           // T3 shows regardless
         shownNonT3.length === 1 &&               // and nothing else non-T3 is up
         /2 MORE WAITING/.test(out);              // lapse + debrief held back
})());
ok('the expander is a real 44px control and reveals exactly what was held back', (function () {
  return /\.moretog\{[^}]*min-height:44px/.test(html) &&
         /data-morecards="1"/.test(script) && /data-morecards="0"/.test(script) &&
         /moreCards\s*\?/.test(script);
})());
ok('a quiet day shows no stack at all — the system adds nothing when nothing is true', (function () {
  var st = { lineups: {}, sessions: {} };
  return todayStack(todayCards(st, new Date(), { gate: '', lapse: null, pr: null, lnDue: 0 })) === '';
})());
ok('nothing due → no review card anywhere, and no empty DUE card on Today', (function () {
  var st = { lineups: {} };
  st.lineups[MAPS[0].id] = [{ n: 'a', t: '', srs: { s: 1, due: '2099-01-01' } }];
  return lineupReviewCard(st, false) === '' &&          // the Maps recall deck
         dueCard(st, null, 0) === '' &&                 // the Today DUE card
         /var lnDue=dueLineups\(st,now\)\.length/.test(script);
})());
ok('a due plan review and due lineup recalls MERGE into one DUE card, never two competing', (function () {
  var st = { lineups: {} };
  var both = dueCard(st, { week: 4 }, 3);
  var onlyPlan = dueCard(st, { week: 4 }, 0);
  var onlyLineups = dueCard(st, null, 3);
  var oneCard = (both.match(/class="card duecard"/g) || []).length === 1;
  return oneCard &&
         (both.match(/class="duerow"/g) || []).length === 2 &&      // two rows, one card
         /Plan review/.test(both) && /Lineup recall/.test(both) && /3 throws/.test(both) &&
         (onlyPlan.match(/class="duerow"/g) || []).length === 1 &&
         (onlyLineups.match(/class="duerow"/g) || []).length === 1 &&
         /1 throw ready/.test(dueCard(st, null, 1));                // singular, not "1 throws"
})());
ok('adding a lineup stores its optional group; the vault clusters by group', (function () {
  return /push\(\{n:n,t:t,g:g\}\)/.test(script) && script.indexOf('data-lngroup') >= 0 && /hasGroups/.test(script);
})());
ok('the review card escapes user text — name, group and throw are all inert', (function () {
  var st = { lineups: {} };
  st.lineups[MAPS[0].id] = [{ n: '<img src=x onerror=1>', t: '<b>throw</b>', g: '<i>g</i>' }];
  var shown = lineupReviewCard(st, true);
  return shown.indexOf('<img') < 0 && shown.indexOf('<b>throw') < 0 && shown.indexOf('<I>') < 0 &&
         shown.indexOf('&lt;img') >= 0;
})());
ok('mid-match lookup: your lineups sit at the TOP of the map screen, before the prep content', (function () {
  return /chips\+vault\+tSide\+ctSide\+routes\+caveat/.test(script);
})());
ok('the honest label ships with the deck — spacing science solid, lineups our adaptation', (function () {
  var h = lineupReviewCard({ lineups: (function (o) { o[MAPS[0].id] = [{ n: 'a', t: 'b' }]; return o; })({}) }, true);
  return /our adaptation/i.test(h) && /proven for remembering facts/i.test(h);
})());

// --- v0.29: lineup pictures ---
ok('pictures NEVER enter localStorage — they live in IndexedDB, keyed off the lineup', (function () {
  // the whole point: localStorage is a ~5MB budget shared across the origin
  return /indexedDB\.open\("lockin-img"/.test(script) &&
         script.indexOf('localStorage.setItem(KEY,JSON.stringify(stateForBackup') < 0 &&
         /function save\(st\)\{mem=st;try\{localStorage\.setItem\(KEY,JSON\.stringify\(st\)\)/.test(script);
})());
ok('a backup carries the pictures of saved lineups, and only those', (function () {
  IMGS.im_a = 'data:image/webp;base64,AAA';
  IMGS.im_orphan = 'data:image/webp;base64,ZZZ';         // not referenced by any lineup
  var st = { lineups: {}, sessions: {} };
  st.lineups[MAPS[0].id] = [{ n: 'a', t: 'b', im: ['im_a'] }];
  var b = stateForBackup(st);
  var okOne = b._images && b._images.im_a === 'data:image/webp;base64,AAA' && !b._images.im_orphan;
  delete IMGS.im_a; delete IMGS.im_orphan;
  return okOne && b.lineups === st.lineups;               // state itself passes through untouched
})());
ok('a state with no pictures produces no _images key (backups stay small)', (function () {
  var st = { lineups: {}, sessions: {} };
  st.lineups[MAPS[0].id] = [{ n: 'a', t: 'b' }];
  return stateForBackup(st)._images === undefined;
})());
ok('restoring a backup strips _images out of the state before it can reach localStorage', (function () {
  var o = { plan: null, sessions: {}, _images: { im_x: 'data:image/webp;base64,QQQ' } };
  var clean = takeBackupImages(o);
  var stripped = clean._images === undefined && !('_images' in clean);
  var landed = IMGS.im_x === 'data:image/webp;base64,QQQ';   // and went to the picture store instead
  delete IMGS.im_x;
  return stripped && landed;
})());
ok('thumbnails render only for pictures we actually hold, and the src is escaped', (function () {
  IMGS.im_ok = 'data:image/webp;base64,AAA';
  var h = picStrip({ im: ['im_ok', 'im_missing'] });      // one present, one lost
  var one = (h.match(/<img /g) || []).length === 1;
  delete IMGS.im_ok;
  return one && h.indexOf('data-pic="im_ok"') >= 0 && h.indexOf('im_missing') < 0;
})());
ok('no pictures → no thumbnail strip at all', picStrip({}) === '' && picStrip({ im: [] }) === '');
ok('the recall card keeps pictures hidden until reveal — the picture IS the answer', (function () {
  IMGS.im_p = 'data:image/webp;base64,AAA';
  var st = { lineups: {} };
  st.lineups[MAPS[0].id] = [{ n: 'A smoke', t: 'from spawn', im: ['im_p'] }];
  var hidden = lineupReviewCard(st, false), shown = lineupReviewCard(st, true);
  delete IMGS.im_p;
  return hidden.indexOf('<img') < 0 && shown.indexOf('<img') >= 0 && shown.indexOf('lnthumbs big') >= 0;
})());
ok('pictures are capped per lineup and downscaled on the way in', (function () {
  return IMG_PER === 4 && /IMG_MAXW=1100/.test(script) &&
         /if\(l\.im\.length>=IMG_PER\)return/.test(script) &&
         /toDataURL\("image\/webp"/.test(script) && /toDataURL\("image\/jpeg"/.test(script);
})());
ok('deleting a lineup deletes its pictures (no orphans left behind)', (function () {
  return /dropLineupPics\(s2\.lineups\[m\]\[ix\]\)[\s\S]{0,80}splice\(ix,1\)/.test(script);
})());
ok('paste only fires into an armed lineup, and the map links point at a real per-map source', (function () {
  return /addEventListener\("paste"/.test(script) && /if\(PICTARGET===null\|\|!e\.clipboardData\)return/.test(script) &&
         /https:\/\/csnades\.gg\/'\+esc\(sel\)/.test(script);
})());
// --- v0.32: AA fixes flagged by the v3 design handoff (both measured, both real) ---
ok('state-carrying borders use --edge (>=3:1), never decorative --line2 (~2:1)', (function () {
  // the unchecked drill circle, the quiz tick, the gate checkbox and the dashed rest cell
  // all COMMUNICATE state, so their border must clear the 3:1 non-text minimum
  var rules = ['.wc.rest', '.dbox', '.tick', '.gcheck .gbox'];
  return rules.every(function (sel) {
    var re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*border:[^;]*var\\(--edge\\)');
    return re.test(html);
  }) && /--edge:oklch/.test(html);
})());
// Contrast is MEASURED here, not assumed from a token pair — tinted grounds shift every
// ratio, and alpha tokens (--glass2) must be composited before they mean anything.
function oklchToRgb(L, C, H) {
  var h = H * Math.PI / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  var l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  var R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  var G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  var B = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  function g(x) { x = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055; return Math.min(1, Math.max(0, x)); }
  return [g(R), g(G), g(B)];
}
function over(fg, alpha, bg) { return [0, 1, 2].map(function (i) { return fg[i] * alpha + bg[i] * (1 - alpha); }); }
function lin(v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function lumOf(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); }
function cr(f, b) { var A = lumOf(f), B = lumOf(b); return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05); }
// pull a token's oklch triple straight out of the shipped stylesheet, per theme
function tok(name, theme) {
  var scope = theme === 'light'
    ? (html.match(/\[data-theme="light"\]\{([\s\S]*?)\n  \}/) || [])[1]
    : (html.match(/:root\{([\s\S]*?)\n  \}/) || [])[1];
  var m = (scope || '').match(new RegExp('--' + name + ':oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)'));
  return m ? oklchToRgb(+m[1], +m[2], +m[3]) : null;
}
ok('v3 accent-as-TEXT clears AA on every ground it lands on, in BOTH themes', (function () {
  var bad = [];
  ['dark', 'light'].forEach(function (t) {
    var ink = tok('accInk', t), surf = tok('surface', t), bg = tok('bg', t), s2 = tok('surface2', t);
    if (!ink || !surf || !bg || !s2) { bad.push(t + ':missing'); return; }
    [['surface', surf], ['bg', bg], ['surface2', s2]].forEach(function (p) {
      var r = cr(ink, p[1]);
      if (r < 4.5) bad.push(t + ' accInk on ' + p[0] + ' = ' + r.toFixed(2));
    });
  });
  if (bad.length) console.log('      ' + bad.join('; '));
  return bad.length === 0;
})());
ok('--faint on --glass2 (the tightest pair in the system) clears AA once composited', (function () {
  var bad = [];
  ['dark', 'light'].forEach(function (t) {
    var faint = tok('faint', t), surf = tok('surface', t);
    // --glass2 is an alpha token: white .085 in dark, plum .075 in light
    var g2 = t === 'dark' ? over([1, 1, 1], 0.085, surf) : over(oklchToRgb(0.30, 0.06, 303), 0.075, surf);
    var r = cr(faint, g2);
    if (r < 4.5) bad.push(t + ' faint on glass2 = ' + r.toFixed(2));
  });
  if (bad.length) console.log('      ' + bad.join('; '));
  return bad.length === 0;
})());
ok('the focus ring is one universal rule, not a hand-kept list of selectors', (function () {
  // It named seven selectors written before most of this app existed, so of 194 focusable
  // controls 24 KINDS had no rule and fell back to the browser default — invisible on a dark
  // violet ground. A list has to be maintained; a universal rule cannot drift.
  // strip comments first — an ungreedy [^{}]* happily swallows the comment block above a
  // rule, so the "selector" came out as the whole comment plus :focus-visible and never
  // matched. That is my regex being wrong about the CSS, not the CSS being wrong.
  var bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  var sels = [];
  (bare.match(/[^{}]*:focus-visible[^{]*\{[^}]*\}/g) || []).forEach(function (r) {
    r.split('{')[0].split(',').forEach(function (s) { sels.push(s.trim()); });
  });
  var hasUniversal = sels.indexOf(':focus-visible') >= 0;
  if (!hasUniversal) console.log('      no bare :focus-visible rule — the ring is a list again');
  return hasUniversal &&
         /:focus-visible\{outline:2px solid var\(--accInk\);outline-offset:2px/.test(css) &&
         css.indexOf('outline:2px solid var(--hero)') < 0;   // the fill token is never the ring
})());
ok('a clipped shape rings INSIDE itself, in the colour that suits what it sits on', (function () {
  // clip-path cuts an outline clean off, so faceted controls need an inset ring — and on an
  // ACCENT FILL the ink is the wrong token: in light theme --accInk and --acc are nearly the
  // same lightness and the ring measured 1.16:1, i.e. gone. --onAcc is made for that ground.
  var accentRing = (css.match(/\.facet:focus-visible[^{]*\{([^}]*)\}/) || [])[1] || '';
  var neutralRing = (css.match(/\.gtile:focus-visible[^{]*\{([^}]*)\}/) || [])[1] || '';
  var accentOk = /box-shadow:inset 0 0 0 2px var\(--onAcc\)/.test(accentRing) && /outline:none/.test(accentRing);
  var neutralOk = /box-shadow:inset 0 0 0 2px var\(--accInk\)/.test(neutralRing) && /outline:none/.test(neutralRing);
  // and every element that IS clipped must appear in one of the two inset rules
  var clipped = [];
  (css.match(/([^{}]*)\{[^}]*clip-path:var\(--facet\)/g) || []).forEach(function (r) {
    var sel = r.split('{')[0].trim();
    if (sel && sel.indexOf(':focus-visible') < 0) clipped.push(sel);
  });
  var insetSels = accentRing && neutralRing
    ? (css.match(/([^{}]*):focus-visible[^{]*\{[^}]*box-shadow:inset[^}]*\}/g) || []).join(' ') : '';
  var missing = clipped.filter(function (sel) {
    var base = sel.replace(/^[.#]/, '').split(/[ .:]/)[0];
    return insetSels.indexOf(base) < 0;
  });
  if (missing.length) console.log('      clipped but no inset ring: ' + missing.join(', '));
  return accentOk && neutralOk && missing.length === 0;
})());
ok('--acc as a FILL clears 3:1 on every ground it lands on, in both themes', (function () {
  // Toning the accent down on request walked it toward a floor nothing was watching: --acc
  // is the paint for the nav slab, the milestone rungs, the heatmap peak, the current bar and
  // the track fill, and those are non-text elements that must clear 3:1. --surface2 is the
  // lightest ground in dark, so it is the binding case — one more step down breaks it.
  // Text contrast had guards; the fill did not, which is how "make it less bright" could have
  // quietly cost the design its legibility.
  var bad = [];
  ['dark', 'light'].forEach(function (t) {
    var a = tok('acc', t);
    [['surface2', tok('surface2', t)], ['surface', tok('surface', t)], ['bg', tok('bg', t)]].forEach(function (p) {
      var r = cr(a, p[1]);
      if (r < 3) bad.push(t + ' acc on ' + p[0] + ' = ' + r.toFixed(2));
    });
    // and --onAcc must stay AA as text sitting ON that fill
    var onR = cr(tok('onAcc', t), a);
    if (onR < 4.5) bad.push(t + ' onAcc on acc = ' + onR.toFixed(2));
  });
  if (bad.length) console.log('      ' + bad.join('; '));
  return bad.length === 0;
})());
ok('--edge clears the 3:1 non-text minimum on both grounds, both themes', (function () {
  var bad = [];
  ['dark', 'light'].forEach(function (t) {
    var e = tok('edge', t);
    [['surface', tok('surface', t)], ['bg', tok('bg', t)]].forEach(function (p) {
      var r = cr(e, p[1]);
      if (r < 3) bad.push(t + ' edge on ' + p[0] + ' = ' + r.toFixed(2));
    });
  });
  if (bad.length) console.log('      ' + bad.join('; '));
  return bad.length === 0;
})());
ok('the accent split is real: --acc is fill-only, --accInk is the text/icon accent', (function () {
  // in light theme using --acc as a text colour fails AA — the split must not collapse
  var accL = tok('acc', 'light'), inkL = tok('accInk', 'light'), surf = tok('surface', 'light');
  return accL && inkL && cr(inkL, surf) >= 4.5 && cr(accL, surf) < cr(inkL, surf);
})());

// --- v0.31: verified movement + damage mechanics ---
// Sourced from a coaching video, then checked: the peek-velocity and tagging/aim-punch claims
// hold up; the "spam A and D to charge velocity" trick and the radar view-cone claim did not.
ok('the peek drill teaches runway before the swing, with the verified weapon speed cap', (function () {
  var d = FOCI.movement.drills.filter(function (x) { return /full speed/i.test(x.t); })[0];
  if (!d) return false;
  var all = [d.sub, d.m, d.why, d.goal, d.cue, d.rule].join(' ');
  return /215/.test(all) && /cl_showpos/.test(d.where || '') && /accelerat/i.test(d.why || '');
})());
ok('no drill claims you can charge velocity by spamming A and D (that one did not verify)', (function () {
  var bad = [];
  Object.keys(FOCI).forEach(function (k) {
    (FOCI[k].drills || []).forEach(function (d) {
      var all = [d.sub, d.m, d.why, d.goal, d.cue, d.rule].join(' ');
      if (/spam\w*\s+a\s*(and|\+|\/|,)?\s*d\b/i.test(all)) bad.push(k + '/' + d.t);
    });
  });
  if (bad.length) console.log('      unverified velocity-charge wording: ' + bad.join(', '));
  return bad.length === 0;
})());
ok('the torso drill grounds body damage in tagging + aim punch, and keeps the slow weapon-dependent', (function () {
  var d = FOCI.spray.drills.filter(function (x) { return /torso/i.test(x.t); })[0];
  if (!d) return false;
  var w = d.why || '';
  // tagging magnitude depends on the weapon the VICTIM holds — don't let a fixed % creep in
  return /tag/i.test(w) && /aim-?punch/i.test(w) && /depends on/i.test(w) && !/\d+%/.test(w);
})());
ok('the app never claims the radar shows what teammates are looking at (refuted — positions only)', (function () {
  return !/radar[^.]{0,120}(view cone|looking at|watching)/i.test(html);
})());
ok('the bomb clock carries the verified timings, all four of them', (function () {
  var d = FOCI.clutch.drills.filter(function (x) { return /clock craft/i.test(x.t); })[0];
  var w = (d && d.why) || '';
  return /\b40 seconds\b/.test(w) && /\b10 seconds\b/.test(w) && /\b5\b/.test(w) && /3\.5\b/.test(w);
})());
ok('the HE-on-smoke drill is CS2-accurate: a temporary gap, never a full clear', (function () {
  var d = FOCI.utility.drills.filter(function (x) { return /open a smoke/i.test(x.t); })[0];
  if (!d) return false;
  var w = d.why || '';
  return /two to three seconds|2-3 seconds/i.test(w) &&
         /never clears|won'?t clear|not.{0,20}clear the whole/i.test(w + ' ' + (d.rule || '')) &&
         /calibre|caliber/i.test(w);          // bullets open smaller windows, bigger guns wider
})());

// --- v0.30: two frames (stand / aim) is the baseline for a lineup ---
ok('both baseline slots always show — an empty lineup displays its own two gaps', (function () {
  var h = picSlots({}, 0);
  var empties = (h.match(/class="picslot empty"/g) || []).length;
  return PICROLE.length === 2 && empties === 2 &&
         h.indexOf('STAND HERE') >= 0 && h.indexOf('AIM HERE') >= 0 &&
         h.indexOf('data-picslot="0"') >= 0 && h.indexOf('data-picslot="1"') >= 0;
})());
ok('one picture in → the aim slot is still shown as an open gap, not hidden', (function () {
  IMGS.im_s = 'data:image/webp;base64,AAA';
  var h = picSlots({ im: ['im_s'] }, 0);
  delete IMGS.im_s;
  return (h.match(/<img /g) || []).length === 1 &&
         (h.match(/class="picslot empty"/g) || []).length === 1 && h.indexOf('AIM HERE') >= 0;
})());
ok('the pair is labelled stand/aim; extras beyond two are just EXTRA', (function () {
  return picRole(0) === 'STAND HERE' && picRole(1) === 'AIM HERE' &&
         picRole(2) === 'EXTRA' && picRole(3) === 'EXTRA';
})());
ok('a full pair shows no empty slots and offers ADD ANOTHER only past the baseline', (function () {
  IMGS.im_a = 'data:image/webp;base64,AAA'; IMGS.im_b = 'data:image/webp;base64,BBB';
  var h = picSlots({ im: ['im_a', 'im_b'] }, 0);
  delete IMGS.im_a; delete IMGS.im_b;
  return h.indexOf('picslot empty') < 0 && (h.match(/<img /g) || []).length === 2 &&
         /nPic>=PICROLE\.length&&nPic<IMG_PER[\s\S]{0,220}ADD ANOTHER/.test(script);
})());
ok('a single frame can be removed without losing the lineup or its other frame', (function () {
  IMGS.im_a = 'data:image/webp;base64,AAA';
  var h = picSlots({ im: ['im_a'] }, 3);
  delete IMGS.im_a;
  return h.indexOf('data-picdel="3:0"') >= 0 &&
         /imgDrop\(l\.im\[ii\]\);l\.im\.splice\(ii,1\)/.test(script);   // drops the picture too, no orphan
})());
ok('after the first shot it arms the second — the pair completes without hunting for a button', (function () {
  return /var next=l\.im\.length;[\s\S]{0,160}PICTARGET=\(next<PICROLE\.length\)\?idx:null/.test(script) &&
         /PICSLOT=\(next<PICROLE\.length\)\?next:null/.test(script);
})());
ok('the arm prompt names the frame it is asking for', (function () {
  return /PASTE THE “'\+role\+'” SHOT/.test(script) && /var role=picRole\(Math\.min\(/.test(script);
})());
ok('the find-lineups action is a hero-yellow button sitting right under the list, not a grey row', (function () {
  return /\.findbtn\{[^}]*background:var\(--hero\)/.test(html) &&
         /class="findbtn"/.test(script) &&
         /lns\.length\+'<\/div>'\+lnList\+findBtn/.test(script) &&   // above the add form
         script.indexOf('<a class="datarow" style="margin-top:8px;" href="https://csnades.gg/') < 0;
})());

// --- v0.47: the GSI token is a security boundary, not a setting ---
// It lands VERBATIM between two quotes in a KeyValues file that CS2 executes. Backups were
// fully attacker-controlled here (validBackup never inspected settings), so a token carrying
// a quote + newline closes our block and opens a second one — a second GSI endpoint, pointed
// anywhere, exfiltrating live match data. Three separate holes, three guards.
ok('a backup never carries the GSI token off this machine', (function () {
  var st = { lineups: {}, sessions: {}, settings: { gsiToken: 'a1b2c3d4e5f60718293a4b5c6d7e8f90', theme: 'dark' } };
  var b = stateForBackup(st);
  return b.settings.gsiToken === undefined &&
         b.settings.theme === 'dark' &&                 // the rest of settings survives
         st.settings.gsiToken === 'a1b2c3d4e5f60718293a4b5c6d7e8f90';   // and the live state is not mutated
})());
ok('a state with no settings still backs up (the strip must not assume the key exists)', (function () {
  var b = stateForBackup({ lineups: {}, sessions: {} });
  return b && b.settings === undefined;
})());
ok('any token that is not exactly 32 lowercase hex is re-minted rather than used', (function () {
  // the shape check itself, and that it gates the mint
  return /var GSI_TOKEN_RE=\/\^\[0-9a-f\]\{32\}\$\//.test(script) &&
         /if\(!GSI_TOKEN_RE\.test\(st\.settings\.gsiToken\|\|""\)\)\{st\.settings\.gsiToken=randToken\(\);save\(st\);\}/.test(script);
})());
ok('an import keeps THIS machine\'s token and drops whatever the file carried', (function () {
  return /var mine=\(load\(\)\.settings\|\|\{\}\)\.gsiToken;/.test(script) &&
         /if\(GSI_TOKEN_RE\.test\(mine\|\|""\)\)d2\.settings\.gsiToken=mine; else delete d2\.settings\.gsiToken;/.test(script) &&
         /d2\.settings=d2\.settings\|\|\{\};/.test(script);   // runs even when the file has no settings block
})());
ok('the token is validated again in Rust, where it is actually trusted', (function () {
  var rs = require('fs').readFileSync(require('path').join(__dirname, '..', 'src-tauri', 'src', 'lib.rs'), 'utf8');
  return /fn gsi_token_ok\(t: &str\) -> bool \{\s*t\.len\(\) == 32 && t\.chars\(\)\.all\(\|c\| c\.is_ascii_hexdigit\(\) && !c\.is_ascii_uppercase\(\)\)/.test(rs) &&
         // both sinks: the listener and the file writer
         (rs.match(/if !gsi_token_ok\(&token\) \{\s*return Err\("refused: malformed GSI token"\.into\(\)\);/g) || []).length === 2 &&
         /#\[tauri::command\]\s*fn start_gsi/.test(rs) &&         // the attribute stayed on the command
         /#\[tauri::command\]\s*fn write_gsi_config/.test(rs);
})());

// --- v0.47: the pause must hold the programme CLOCK, not just the number on screen ---
// planWeek pinned the week to p.from only WHILE isPausedOn was true, so the instant a pause
// ended — by expiry or by RESUME NOW — every paused day counted as elapsed programme time.
// Take two weeks off in week 3 and you came back to week 5, having trained no day of either.
(function () {
  function planFrom(created) { return { plan: { created: created }, settings: {} }; }
  ok('a pause that runs its full course does not fast-forward the plan', (function () {
    var st = planFrom('2026-01-01');
    st.settings.pause = { from: '2026-01-15', weeks: 2 };
    return planWeek(st, new Date(2026,0,20)) === 3 &&    // pinned while paused
           planWeek(st, new Date(2026,0,29)) === 3 &&    // STILL week 3 the day it expires — not spent
           planWeek(st, new Date(2026,1,5))  === 4;      // and it advances normally again after
  })());
  ok('RESUME NOW holds only the days actually served', (function () {
    var st = planFrom('2026-01-01');
    st.settings.pause = { from: '2026-01-15', weeks: 6, endedOn: '2026-01-22' };
    return pauseServed(st, new Date(2026,1,5)) === 7 &&  // seven served, not the booked forty-two
           planWeek(st, new Date(2026,1,5)) === 5;       // so day 35 behaves like day 28, i.e. week 5
  })());
  ok('a plan with no pause is untouched by the pause maths', (function () {
    var st = planFrom('2026-01-01');
    return pauseServed(st, new Date(2026,0,20)) === 0 && planWeek(st, new Date(2026,0,20)) === 3;
  })());

  // --- v0.47: week 13+ is PAST the programme, not a permanent deload ---
  // programWeek clamped to 12, and isDeloadWeek asks w%4===0, so from day 84 every single
  // week was a deload week: every drill halved forever, card still saying "Week 12".
  function planAtWeek(week) {
    var created = new Date(); created.setDate(created.getDate() - (week - 1) * 7);
    return { weekly:{0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match'},
             keystone:'cstrafe', used:['cstrafe'], profile:{}, created: dateKey(created) };
  }
  ok('deload stops at week 12 instead of running forever', (function () {
    var hits = [], past = [];
    for (var w = 1; w <= 12; w++) if (isDeloadWeek({ plan: planAtWeek(w), settings:{} }, new Date())) hits.push(w);
    for (var v = 13; v <= 40; v++) if (isDeloadWeek({ plan: planAtWeek(v), settings:{} }, new Date())) past.push(v);
    return hits.join(',') === '4,8,12' && past.length === 0;
  })());
  ok('past the end the deload card goes quiet and the real load comes back', (function () {
    var st = { plan: planAtWeek(16), settings: {} };
    return deloadCard(st, FOCI.cstrafe, st.plan, new Date()) === '' &&
           focusMins(FOCI.cstrafe, st.plan, false) > focusMins(FOCI.cstrafe, st.plan, true);
  })());
  ok('the graduate achievement reads the pause-aware clock, not a raw date diff', (function () {
    var a = null; for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === 'graduate') a = ACHIEVEMENTS[i];
    var st = { plan: planAtWeek(6), settings: { pause: { from: dateKey(new Date(Date.now() - 14*86400000)), weeks: 2 } } };
    return a && a.val === planWeek && a.val(st) === 4;    // two of those six weeks were paused
  })());
})();

// --- v0.47: a night is not a calendar day, and one handler is not three buttons ---
(function () {
  function nightAt(h, m) { var d = new Date(2026, 5, 10); d.setHours(h, m || 0, 0, 0); return d; }
  function stWithLosses(dayKey, n) {
    var st = { sessions: {}, settings: {} };
    st.sessions[dayKey] = { warm: true, losses: n };
    return st;
  }

  ok('two losses logged at 23:30 are still two losses at 03:00', (function () {
    var st = stWithLosses('2026-06-10', 2);
    // 23:30 on the 10th and 03:00 on the 11th are the SAME night
    return nightLosses(st, nightAt(23, 30)) === 2 &&
           nightLosses(st, new Date(2026, 5, 11, 3, 0, 0)) === 2 &&
           // ...and 03:00 two nights later is not
           nightLosses(st, new Date(2026, 5, 12, 3, 0, 0)) === 0;
  })());
  ok('the stop-loss card survives midnight — it was dead for five of its six hours', (function () {
    var st = stWithLosses('2026-06-10', 2);
    var at2330 = tiltCard(st, nightAt(23, 30));
    var at0300 = tiltCard(st, new Date(2026, 5, 11, 3, 0, 0));
    var at1400 = tiltCard(st, nightAt(14, 0));
    return at2330.indexOf('STOP-LOSS') >= 0 &&
           at0300.indexOf('STOP-LOSS') >= 0 &&      // this was '' before the fix
           at0300.indexOf('03:00') >= 0 &&          // and it names the real hour
           at1400 === '';                           // still silent outside the window
  })());
  ok('one loss is never a stop-loss, whatever the hour', (function () {
    var st = stWithLosses('2026-06-10', 1);
    return tiltCard(st, nightAt(23, 30)) === '' &&
           tiltCard(st, new Date(2026, 5, 11, 3, 0, 0)) === '';
  })());
  ok('the night spans exactly two buckets before 05:00 and one after', (function () {
    return nightKeys(nightAt(23, 30)).join(',') === '2026-06-10' &&
           nightKeys(new Date(2026, 5, 11, 4, 59, 0)).join(',') === '2026-06-11,2026-06-10' &&
           nightKeys(new Date(2026, 5, 11, 5, 0, 0)).join(',') === '2026-06-11';
  })());
  ok('the gate shows the same number the stop-loss is counting', (function () {
    var st = stWithLosses('2026-06-10', 2);
    var past = new Date(2026, 5, 11, 3, 0, 0);
    var n = nightLosses(st, past);
    var card = gateCard(st.sessions['2026-06-10'], n);
    // the card is rendered with the night count, not sess.losses — and it must be wired
    // that way at the call site too, or the gate reads 0 while the tilt card reads 2
    return n === 2 && card.indexOf('>2</div>') >= 0 && /Stop-loss hit/.test(card) &&
           /gateCard\(sess,nightLosses\(st,now\)\)/.test(script);
  })());
  ok('RESET clears the whole night, not just today’s bucket', (function () {
    return /var nk=nightKeys\(ad\);/.test(script) &&
           /for\(var nki=0;nki<nk\.length;nki\+\+\)\{var sy=s2\.sessions\[nk\[nki\]\];if\(sy\)sy\.losses=0;\}/.test(script);
  })());

  ok('every DO THE TEN button is wired, not just the first one on screen', (function () {
    // three independent emitters: the lapse card, Today's headline, the tilt card
    var emitted = (script.match(/data-quickstart="1"/g) || []).length;
    return emitted === 3 &&
           /var qs=root\.querySelectorAll\("\[data-quickstart\]"\)/.test(script) &&
           /for\(var qsi=0;qsi<qs\.length;qsi\+\+\)/.test(script) &&
           script.indexOf('var qs=root.querySelector("[data-quickstart]")') < 0;
  })());

  ok('the More sheet uses its own attribute so wire() cannot steal its handlers', (function () {
    // wire() rebinds every [data-go] in document.body to a plain go(); a gsiRender landing
    // while the sheet is open used to replace close-then-navigate with navigate-only,
    // leaving the scrim up and #app inert — unusable until reload.
    return /data-sheet-go="gear"/.test(script) && /data-sheet-go="setup"/.test(script) &&
           /el\.querySelectorAll\("\[data-sheet-go\]"\)/.test(script) &&
           !/class="shrow" data-go=/.test(script) &&
           /closeMore\(true\);go\(b\.getAttribute\("data-sheet-go"\)\)/.test(script);
  })());
  ok('dismissing the sheet returns focus to the tab that opened it', (function () {
    return /moreFrom=document\.activeElement\|\|null;/.test(script) &&
           /if\(keepFocus!==true&&moreFrom&&moreFrom\.focus\)/.test(script) &&
           // NOT onclick=closeMore — that passes the MouseEvent in as keepFocus
           script.indexOf('cl[i].onclick=closeMore;') < 0 &&
           /cl\[i\]\.onclick=function\(\)\{closeMore\(\);\}/.test(script);
  })());
})();

// --- v0.47: three modals that were not modal, and a live region that would not stop talking ---
ok('the guided session puts focus back on the button you pressed, not on END SESSION', (function () {
  // renderSession rewrites innerHTML, which removes the focused node — so the old
  // "only focus ✕ if focus isn't already inside" test passed every single time and every
  // PAUSE / SKIP / DONE parked focus on the destructive control. Enter again ended the run.
  return /var wasOn=\(document\.activeElement&&document\.activeElement\.getAttribute&&ov&&ov\.contains\(document\.activeElement\)\)/.test(script) &&
         /\?document\.activeElement\.getAttribute\("data-sess"\):null;/.test(script) &&
         /var back=wasOn\?ov\.querySelector\('\[data-sess="'\+wasOn\+'"\]'\):null;/.test(script) &&
         /if\(back\)\{try\{back\.focus\(\);\}catch\(_\)\{\}\}/.test(script) &&
         // the ✕ fallback survives, but only when nothing else has a claim
         /else\{var x=ov\.querySelector\('\[data-sess="end"\]'\);/.test(script);
})());
ok('the lightbox actually behaves like the modal it declares itself to be', (function () {
  var i = script.indexOf('function showLightbox(');
  var body = script.slice(i, script.indexOf('\n  function hideLightbox', i));
  var hide = script.slice(script.indexOf('function hideLightbox('));
  hide = hide.slice(0, hide.indexOf('\n  function ', 10));
  return html.indexOf('id="lightbox" role="dialog" aria-modal="true"') >= 0 &&
         /app\.setAttribute\("inert",""\)/.test(body) && /tb\.setAttribute\("inert",""\)/.test(body) &&
         /el\.setAttribute\("tabindex","-1"\);try\{el\.focus\(\);\}catch/.test(body) &&
         /lightFrom=document\.activeElement\|\|null;/.test(body) &&
         // and every one of those is undone on close, or the app stays inert forever
         /app\.removeAttribute\("inert"\)/.test(hide) && /tb\.removeAttribute\("inert"\)/.test(hide) &&
         /el\.removeAttribute\("tabindex"\)/.test(hide) &&
         /if\(lightFrom&&lightFrom\.focus\)/.test(hide);
})());
ok('the tour no longer steals Enter from its own buttons', (function () {
  // Enter on BACK used to move the tour FORWARD, and SKIP could not be reached at all
  return /var onControl=tag==="button"\|\|tag==="a"\|\|tag==="input"\|\|tag==="select"\|\|tag==="textarea";/.test(script) &&
         /if\(e\.key==="ArrowRight"\|\|\(e\.key==="Enter"&&!onControl\)\)/.test(script) &&
         script.indexOf('else if(e.key==="ArrowRight"||e.key==="Enter"){e.preventDefault();TOUR_I++') < 0 &&
         /if\(e\.key==="Escape"\)\{e\.preventDefault\(\);endTour\(\);return;\}/.test(script);   // Escape still wins outright
})());
ok('the update banner is announced once, not on every interaction', (function () {
  return /aria-live="polite"/.test(html) &&
         /var _updHtml=null;/.test(script) &&
         /if\(ub\)\{var ubh=updateBanner\(\);if\(ubh!==_updHtml\)\{_updHtml=ubh;ub\.innerHTML=ubh;\}\}/.test(script) &&
         script.indexOf('if(ub)ub.innerHTML=updateBanner();') < 0;
})());

// --- v0.47: bestStreak was O(warm-days × streak-length), three times per Progress render ---
(function () {
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }   // not exported
  function yearOfTraining() {
    var st = { sessions: {}, settings: {}, plan: { created: '2025-08-01',
      weekly: { 0:'cstrafe',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'cstrafe',6:'cstrafe' } } };
    var d = new Date(2025, 7, 1);
    for (var i = 0; i < 365; i++) { st.sessions[dateKey(d)] = { warm: true }; d = addDays(d, 1); }
    return st;
  }
  ok('a year of training computes the record once and reuses it', (function () {
    var st = yearOfTraining();
    var t0 = Date.now(); var a = bestStreak(st); var cold = Date.now() - t0;
    var t1 = Date.now(); var b = bestStreak(st); var warm = Date.now() - t1;
    var t2 = Date.now(); for (var i = 0; i < 20; i++) bestStreak(st); var twenty = Date.now() - t2;
    if (!(a === b && a >= 365)) console.log('      best=' + a + '/' + b);
    console.log('      365 warm days: first ' + cold + 'ms, cached ' + warm + 'ms, 20 more ' + twenty + 'ms');
    return a === b && a >= 365 && twenty <= Math.max(2, cold);   // 20 cached calls cost less than one cold one
  })());
  ok('the cache is keyed on every input, so nothing can go stale', (function () {
    var st = yearOfTraining();
    var base = bestStreak(st);
    // add a warm day -> different set
    var st2 = yearOfTraining(); st2.sessions['2026-08-05'] = { warm: true };
    var addDay = bestStreak(st2) !== base || true;   // value may match; the SIGNATURE must not
    var sigA = bestStreakSig(st, warmDays(st), freezeBudget(st));
    var sigB = bestStreakSig(st2, warmDays(st2), freezeBudget(st2));
    // pause and plan schedule both feed streakDetail, so both must move the signature
    var st3 = yearOfTraining(); st3.settings.pause = { from: '2026-01-01', weeks: 2 };
    var st4 = yearOfTraining(); st4.plan.weekly = { 0:'rest',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'match',6:'match' };
    var st5 = yearOfTraining(); st5.plan.startedOn = '2025-09-01';
    var sigC = bestStreakSig(st3, warmDays(st3), freezeBudget(st3));
    var sigD = bestStreakSig(st4, warmDays(st4), freezeBudget(st4));
    var sigE = bestStreakSig(st5, warmDays(st5), freezeBudget(st5));
    return addDay && sigA !== sigB && sigA !== sigC && sigA !== sigD && sigA !== sigE;
  })());
  ok('swapping one warm day for another changes the signature (length alone would not)', (function () {
    var a = yearOfTraining(), b = yearOfTraining();
    delete b.sessions['2025-08-10']; b.sessions['2026-08-09'] = { warm: true };
    var ka = warmDays(a), kb = warmDays(b);
    return ka.length === kb.length &&                                   // same COUNT...
           bestStreakSig(a, ka, freezeBudget(a)) !== bestStreakSig(b, kb, freezeBudget(b));  // ...different set
  })());

  // --- v0.47: the share PNG is encoded once, not on every Progress render ---
  ok('the share signature moves with everything the card draws, and nothing else', (function () {
    var base = { sessions: {}, settings: { tag: 'zy' }, plan: { created: dateKey(new Date()), keystoneName: 'Counter-strafing',
      weekly: { 0:'cstrafe',1:'cstrafe',2:'cstrafe',3:'cstrafe',4:'cstrafe',5:'cstrafe',6:'cstrafe' } } };
    function clone() { return JSON.parse(JSON.stringify(base)); }
    var s0 = shareSig(base);
    var tag = clone(); tag.settings.tag = 'niko';
    var keystone = clone(); keystone.plan.keystoneName = 'Spray control';
    var week = clone(); week.plan.created = dateKey(addDays(new Date(), -40));
    // Vary ONLY the week strip: pick a day in this week that is neither today nor yesterday,
    // so curStreak cannot move and the difference has to come from the strip itself.
    var now = new Date(), mon = addDays(now, -((now.getDay() + 6) % 7));
    var skip = [dateKey(now), dateKey(addDays(now, -1))], strip = null;
    for (var i = 0; i < 7; i++) { var k = dateKey(addDays(mon, i)); if (skip.indexOf(k) < 0) { strip = k; break; } }
    var warm = clone(); warm.sessions[strip] = { warm: true };
    var noise = clone(); noise.settings.theme = 'light'; noise.metrics = { cstrafe: { pct: 71 } };
    if (curStreak(warm) !== curStreak(base)) console.log('      strip day moved curStreak — test does not isolate wk');
    return shareSig(tag) !== s0 && shareSig(keystone) !== s0 &&
           shareSig(week) !== s0 &&
           curStreak(warm) === curStreak(base) && shareSig(warm) !== s0 &&   // the strip alone busts it
           shareSig(noise) === s0;         // things the card does not draw must NOT bust the cache
  })());
})();

// --- v0.47: "erase all data" now erases the pictures too ---
ok('erasing wipes the IndexedDB picture store, not just localStorage', (function () {
  IMGS.im_gone_a = 'data:image/webp;base64,AAA';
  IMGS.im_gone_b = 'data:image/webp;base64,BBB';
  imgClear();                                          // sync half: the in-memory mirror
  var emptied = !IMGS.im_gone_a && !IMGS.im_gone_b;
  delete IMGS.im_gone_a; delete IMGS.im_gone_b;
  return emptied &&
         /objectStore\("img"\)\.clear\(\)/.test(script) &&      // and the store itself
         // wired into the reset handler, after localStorage and the desktop mirror
         /try\{imgClear\(\);\}catch\(_\)\{\}/.test(script) &&
         script.indexOf('if(isNative)try{TAURI.core.invoke("backup_delete")') <
           script.indexOf('try{imgClear();}catch(_){}');
})());

// --- v0.47: a failing desktop mirror is no longer invisible ---
ok('a swallowed backup_write no longer looks identical to a working one', (function () {
  // needsBackup returned false on desktop unconditionally, on the strength of a mirror whose
  // every failure was eaten by a bare .catch(). No file, no nudge, no message.
  return /var _mirrorT=null,_mirrorFail=false;/.test(script) &&
         /function mark\(bad\)\{if\(_mirrorFail!==bad\)\{_mirrorFail=bad;try\{render\(\);\}catch\(_\)\{\}\}\}/.test(script) &&
         /\.then\(function\(\)\{mark\(false\);\},function\(\)\{mark\(true\);\}\);/.test(script) &&
         script.indexOf('invoke("backup_write",{json:JSON.stringify(stateForBackup(st))}).catch(function(){})') < 0 &&
         /function mirrorFailed\(\)\{return isNative&&_mirrorFail;\}/.test(script) &&
         /if\(mirrorFailed\(\)\)return true;\r?\n    if\(isNative\)return false;/.test(script) &&   // fallback BEFORE the desktop opt-out
         /AUTO-BACKUP FAILING/.test(script);
})());
ok('the desktop opt-out still holds while the mirror is working', (function () {
  // isNative is false in this sandbox, so assert the ordering in source: the min-sessions
  // floor and the snooze both run BEFORE the mirror check, or a broken mirror would nag
  // someone on their first day and ignore "not now".
  var fn = script.slice(script.indexOf('function needsBackup('));
  fn = fn.slice(0, fn.indexOf('\n  function ', 10));
  var iMin = fn.indexOf('n<BACKUP_MIN_SESSIONS'), iSnooze = fn.indexOf('bkSnooze'), iFail = fn.indexOf('mirrorFailed()');
  return iMin >= 0 && iSnooze > iMin && iFail > iSnooze;
})());

// --- v0.47: day counts survive a DST transition ---
ok('a spring-forward inside the window does not lose a day', (function () {
  // 2026-03-08 is the US spring-forward; the span below is exactly 21 calendar days but
  // 20.958 real ones, so Math.floor returned 20 and the three-week nudge waited another day.
  var span = daysBetween('2026-02-22', new Date(2026, 2, 15, 12, 0, 0));
  var plain = daysBetween('2026-06-01', new Date(2026, 5, 22, 12, 0, 0));
  return span === 21 && plain === 21 &&
         script.indexOf('Math.floor((midnight(now||new Date())-midnight(parseKey(last)))/86400000)') < 0 &&
         /return Math\.round\(\(midnight\(now\|\|new Date\(\)\)-midnight\(parseKey\(fromKey\)\)\)\/86400000\);/.test(script) &&
         // both spans go through it — the export age AND the snooze
         /if\(sn&&daysBetween\(sn,now\)<14\)return false;/.test(script);
})());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
