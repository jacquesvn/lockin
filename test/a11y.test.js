/* Lockin — accessibility guards (WCAG 2.1 AA, with 2.2 criteria noted where they apply).
 *
 * WHY THIS EXISTS. Five accessibility defects were fixed in v0.47 — a lightbox that declared
 * aria-modal and trapped nothing, a session overlay that threw focus onto its own destructive
 * button, a tour that stole Enter from its own controls, a live region that re-announced on
 * every interaction, and a 7.5px type floor. Every one was found by an audit, not by a test,
 * which means every one could come back the same way.
 *
 * Contrast is COMPUTED, not eyeballed: getComputedStyle returns raw oklch() strings, so the
 * only honest way to measure this is oklch -> oklab -> linear sRGB -> relative luminance,
 * with alpha composited over the real backdrop. Doing it any other way is how a palette ships
 * at 1.6:1 while a test reports green.
 *
 * The screen checks render the REAL app through the shared harness and read the HTML it
 * actually emits, rather than grepping source for what it might emit.
 */
const { bootApp, html } = require('./harness.js');
const css = html.match(/<style>([\s\S]*)<\/style>/)[1];
const shell = html.slice(0, html.indexOf('<script>'));

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name); }
}

/* ---------------------------------------------------------- oklch -> luminance ---- */
function oklchToLinear(L, C, H) {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map((v) => Math.min(1, Math.max(0, v)));
}
const luminance = (lin) => 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
function parseColor(str) {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/.exec(str);
  return m ? { lin: oklchToLinear(+m[1], +m[2], +m[3]), alpha: m[4] === undefined ? 1 : +m[4] } : null;
}
const over = (fg, bg) => (fg.alpha >= 1 ? fg.lin : fg.lin.map((v, i) => v * fg.alpha + bg[i] * (1 - fg.alpha)));

function blockAfter(marker) {
  const i = css.indexOf(marker);
  if (i < 0) return '';
  const open = css.indexOf('{', i);
  let depth = 0, j = open;
  for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}') { depth--; if (!depth) break; } }
  return css.slice(open, j);
}
function tokensFrom(block) {
  const t = {}; const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g; let m;
  while ((m = re.exec(block))) t[m[1]] = m[2].trim();
  return t;
}
const darkT = tokensFrom(blockAfter(':root{'));
const lightT = tokensFrom(blockAfter('[data-theme="light"]'));
function resolve(T, name, depth) {
  depth = depth || 0;
  if (depth > 8) return null;
  const v = T[name] !== undefined ? T[name] : darkT[name];
  if (v === undefined) return null;
  const vm = /var\(\s*--([a-zA-Z0-9-]+)\s*\)/.exec(v);
  return vm ? resolve(T, vm[1], depth + 1) : parseColor(v);
}
function contrast(T, fgTok, groundTok) {
  const g = resolve(T, groundTok), f = resolve(T, fgTok);
  if (!g || !f) return null;
  const gLin = over(g, [0, 0, 0]);
  return ratio(luminance(over(f, gLin)), luminance(gLin));
}

console.log('\n— accessibility —\n');

/* ---------------------------------------------------------------- 1.4.3 contrast ---- */
const GROUNDS = ['stage', 'bg', 'surface', 'surface2'];
const TEXT = ['text', 'muted', 'faint', 'accInk', 'good-ink', 'bad-ink', 'info'];
ok('every text token clears 4.5:1 on every ground, in both themes', (function () {
  const bad = [];
  [['dark', darkT], ['light', lightT]].forEach(([theme, T]) => {
    GROUNDS.forEach((g) => TEXT.forEach((f) => {
      const r = contrast(T, f, g);
      if (r === null) { bad.push(theme + ' ' + f + '/' + g + ' unresolved'); return; }
      if (r < 4.5) bad.push(theme + ' ' + f + ' on ' + g + ' = ' + r.toFixed(2) + ':1');
    }));
  });
  if (bad.length) console.log('      ' + bad.join('\n      '));
  // Prove the maths DISCRIMINATES rather than returning a constant: body text must read
  // high and a 10%-alpha hairline must read low. A converter that silently returns the
  // same number for everything would otherwise sail through as a pass.
  const hi = contrast(darkT, 'text', 'bg'), lo = contrast(darkT, 'line', 'surface2');
  if (!(hi > 10 && lo !== null && lo < 3)) {
    console.log('      contrast maths is not discriminating: text/bg=' + (hi && hi.toFixed(2)) + ' line/surface2=' + (lo && lo.toFixed(2)));
    return false;
  }
  return bad.length === 0;
})());

