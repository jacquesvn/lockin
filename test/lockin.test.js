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
        dateKey, drillList, FOCI, bestStreak, weekCounts, reviewTotals, sparkBars, sparkLine, MAPS } = sandbox.module.exports;

let pass = 0, fail = 0;
function ok(n, c) { if (c) { pass++; console.log('  ok  ' + n); } else { fail++; console.log('FAIL  ' + n); } }

const KEYS = ['cstrafe','consistency','placement','spray','utility','positioning','clutch','entry','awp','rifle','match','rest'];
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

['cstrafe','consistency','placement','spray','utility','positioning','clutch','entry'].forEach(function (w) {
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
