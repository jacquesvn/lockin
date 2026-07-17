// CI gate: fail the build if the app's inline script doesn't parse.
// (frontendDist is a static copy, so nothing else would catch a syntax-broken index.html.)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'docs', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) {
  console.error('✗ No <script> block found in docs/index.html');
  process.exit(1);
}
try {
  new vm.Script(m[1], { filename: 'docs/index.html#script' });
  console.log('✓ docs/index.html inline script parses cleanly');
} catch (e) {
  console.error('✗ Syntax error in docs/index.html inline script:\n  ' + e.message);
  process.exit(1);
}