ok('text on a filled accent button clears 4.5:1 in both themes', (function () {
  const bad = [];
  [['dark', darkT], ['light', lightT]].forEach(([theme, T]) => {
    [['onAcc', 'acc'], ['onhero', 'hero']].forEach(([f, g]) => {
      const r = contrast(T, f, g);
      if (r === null || r < 4.5) bad.push(theme + ' ' + f + '/' + g + ' = ' + (r === null ? 'unresolved' : r.toFixed(2)));
    });
  });
  if (bad.length) console.log('      ' + bad.join(', '));
  return bad.length === 0;
})());

ok('the border token used for real edges clears 3:1 (1.4.11 non-text)', (function () {
  const bad = [];
  [['dark', darkT], ['light', lightT]].forEach(([theme, T]) => {
    GROUNDS.forEach((g) => { const r = contrast(T, 'edge', g); if (r === null || r < 3) bad.push(theme + ' edge/' + g + ' = ' + (r === null ? 'unresolved' : r.toFixed(2))); });
  });
  if (bad.length) console.log('      ' + bad.join(', '));
  // --line2 is documented as DECORATIVE and must stay unused; if it comes back it needs 3:1
  const line2Used = /var\(--line2\)/.test(css);
  if (line2Used) console.log('      --line2 is in use again — it measures ~1.25:1 in light theme');
  return bad.length === 0 && !line2Used;
})());

/* ------------------------------------------------------------- 2.4.7 focus ---- */
ok('no rule kills the focus ring without replacing it', (function () {
  // Strip comments first. Without this, a comment that MENTIONS outline:none is read as
  // part of the following selector and reported as a naked rule — which is exactly what
  // the comment explaining this very fix did on its first run.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const rules = (bare.match(/([^{}]+)\{([^{}]*)\}/g) || []).filter((r) => /outline\s*:\s*none/.test(r));
  const naked = rules.filter((r) => !/box-shadow|outline-offset/.test(r) && !/#main:focus/.test(r));
  if (naked.length) console.log('      ' + naked.map((r) => r.split('{')[0].trim().slice(0, 70)).join('\n      '));
  return naked.length === 0;
})());

ok('text inputs get the real focus ring, not a hue-only border swap', (function () {
  // In dark theme --line -> --hero is 1.21:1: same brightness, different hue, on a 1px
  // border. That is not a focus indicator for anyone who cannot separate the two hues.
  const swapOnly = /input:focus\{outline:none/.test(css);
  const ringExists = /:focus-visible\{outline:2px solid var\(--accInk\);outline-offset:2px/.test(css);
  const change = (function () {
    const line = resolve(darkT, 'line'), hero = resolve(darkT, 'hero'), s2 = resolve(darkT, 'surface2');
    const gLin = over(s2, [0, 0, 0]);
    return ratio(luminance(over(line, gLin)), luminance(over(hero, gLin)));
  })();
  if (change >= 3) console.log('      note: --line/--hero now differ by ' + change.toFixed(2) + ':1, the border alone would do');
  return !swapOnly && ringExists;
})());

/* --------------------------------------------------------- 2.4.1 bypass blocks ---- */
ok('a skip link exists, is reachable, and targets a focusable main', (function () {
  const link = /<a class="skip" href="#main">/.test(shell);
  const target = /<main[^>]*id="main"[^>]*tabindex="-1"/.test(shell);
  const styled = /\.skip\{[^}]*position:absolute[^}]*\}/.test(css) && /\.skip:focus\{top:12px;\}/.test(css);
  // display:none or visibility:hidden would take it out of the tab order entirely — the
  // classic way a skip link ships broken
  const rule = (css.match(/\.skip\{[^}]*\}/) || [''])[0];
  const killed = /display\s*:\s*none|visibility\s*:\s*hidden/.test(rule);
  if (!(link && target && styled && !killed))
    console.log('      link=' + link + ' target=' + target + ' styled=' + styled + ' killed=' + killed);
  return link && target && styled && !killed;
})());

