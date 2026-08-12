/* Read a Lockin export and show what the automatic death audit actually recorded.
 *
 * WHY THIS EXISTS. The round tracker is the one feature whose correctness rests on a reading
 * of CS2's GSI payload rather than on a measurement. No test can settle it — nothing in a
 * harness can launch CS2 — so the only way to know is to play and compare the log against
 * what happened. The audit card needs 20 rounds before it renders, so below that this reads
 * the raw records instead.
 *
 *   Setup -> Export, then:  node scripts/check-rounds.js lockin-backup-YYYY-MM-DD.json
 *
 * ON THE KEY NAMES. Rust emits {round, died, deathMs, won, ...}; applyGsiRound COMPRESSES
 * that to {s, d, at, x, ms, bm, be, lo, k, w} before storing, because 180 rounds sit in a
 * ~5MB localStorage budget shared with everything else. The first version of this script
 * read the Rust names and would have printed a table of undefineds — it was "tested" against
 * a fixture invented in the wrong shape. The fixture is now built by calling the app's own
 * applyGsiRound, so the script cannot drift from what is actually stored.
 */
const fs = require('fs');

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/check-rounds.js <export.json>'); process.exit(1); }
if (!fs.existsSync(file)) { console.error('no such file: ' + file); process.exit(1); }

let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('not valid JSON: ' + e.message); process.exit(1); }

const raw = data.rounds || [];

/* Normalise the stored (short) shape, and tolerate a raw emitted record too, so this works
 * whether you hand it an export or a single event pasted out of a log. */
function norm(r) {
  const sig = typeof r.s === 'string' ? r.s : '';
  const hash = sig.lastIndexOf('#');
  return {
    round: r.round != null ? r.round : (hash >= 0 ? Number(sig.slice(hash + 1)) : null),
    map: r.map != null ? r.map : (hash >= 0 ? sig.slice(0, hash) : ''),
    died: r.x != null ? r.x === 1 : !!r.died,
    ms: r.ms !== undefined ? r.ms : (r.deathMs !== undefined ? r.deathMs : null),
    won: r.w != null ? (r.w === 1) : (r.won === true ? true : r.won === false ? false : null),
    unknownResult: (r.w === null || r.w === undefined) && r.won !== true && r.won !== false,
    equip: r.be != null ? r.be : r.buyEquip,
    left: r.lo != null ? r.lo : r.leftOver,
    kills: r.k != null ? r.k : r.roundKills,
    day: r.d || null,
  };
}
const EARLY_MS = 20000;   // the window the audit card reports on

if (!raw.length) {
  console.log('No rounds recorded.\n');
  console.log('If you expected some, check in this order:');
  console.log('  1. Did CS2 read the cfg?           it is only loaded at CS2 START — restart the game');
  console.log('  2. Was it a mode WITH ROUNDS?      deathmatch never cycles round.phase, so nothing records');
  console.log('  3. Was auto-tracking actually on?  Setup -> CS2 AUTO-TRACKING should say connected');
  process.exit(0);
}

const rounds = raw.map(norm);

// If nothing parsed, say so loudly rather than printing a table of blanks.
if (rounds.every((r) => r.round === null || Number.isNaN(r.round))) {
  console.error('Found ' + raw.length + ' record(s) but none had a recognisable shape.');
  console.error('First record: ' + JSON.stringify(raw[0]).slice(0, 200));
  process.exit(1);
}

const ms = (v) => (v == null ? '   —  ' : (v / 1000).toFixed(1).padStart(5) + 's');
const money = (v) => (v == null ? '—' : '$' + v);

const maps = Array.from(new Set(rounds.map((r) => r.map).filter(Boolean)));
console.log('\n' + rounds.length + ' round(s) recorded' + (maps.length ? ' on ' + maps.join(', ') : '') +
            (rounds[0].day ? '  (' + rounds[0].day + ')' : '') + '\n');
