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
        dateKey, drillList, FOCI, bestStreak, weekCounts, reviewTotals, barChart, MAPS,
        buildTargets, shouldRegisterSW, isTauriOrigin, CALM, PROTOCOLS, trainingDayCount, weekdayCount, isTrainingDay, QUIZ, rankLabel, benchHint, missedYesterday,
        lfyParseId, lfyPct, lfySuggest, lfyProfileUrl, LFY_BENCH, updateBanner, UPD, planReview, applyReview, tkey, lapseInfo, lapseCard, reappraisalCard } = sandbox.module.exports;

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
  var m = html.match(/#session \.ssub\{[^}]*\}/);
  return !!m && /color:var\(--text\)/.test(m[0]) && !/--muted|--faint/.test(m[0]);
})());
ok('session type scales up past the phone breakpoint', (function () {
  return /#session \.sname\{font-size:clamp\(3\d/.test(html) &&
         /#session \.ssub\{font-size:clamp/.test(html);
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
  return ['>MAP<', '>DO<', '>GOAL<', '>MINDSET<', '>RIGHT<', '>WRONG<'].every(function (l) { return html.indexOf(l) >= 0; });
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
})();
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
         html.indexOf('sv good') >= 0 && html.indexOf('sv warn') >= 0;
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
  if (opts.deaths) { var k = dateKey(new Date()); st.reviews[k] = opts.deaths; }
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
ok('rifle counter-strafe copy never asserts a dead stop', (function () {
  var bad = [];
  FOCI.cstrafe.drills.forEach(function (d) {
    ['goal', 'm', 'rule', 'why', 'sub'].forEach(function (f) {
      var v = d[f] || '';
      // "the stop" / drill names are idiomatic; asserting you must BE stopped is not
      if (/(you're|you are|until|wait for (a|the))\s+(fully\s+)?stopped/i.test(v) ||
          /\bfully stopped\b/i.test(v)) bad.push(d.t + '.' + f);
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
ok('it only renders on match nights, before the gate checklist',
  /focusKey==="match"&&!backfill\)\?\(reappraisalCard\(\)\+gateCard/.test(html));


console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