ok('the skip link comes before the sidebar it exists to skip', (function () {
  // Comments out first: the comment above the skip link contains the literal "<main>",
  // and indexOf found THAT before the element, inverting the result.
  const doc = shell.replace(/<!--[\s\S]*?-->/g, ' ');
  const iSkip = doc.indexOf('class="skip"'), iSide = doc.indexOf('<aside id="side"'), iMain = doc.indexOf('<main');
  if (!(iSkip >= 0 && iSide > iSkip && iMain > iSide))
    console.log('      skip=' + iSkip + ' aside=' + iSide + ' main=' + iMain);
  return iSkip >= 0 && iSide > iSkip && iMain > iSide;
})());

/* ------------------------------------------------------------ 2.5.8 target size ---- */
ok('no interactive control is smaller than 24px, and the destructive one is 44', (function () {
  const small = [];
  const re = /([^{}]+)\{([^{}]*)\}/g; let m;
  while ((m = re.exec(css))) {
    const sel = m[1].replace(/\s+/g, ' ').trim(), body = m[2];
    if (!/\.(pbtn|gbtn|btncopy|drow|gcheck|opt|tab|subtab|moretog|shrow|rtoggle|pausebtn|siconx|updbar-x|findbtn)\b/.test(sel)) continue;
    if (/svg|::|\.gbox/.test(sel)) continue;                    // icons inside a bigger control
    const h = /(?:^|;)\s*(?:min-)?height\s*:\s*([\d.]+)px/.exec(body);
    if (h && +h[1] < 24) small.push(sel.slice(-46) + ' = ' + h[1] + 'px');
  }
  const sicon = /#session \.siconx\{[^}]*height:44px/.test(css);
  if (small.length) console.log('      ' + small.join('\n      '));
  if (!sicon) console.log('      the session close button is back under 44px');
  return small.length === 0 && sicon;
})());

/* ---------------------------------------------------------------- 2.3.3 motion ---- */
ok('every animation and transition is switched off under prefers-reduced-motion', (function () {
  const blanket = /@media \(prefers-reduced-motion:reduce\)\{\*,\*::before,\*::after\{animation-duration:\.001ms!important;animation-iteration-count:1!important;transition-duration:\.001ms!important;\}\}/.test(css);
  const anims = (css.match(/animation\s*:\s*[^;]+/g) || []).length;
  if (!blanket) console.log('      the blanket override is gone and ' + anims + ' animations are unguarded');
  return blanket && anims > 0;      // if anims hits 0 the guard is measuring nothing
})());

/* ------------------------------------------------------- rendered-screen checks ---- */
function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const NOW = new Date(2026, 1, 10, 20, 0, 0);
const created = new Date(NOW); created.setDate(created.getDate() - 40);
const sessions = {};
for (let i = 40; i >= 0; i -= 2) { const d = new Date(NOW); d.setDate(d.getDate() - i); sessions[key(d)] = { warm: true, feel: 4 }; }
let seed = bootApp(null, NOW);
const plan = seed.X.generatePlan({ rank: 'mid', weapon: 'rifle', role: 'entry', weak: ['cstrafe'], time: '30', days: '4', goal: 'consistency' });
plan.created = key(created); plan.startedOn = key(created);
const app = bootApp({ plan, sessions, settings: {}, metrics: {}, reviews: {}, lineups: {},
                      planReviews: {}, debriefs: {}, matches: {}, offPlan: {} }, NOW);

const SCREENS = {};
SCREENS.today = app.screen();
[['data-dest', 'practice'], ['data-dest', 'maps'], ['data-dest', 'progress'], ['data-go', 'gear'], ['data-go', 'setup']]
  .forEach(([attr, val]) => {
    const e = app.find('[' + attr + '="' + val + '"]');
    if (e.length && e[0].onclick) { e[0].onclick({ target: e[0], preventDefault() {} }); SCREENS[val] = app.screen(); }
  });

/* The OVERLAYS are screens too, and they are where the accessibility bugs actually were —
 * the session overlay's ✕ and the sheet's rows never appear in #main, so a check that only
 * reads #main gives them a free pass. (It did: an unnamed ✕ went undetected until this.) */
