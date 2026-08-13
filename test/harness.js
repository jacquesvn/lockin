/* The test harness: a DOM small enough to be obviously correct, and a boot that runs the
 * REAL inline <script> from docs/index.html unmodified.
 *
 * Extracted from journey.test.js so the accessibility suite can drive the same real screens.
 * wire() and the onboarding renderer only ever do three things to the document —
 * getElementById, a simple-selector query, and `.onclick =` — so the model is a flat list of
 * element stubs per container, re-parsed whenever innerHTML is assigned. No tree, no layout,
 * nothing to get subtly wrong.
 *
 * ANTI-HOLLOW RULE: an unsupported selector THROWS rather than returning [], and clickOne
 * throws when nothing matched or no handler was bound. A harness that quietly finds nothing
 * turns a real failure into a passing test.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
/* ---------------------------------------------------------------- a small DOM ----
 * wire() and the onboarding renderer only ever do three things to the document:
 * getElementById, a simple-selector query, and `.onclick =`. Nothing traverses. So the
 * model is a flat list of element stubs per container, re-parsed whenever innerHTML is
 * assigned — no tree, no layout, nothing to get subtly wrong.
 */
function parseEls(src) {
  const out = [];
  // the attribute run tolerates ">" inside a quoted value (aria-labels contain them)
  const tagRe = /<([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = tagRe.exec(src))) {
    const attrs = {};
    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*"([^"]*)")?/g;
    let a;
    while ((a = attrRe.exec(m[2] || ''))) attrs[a[1]] = a[2] !== undefined ? a[2] : '';
    out.push(makeEl(m[1], attrs));
  }
  return out;
}

