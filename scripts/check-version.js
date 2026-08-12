// CI guard: every place that carries the version must agree with the git tag.
// Turns the 6 hand-synced version sources into an enforced invariant (audit finding #7).
// Usage: node scripts/check-version.js <tag>   (e.g. v0.6.2)
//
// Cargo.lock counts. It carries the crate's own version, and once the lockfile was committed
// `cargo test --locked` began REFUSING to run when it disagrees with Cargo.toml. Leaving it
// out of this check meant a forgotten bump sailed past the version gate and then failed
// several minutes later, mid-release, with an error about the lockfile needing an update
// rather than the one thing that was actually wrong.
const fs = require('fs');
const path = require('path');

const tag = (process.argv[2] || '').replace(/^v/, '');
if (!tag) { console.error('usage: check-version.js <tag>'); process.exit(1); }

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const grab = (s, re) => { const m = s.match(re); return m ? m[1] : undefined; };

const sources = {
  'git tag': tag,
  'package.json': JSON.parse(read('package.json')).version,
  'tauri.conf.json': JSON.parse(read('src-tauri/tauri.conf.json')).version,
  'Cargo.toml': grab(read('src-tauri/Cargo.toml'), /^version\s*=\s*"([^"]+)"/m),
  // the lockfile's entry for our OWN package, not the first version line in the file
  'Cargo.lock': grab(read('src-tauri/Cargo.lock'), /name = "lockin"\r?\nversion = "([^"]+)"/),
  'docs/index.html VERSION': grab(read('docs/index.html'), /var VERSION="([^"]+)"/),
  'service-worker CACHE': grab(read('docs/service-worker.js'), /CACHE\s*=\s*'lockin-([^']+)'/),
};

const bad = Object.keys(sources).filter((k) => sources[k] !== tag);
if (bad.length) {
  console.error('✗ Version mismatch (expected ' + tag + '):');
  bad.forEach((k) => console.error('  ' + k + ' = ' + sources[k]));
  process.exit(1);
}
console.log('✓ All version sources agree: ' + tag);