const overlay = (id) => app.doc.getElementById(id).innerHTML;
(function () {
  app.find('[data-dest="today"]').forEach((e) => e.onclick && e.onclick({ target: e, preventDefault() {} }));
  const qs = app.find('[data-quickstart]');
  if (qs.length && qs[0].onclick) { qs[0].onclick({ target: qs[0], preventDefault() {} }); SCREENS['session overlay'] = overlay('session'); }
  const more = app.find('[data-dest="more"]');
  if (more.length && more[0].onclick) { more[0].onclick({ target: more[0], preventDefault() {} }); SCREENS['more sheet'] = overlay('sheet'); }
})();

function elements(src) {
  const out = []; const re = /<([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g; let m;
  while ((m = re.exec(src))) {
    const tag = m[1].toLowerCase(), attrs = {};
    const ar = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*"([^"]*)")?/g; let a;
    while ((a = ar.exec(m[2] || ''))) attrs[a[1]] = a[2] !== undefined ? a[2] : '';
    let inner = '';
    if (!m[3] && !/^(img|input|br|hr|meta|link|source|use|path|circle|rect|line|polyline|polygon|ellipse)$/.test(tag)) {
      const close = src.indexOf('</' + tag + '>', re.lastIndex);
      inner = close < 0 ? '' : src.slice(re.lastIndex, close);
    }
    out.push({ tag, attrs, text: inner.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim() });
  }
  return out;
}

ok('all six screens AND both overlays render, so the checks below measure something', (function () {
  const names = Object.keys(SCREENS);
  const empty = names.filter((n) => !SCREENS[n] || SCREENS[n].length < 400);
  if (empty.length) console.log('      empty: ' + empty.join(', '));
  return names.length === 8 && empty.length === 0;
})());

ok('every button on every screen has an accessible name (4.1.2)', (function () {
  const bad = [];
  Object.keys(SCREENS).forEach((n) => {
    elements(SCREENS[n]).filter((e) => e.tag === 'button').forEach((e) => {
      if (!(e.text || e.attrs['aria-label'] || e.attrs['aria-labelledby'] || e.attrs.title))
        bad.push(n + ': ' + JSON.stringify(e.attrs).slice(0, 80));
    });
  });
  if (bad.length) console.log('      ' + bad.join('\n      '));
  return bad.length === 0;
})());

// A dialog is not a page: it is named by aria-label, and requiring an h1 inside one would be
// inventing a rule. The heading structure applies to the six real screens.
const PAGES = ['today', 'practice', 'maps', 'progress', 'gear', 'setup'];
const DIALOGS = ['session overlay', 'more sheet'];

ok('every screen starts at h1 and never skips a heading level (1.3.1)', (function () {
  const bad = [];
  PAGES.forEach((n) => {
    const h = [];
    const re = /<(h[1-6])\b|role="heading"[^>]*aria-level="(\d)"/g; let m;
    while ((m = re.exec(SCREENS[n]))) h.push(m[1] ? +m[1].slice(1) : +m[2]);
    if (!h.length) { bad.push(n + ': no headings at all'); return; }
    if (h[0] !== 1) bad.push(n + ': starts at h' + h[0]);
    for (let i = 1; i < h.length; i++) if (h[i] - h[i - 1] > 1) bad.push(n + ': ' + h.join(',') + ' skips a level');
  });
  if (bad.length) console.log('      ' + bad.join('\n      '));
  return bad.length === 0;
})());

ok('each dialog is named, since it has no heading to be named by (4.1.2)', (function () {
  const bad = DIALOGS.filter((n) => !/aria-label="[^"]+"/.test(SCREENS[n] || '') &&
                                    !/aria-labelledby="[^"]+"/.test(SCREENS[n] || ''));
  if (bad.length) console.log('      unnamed dialog: ' + bad.join(', '));
  return bad.length === 0;
})());

