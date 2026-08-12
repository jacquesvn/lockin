/* Read a Lockin export and show what the automatic death audit actually recorded.
 *
 * WHY THIS EXISTS. The round tracker is the one feature whose correctness rests on a reading
 * of CS2's GSI payload rather than on a measurement. No test can settle it — nothing in a
 * harness can launch CS2 — so the only way to know is to play and compare the log against
 * what happened. The audit card needs 20 rounds before it renders anything, which is more
 * than a short bot game gives you, so this reads the raw records instead.
 *
 *   Setup -> Export, then:  node scripts/check-rounds.js lockin-backup-YYYY-MM-DD.json
 *
 * It flags what is SUSPICIOUS, not what is wrong — only you know whether you actually died
 * in round 7. Read it next to your own memory of the game.
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/check-rounds.js <export.json>'); process.exit(1); }
if (!fs.existsSync(file)) { console.error('no such file: ' + file); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('not valid JSON: ' + e.message); process.exit(1); }

const rounds = data.rounds || [];
if (!rounds.length) {
  console.log('No rounds recorded.\n');
  console.log('If you expected some, check in this order:');
  console.log('  1. Was auto-tracking actually on?  Setup -> CS2 AUTO-TRACKING should say connected');
  console.log('  2. Was it a mode WITH ROUNDS?      deathmatch never cycles round.phase, so nothing records');
  console.log('  3. Did CS2 read the cfg?           it is only loaded at CS2 START — restart the game');
  process.exit(0);
}

const ms = (v) => (v == null ? '   —  ' : (v / 1000).toFixed(1).padStart(5) + 's');
const money = (v) => (v == null ? '—' : '$' + v);

console.log('\n' + rounds.length + ' round(s) recorded' + (rounds[0].map ? ' on ' + rounds[0].map : '') + '\n');
console.log(' rnd  died   when      won     buy      left   kills');
console.log(' ---  -----  --------  ------  -------  -----  -----');
rounds.forEach((r) => {
  console.log(
    String(r.round).padStart(4) + '  ' +
    (r.died ? 'YES  ' : 'no   ') + '  ' +
    ms(r.deathMs) + '  ' +
    (r.won === true ? 'won   ' : r.won === false ? 'lost  ' : '?     ') + '  ' +
    String(money(r.buyEquip)).padStart(7) + '  ' +
    String(money(r.leftOver)).padStart(5) + '  ' +
    String(r.roundKills == null ? '—' : r.roundKills).padStart(5)
  );
});

/* ---- things worth a second look ---- */
const flags = [];
const nums = rounds.map((r) => r.round);

if (new Set(nums).size !== nums.length) flags.push('duplicate round numbers — the dedup window may be too short');
for (let i = 1; i < nums.length; i++) {
  if (nums[i] === nums[i - 1] + 1) continue;
  if (nums[i] < nums[i - 1]) { flags.push('round numbers go backwards at ' + nums[i - 1] + ' -> ' + nums[i] + ' (a new match starting is fine)'); continue; }
  flags.push('gap: ' + nums[i - 1] + ' -> ' + nums[i] + ' — rounds were missed');
}
if (rounds.every((r) => r.died)) flags.push('EVERY round says you died — suspicious unless you really did');
if (rounds.every((r) => !r.died)) flags.push('NO round says you died — the health read is the thing to doubt');
if (rounds.every((r) => r.won === true) || rounds.every((r) => r.won === false)) {
  flags.push('every round has the same result — win/loss derivation is the thing to doubt');
}
const unknown = rounds.filter((r) => r.won !== true && r.won !== false).length;
if (unknown) flags.push(unknown + ' round(s) with an unknown result — player.team was missing on those');
const died = rounds.filter((r) => r.died);
if (died.some((r) => r.deathMs == null)) flags.push('a death with no timestamp — live_at was not set when it happened');
if (died.some((r) => r.deathMs != null && r.deathMs < 1000)) flags.push('a death under 1s after the round went live — possible, but check it');
if (died.some((r) => r.deathMs != null && r.deathMs > 180000)) flags.push('a death over 3 minutes in — longer than a round should run');
if (rounds.some((r) => r.round === 0)) flags.push('a round numbered 0 — warmup may be leaking in');

console.log('');
if (flags.length) { console.log('worth a second look:'); flags.forEach((f) => console.log('  · ' + f)); }
else console.log('nothing structurally odd.');

console.log('\nNow the part only you can do — compare against what actually happened:');
console.log('  · does "died" match the rounds you actually died in?');
console.log('  · does "won" match the rounds your team actually won?');
console.log('  · is "when" roughly right for the rounds you remember dying early or late in?');
console.log('  · did any round get recorded during WARMUP? (it should not)');
console.log('\nSummary: died in ' + died.length + ' of ' + rounds.length +
            ', won ' + rounds.filter((r) => r.won === true).length +
            ', lost ' + rounds.filter((r) => r.won === false).length +
            (unknown ? ', ' + unknown + ' unknown' : '') + '.');