console.log(' rnd  died   when      won     buy      left   kills');
console.log(' ---  -----  --------  ------  -------  -----  -----');
rounds.forEach((r) => {
  console.log(
    String(r.round == null ? '?' : r.round).padStart(4) + '  ' +
    (r.died ? 'YES  ' : 'no   ') + '  ' + ms(r.ms) + '  ' +
    (r.won === true ? 'won   ' : r.won === false ? 'lost  ' : '?     ') + '  ' +
    String(money(r.equip)).padStart(7) + '  ' + String(money(r.left)).padStart(5) + '  ' +
    // From 0.48.1 kills are captured on every payload that was you, so they are the real
    // round count whether you lived or died (round_kills cannot rise after death, so a death
    // round still reads kills-at-death). Before that they were written only in the death
    // branch and every surviving round claimed zero — records from 0.48.0 and earlier will
    // still show 0 here, and that is the old bug showing, not a new one.
    String(r.kills == null ? '—' : r.kills).padStart(5)
  );
});

/* ---- things worth a second look ---- */
const flags = [];
const nums = rounds.map((r) => r.round);
if (new Set(nums).size !== nums.length) flags.push('duplicate round numbers — the dedup window may be too short');
for (let i = 1; i < nums.length; i++) {
  if (nums[i] === nums[i - 1] + 1) continue;
  if (nums[i] < nums[i - 1]) { flags.push('round numbers restart at ' + nums[i - 1] + ' -> ' + nums[i] + ' (a second match is fine)'); continue; }
  flags.push('gap: ' + nums[i - 1] + ' -> ' + nums[i] + ' — rounds were missed');
}
const died = rounds.filter((r) => r.died);
if (rounds.length > 3 && died.length === rounds.length) flags.push('EVERY round says you died — suspicious unless you really did');
if (rounds.length > 3 && !died.length) flags.push('NO round says you died — the health read is the thing to doubt');
const won = rounds.filter((r) => r.won === true).length;
const lost = rounds.filter((r) => r.won === false).length;
const unknown = rounds.filter((r) => r.won === null).length;
if (rounds.length > 3 && (won === 0 || lost === 0) && !unknown) flags.push('every round has the same result — win/loss derivation is the thing to doubt');
if (unknown) flags.push(unknown + ' round(s) with an unknown result — player.team was missing on those');
if (died.some((r) => r.ms == null)) flags.push('a death with no timestamp — live_at was not set when it happened');
if (died.some((r) => r.ms != null && r.ms < 1000)) flags.push('a death under 1s after the round went live — possible, but check it');
if (died.some((r) => r.ms != null && r.ms > 180000)) flags.push('a death over 3 minutes in — longer than a round should run');
if (nums.some((n) => n === 0)) flags.push('a round numbered 0 — warmup may be leaking in');

console.log('');
if (flags.length) { console.log('worth a second look:'); flags.forEach((f) => console.log('  · ' + f)); }
else console.log('nothing structurally odd.');

/* ---- what the audit card will say, so you can check the card against the rows ---- */
const timed = died.filter((r) => typeof r.ms === 'number');
const early = timed.filter((r) => r.ms < EARLY_MS);
const sorted = timed.map((r) => r.ms).sort((a, b) => a - b);
const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
console.log('\nwhat the audit card should say at ' + rounds.length + ' rounds' +
            (rounds.length < 20 ? '  (it needs 20 before it renders)' : '') + ':');
console.log('  rounds you died in        ' + died.length + ' of ' + rounds.length);
if (median != null) console.log('  typical time of death     ' + (median / 1000).toFixed(1) + 's');
console.log('  died inside the first 20s ' + early.length + ' of ' + timed.length);
console.log('  ...and lost those         ' + early.filter((r) => r.won === false).length + ' of ' + early.length);

console.log('\nNow the part only you can do:');
console.log('  · CS2 scoreboard DEATHS should equal ' + died.length + ' — one death per round, no respawn');
console.log('  · the final SCORE should match won ' + won + ' / lost ' + lost);
console.log('  · are the early/late deaths in the rounds you remember them in?');
console.log('  · did anything get recorded during WARMUP? (nothing should have)');