function matches(node, sel) {
  sel = String(sel).trim();
  let m;
  if ((m = /^\[([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?\]$/.exec(sel))) {
    const v = node.getAttribute(m[1]);
    if (v === null) return false;
    return m[2] === undefined || v === m[2];
  }
  if (/^\.[-a-zA-Z0-9_]+$/.test(sel)) return node.classList.contains(sel.slice(1));
  if (/^#[-a-zA-Z0-9_]+$/.test(sel)) return node.getAttribute('id') === sel.slice(1);
  if (/^[a-zA-Z][a-zA-Z0-9]*$/.test(sel)) return node.tagName === sel.toUpperCase();
  // Anything else would silently match nothing and turn a real failure into a pass.
  throw new Error('journey harness: unsupported selector ' + JSON.stringify(sel) +
    ' — teach matches() about it rather than letting it return nothing');
}

const CONTAINERS = [];          // every element the app looks up by a fixed id

function makeEl(tag, attrs) {
  const e = {
    tagName: String(tag || 'div').toUpperCase(),
    _attrs: attrs || {},
    _kids: [],
    _html: '',
    style: {}, dataset: {}, value: '', textContent: '', files: [],
    onclick: null, onchange: null, oninput: null, onkeydown: null, onload: null,
    children: [], parentElement: null, width: 0, height: 0,
  };
  const classes = new Set(String(e._attrs['class'] || '').split(/\s+/).filter(Boolean));
  e.classList = {
    add(c) { classes.add(c); }, remove(c) { classes.delete(c); },
    toggle(c, on) { if (on === undefined) { classes.has(c) ? classes.delete(c) : classes.add(c); } else if (on) classes.add(c); else classes.delete(c); },
    contains(c) { return classes.has(c); },
  };
  e.getAttribute = (n) => (Object.prototype.hasOwnProperty.call(e._attrs, n) ? e._attrs[n] : null);
  e.setAttribute = (n, v) => { e._attrs[n] = String(v); };
  e.removeAttribute = (n) => { delete e._attrs[n]; };
  e.hasAttribute = (n) => Object.prototype.hasOwnProperty.call(e._attrs, n);
  e.addEventListener = () => {}; e.removeEventListener = () => {}; e.dispatchEvent = () => true;
  e.appendChild = (c) => { e._kids.push(c); return c; };
  e.removeChild = () => {}; e.remove = () => {};
  e.focus = () => { DOC.activeElement = e; };
  e.blur = () => { DOC.activeElement = DOC.body; };
  e.click = () => { if (e.onclick) e.onclick({ target: e, preventDefault() {}, stopPropagation() {} }); };
  e.contains = (n) => n === e || e._kids.indexOf(n) >= 0;
  e.closest = () => null;
  e.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 });
  e.getContext = () => canvasCtx();
  e.toDataURL = () => 'data:image/png;base64,LOCKIN';
  e.querySelector = (s) => e._kids.filter((k) => matches(k, s))[0] || null;
  e.querySelectorAll = (s) => e._kids.filter((k) => matches(k, s));
  Object.defineProperty(e, 'innerHTML', {
    get() { return e._html; },
    set(v) { e._html = String(v); e._kids = parseEls(e._html); },
  });
  return e;
}

function canvasCtx() {
  const c = {};
  ['fillRect','clearRect','beginPath','moveTo','lineTo','stroke','fill','arc','closePath','fillText',
   'strokeText','save','restore','translate','rotate','scale','setLineDash','roundRect','drawImage']
    .forEach((k) => { c[k] = () => {}; });
  c.measureText = () => ({ width: 10 });
  c.createLinearGradient = () => ({ addColorStop() {} });
  return c;
}

let DOC = null;
function makeDoc() {
  const byId = {};
  const doc = {
    readyState: 'complete',
    title: '',
    documentElement: makeEl('html', {}),
    head: makeEl('head', {}),
    addEventListener() {}, removeEventListener() {},
    createElement(t) { return makeEl(t, {}); },
    createTextNode() { return makeEl('span', {}); },
  };
  doc.body = makeEl('body', {});
  // body is the union of every container — wire() scans document.body, and the screens are
  // rendered into #main / #onboard / #session, so body must see through to them.
  doc.body.querySelectorAll = (s) => {
    let out = [];
    CONTAINERS.forEach((c) => { out = out.concat(c._kids.filter((k) => matches(k, s))); });
    return out;
  };
  doc.body.querySelector = (s) => doc.body.querySelectorAll(s)[0] || null;

  doc.getElementById = (id) => {
    if (byId[id]) return byId[id];
    // ids inside rendered content (#nextB, #beginBtn, #qq …) are looked up after an
    // innerHTML assignment, so search the parsed children before minting a new stub
    for (const c of CONTAINERS) {
      for (const k of c._kids) if (k.getAttribute('id') === id) return k;
    }
    const e = makeEl('div', { id });
    byId[id] = e;
    CONTAINERS.push(e);
    return e;
  };
  doc.querySelector = (s) => doc.body.querySelector(s);
  doc.querySelectorAll = (s) => doc.body.querySelectorAll(s);
  doc.activeElement = doc.body;
  return doc;
}

/* ---------------------------------------------------------------- the sandbox ---- */
/* Boot the app.
 *
 * `native` (optional) turns on the DESKTOP paths by installing a window.__TAURI__ before the
 * script runs — `var isNative=!!(TAURI&&TAURI.core)` is evaluated once at load, so it has to be
 * there first. Pass `{invoke: {command: value|Error}}` to script what each Tauri command answers;
 * anything unlisted resolves to null, so a test only has to state the commands it cares about.
 * Every invoke is recorded on api.invoked for "was this even called" assertions.
 *
 * Without it the harness is a browser and every native branch is dead code — which is why the
 * GSI section, the updater and the backup mirror had only source-scanning coverage before.
 */
function bootApp(seedState, startClock, native) {
  CONTAINERS.length = 0;
  const store = {};
  if (seedState) store['lockin.v1'] = JSON.stringify(seedState);
  const invoked = [];
  const listeners = {};

  const clock = new Date(startClock.getTime());
  const RealDate = Date;
  function D(a, b, c, d, e, f, g) {
    if (arguments.length === 0) return new RealDate(clock.getTime());
    if (arguments.length === 1) return new RealDate(a);
    return new RealDate(a, b, c, d || 0, e || 0, f || 0, g || 0);
  }
  D.now = () => clock.getTime();
  D.parse = RealDate.parse; D.UTC = RealDate.UTC; D.prototype = RealDate.prototype;

  // Deterministic timers: the app generates the plan inside a setTimeout, and mirrors the
  // backup on an 800ms debounce. Queue them and flush on demand rather than waiting.
  const queue = [];
  const doc = makeDoc();
  DOC = doc;

  const sb = {
    module: { exports: {} },
    console: { log() {}, warn() {}, error() {}, info() {} },
    JSON, Math, Date: D, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Set, Map,
    isNaN, isFinite, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout(fn, ms) { queue.push({ fn, ms: ms || 0, seq: queue.length }); return queue.length; },
    clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    requestAnimationFrame(fn) { queue.push({ fn, ms: 0, seq: queue.length }); return 0; },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    document: doc,
    alert() {}, confirm() { return true; }, prompt() { return null; },
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    },
    navigator: {
      userAgent: 'Mozilla/5.0', storage: { persist: () => Promise.resolve(true) },
      serviceWorker: { register: () => Promise.resolve({ addEventListener() {} }), addEventListener() {}, controller: null },
      clipboard: { write: () => Promise.resolve(), writeText: () => Promise.resolve() },
    },
    location: { href: 'https://jacquesvn.github.io/lockin/', origin: 'https://jacquesvn.github.io',
                hostname: 'jacquesvn.github.io', protocol: 'https:', reload() {} },
    indexedDB: { open() { return { onsuccess: null, onerror: null, onupgradeneeded: null }; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    URL: { createObjectURL: () => 'blob:', revokeObjectURL() {} },
    Image: function () { return makeEl('img', {}); },
    Blob: function () {}, FileReader: function () { return { readAsText() {} }; },
    Notification: { permission: 'default', requestPermission: () => Promise.resolve('default') },
    performance: { now: () => 0 },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    scrollTo() {}, history: { pushState() {}, replaceState() {} },
    crypto: { getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = (i * 7 + 3) & 255; return a; } },
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;

  if (native) {
    const answers = native.invoke || {};
    sb.__TAURI__ = {
      core: {
        invoke(cmd, args) {
          invoked.push({ cmd, args });
          if (!Object.prototype.hasOwnProperty.call(answers, cmd)) return Promise.resolve(null);
          const a = answers[cmd];
          return a instanceof Error ? Promise.reject(a) : Promise.resolve(a);
        },
      },
      // Listeners are captured so a test can fire a CS2 event by hand: api.emit('gsi-round', …).
      event: {
        listen(name, fn) { (listeners[name] = listeners[name] || []).push(fn); return Promise.resolve(function () {}); },
        emit() { return Promise.resolve(); },
      },
      window: { getCurrentWindow: () => ({ show() {}, hide() {}, setFocus() {} }) },
    };
  }

  vm.createContext(sb);
  vm.runInContext(script, sb, { filename: 'docs/index.html' });

  const api = {
    sb, store, doc, clock, invoked,
    X: sb.module.exports,
    // Did the app call this Tauri command? Returns the recorded {cmd,args} entries.
    calls(cmd) { return invoked.filter((c) => c.cmd === cmd); },
    // Fire a Tauri event at whatever the app registered for it.
    emit(name, payload) {
      const ls = listeners[name] || [];
      if (!ls.length) throw new Error('nothing listening for ' + name);
      ls.forEach((fn) => fn({ payload }));
      return ls.length;
    },
    flush(n) {                       // run queued callbacks (they may queue more)
      let rounds = n || 6;
      while (rounds-- > 0 && queue.length) {
        const batch = queue.splice(0, queue.length).sort((a, b) => a.ms - b.ms || a.seq - b.seq);
        batch.forEach((t) => { try { t.fn(); } catch (_) {} });
      }
    },
    state() { return store['lockin.v1'] ? JSON.parse(store['lockin.v1']) : null; },
    addDays(n) { clock.setDate(clock.getDate() + n); },
    find(sel) { return doc.body.querySelectorAll(sel); },
    // A click must land on something real WITH a handler. Anything else is the exact bug
    // class this file exists to catch, so it fails loudly instead of no-oping.
    clickOne(sel, which) {
      const els = doc.body.querySelectorAll(sel);
      if (!els.length) throw new Error('nothing matched ' + sel);
      const el = els[which || 0];
      if (!el.onclick) throw new Error('no handler bound to ' + sel + (which ? ' [' + which + ']' : ''));
      el.onclick({ target: el, preventDefault() {}, stopPropagation() {} });
      return el;
    },
    clickId(id) {
      const el = doc.getElementById(id);
      if (!el || !el.onclick) throw new Error('no handler on #' + id);
      el.onclick({ target: el, preventDefault() {}, stopPropagation() {} });
      return el;
    },
    screen() { return doc.getElementById('main').innerHTML; },
    onboard() { return doc.getElementById('onboard').innerHTML; },
  };
  return api;
}

module.exports = { bootApp, makeEl, parseEls, matches, html, script, CONTAINERS };
