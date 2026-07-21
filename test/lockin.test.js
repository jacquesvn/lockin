// Unit tests for Lockin's shipped logic. These evaluate the REAL inline script from
// docs/index.html in a stubbed DOM sandbox and test its exported functions — so a
// regression in the actual app (not a mirror copy) fails CI.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

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

const { generatePlan, computeStreak, richText, validBackup, programWeek,
        dateKey, drillList, FOCI, bestStreak, weekCounts, reviewTotals, sparkBars, sparkLine, MAPS,
        buildTargets, shouldRegisterSW, isTauriOrigin, CALM, PROTOCOLS, trainingDayCount, weekdayCount, isTrainingDay, QUIZ, rankLabel, benchHint, missedYesterday } = sandbox.module.exports;

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

// --- programWeek is 1..12 and starts at week 1 ---
ok('programWeek day 0 = week 1', programWeek({ created: '2026-07-01' }, new Date('2026-07-01T12:00:00')) === 1);
ok('programWeek day 7 = week 2', programWeek({ created: '2026-07-01' }, new Date('2026-07-08T12:00:00')) === 2);
ok('programWeek clamps to 12', programWeek({ created: '2026-01-01' }, new Date('2026-07-01T12:00:00')) === 12);

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

ok('sparkBars renders an svg for data', /^<svg/.test(sparkBars([1, 2, 3])));
ok('sparkBars is empty with no data', sparkBars([]) === '');
ok('sparkLine needs 2+ points', sparkLine([3]) === '' && /^<svg/.test(sparkLine([3, 4])));

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
    return FOCI[k].drills.map(function (d) { return d.sub; }).join(' ');
  }).join(' ');
  return ['Aim Arena','Training 01','Movement Mirage','Movement Hub','Target Training','Reflex Dots','CST Labs','CS2 Labs']
    .every(function (m) { return all.indexOf(m) >= 0; });
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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