ok('nothing clickable is a plain div — every hook sits on a real control (2.1.1)', (function () {
  const HOOK = /^data-(drill|feel|go|dest|gate|loss|death|sess|act|pause|resume|why|rev|map|lo|coach|setfocus|offplan|offdel|restlog|duego|theme-set|cal|mk|backfill|editday|setday|skip|grad|quickstart|tiltdismiss|bkexport|bkdismiss|wnseen|sheet-close|sheet-go|updcheck|updnow|upddismiss|lnadd|lndel|picadd|picdel|piccancel|lrshow|lrok|lrno|dbleak|dbmood|locopy|hxcopy|sharecard|sharecopy|wsrecheck|deathclear|cs-read|gsi-setup|driftfocus|morecards|protocol|startsession|copy|advice)$/;
  const bad = [];
  Object.keys(SCREENS).forEach((n) => {
    elements(SCREENS[n]).forEach((e) => {
      if (/^(button|a|input|select|textarea|label)$/.test(e.tag)) return;
      // A modal scrim is a redundant click-to-dismiss backdrop, not a control — allowed
      // ONLY because keyboard users have a real way out, asserted immediately below.
      if ((e.attrs['class'] || '').indexOf('shscrim') >= 0) return;
      if (Object.keys(e.attrs).some((k) => HOOK.test(k)))
        bad.push(n + ': <' + e.tag + '> ' + Object.keys(e.attrs).filter((k) => k.startsWith('data-')).join(','));
    });
  });
  if (bad.length) console.log('      ' + bad.join('\n      '));
  return bad.length === 0;
})());

ok('the sheet scrim is never the only way out — Escape and a real button both work', (function () {
  const sheet = SCREENS['more sheet'] || '';
  const hasScrim = /class="shscrim"/.test(sheet);
  const realButton = /<button[^>]*data-sheet-close="1"[^>]*>\s*CLOSE/.test(sheet);
  const escape = /moreKey=function\(e\)\{if\(e\.key==="Escape"\)closeMore\(\);\}/.test(html);
  if (!(realButton && escape)) console.log('      scrim=' + hasScrim + ' button=' + realButton + ' escape=' + escape);
  return hasScrim && realButton && escape;
})());

ok('no positive tabindex reorders the document (2.4.3)', (function () {
  const bad = [];
  Object.keys(SCREENS).forEach((n) => {
    elements(SCREENS[n]).forEach((e) => {
      if (e.attrs.tabindex !== undefined && +e.attrs.tabindex > 0) bad.push(n + ': ' + e.tag + ' tabindex=' + e.attrs.tabindex);
    });
  });
  if (bad.length) console.log('      ' + bad.join(', '));
  return bad.length === 0;
})());

ok('every visible input carries a label (3.3.2)', (function () {
  const bad = [];
  Object.keys(SCREENS).forEach((n) => {
    elements(SCREENS[n]).filter((e) => /^(input|select|textarea)$/.test(e.tag)).forEach((e) => {
      if (e.attrs.type === 'hidden') return;
      // a display:none file input is driven by a real button and is not in the a11y tree
      if (/display\s*:\s*none/.test(e.attrs.style || '')) return;
      const labelled = e.attrs['aria-label'] || e.attrs['aria-labelledby'] ||
        (e.attrs.id && new RegExp('<label[^>]*for="' + e.attrs.id + '"').test(SCREENS[n]));
      if (!labelled) bad.push(n + ': ' + JSON.stringify(e.attrs).slice(0, 80));
    });
  });
  if (bad.length) console.log('      ' + bad.join('\n      '));
  return bad.length === 0;
})());

/* ------------------------------------------------------------------- modals ---- */
ok('every modal declares itself AND does the three things that make it one', (function () {
  const checks = [
    ['session overlay', /ov\.setAttribute\("role","dialog"\);ov\.setAttribute\("aria-modal","true"\)/],
    ['lightbox', /id="lightbox" role="dialog" aria-modal="true"/],
    ['More sheet', /class="shbody" role="dialog" aria-modal="true"/],
  ];
  const missing = checks.filter(([, re]) => !re.test(html)).map(([n]) => n);
  // inert must be balanced: every surface that sets it must also remove it, or the app
  // stays unusable behind a closed modal
  const set = (html.match(/setAttribute\("inert",""\)/g) || []).length;
  const rem = (html.match(/removeAttribute\("inert"\)/g) || []).length;
  if (missing.length) console.log('      not declared: ' + missing.join(', '));
  if (set !== rem) console.log('      inert unbalanced: ' + set + ' set vs ' + rem + ' removed');
  return missing.length === 0 && set === rem && set >= 6;
})());

ok('the document names its language and does not block zoom (3.1.1, 1.4.4)', (function () {
  return /<html[^>]*lang="[a-z]{2}/.test(shell) &&
         /name="viewport"/.test(shell) &&
         !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(shell);
})());

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
