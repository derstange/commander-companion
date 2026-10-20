// Analysis for 7 players / 7 rounds / 2 tables of 3 / 1 bye.
// 1) exhaustive search proving an optimal schedule (every pair meets exactly 2x) exists
// 2) how often a single planner run (old behaviour) vs. the best-of planner reaches it
// Run: node tests/analyze-7-players.js [runs]
const P = require('./load-planner')();
const n = 7, runs = Number(process.argv[2]) || 500;

// 1) Exhaustive search. WLOG player r sits out in round r.
const cnt = new Array(n * n).fill(0), sol = [];
const pairs = g => [[g[0], g[1]], [g[0], g[2]], [g[1], g[2]]];
function splits(act) {
  const out = [], rest = act.slice(1);
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) {
    const g = [act[0], rest[i], rest[j]];
    out.push([g, act.filter(x => !g.includes(x))]);
  }
  return out;
}
function search(r) {
  if (r === n) return true;
  const act = [...Array(n).keys()].filter(x => x !== r);
  for (const [g, h] of splits(act)) {
    const ps = [...pairs(g), ...pairs(h)];
    if (ps.some(([a, b]) => cnt[a * n + b] >= 2)) continue;
    ps.forEach(([a, b]) => cnt[a * n + b]++); sol.push([g, h]);
    if (search(r + 1)) return true;
    ps.forEach(([a, b]) => cnt[a * n + b]--); sol.pop();
  }
  return false;
}
const name = x => 'P' + (x + 1);
console.log(search(0) ? 'Optimal schedule exists:' : 'No optimal schedule');
sol.forEach(([g, h], r) => console.log(`  R${r + 1}: bye ${name(r)} | ${g.map(name).join(' ')} || ${h.map(name).join(' ')}`));

// 2) Distribution of pair meetings: "#pairs meeting 0x,1x,2x,3x,4x"
function distribution(schedules) {
  const d = {};
  for (const s of schedules) {
    const c = new Array(n * n).fill(0);
    s.forEach(r => r.tables.forEach(t => pairs(t.players).forEach(([a, b]) => c[Math.min(a, b) * n + Math.max(a, b)]++)));
    const v = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) v.push(c[a * n + b]);
    const key = [0, 1, 2, 3, 4].map(x => v.filter(y => y === x).length).join(',');
    d[key] = (d[key] || 0) + 1;
  }
  Object.entries(d).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${k}  ${(100 * v / schedules.length).toFixed(1)}%${k === '0,0,21,0,0' ? '  <- optimal' : ''}`));
}

(async () => {
  console.log(`\nSingle planner run (old behaviour), ${runs} runs [#pairs meeting 0x,1x,2x,3x,4x]:`);
  distribution(Array.from({ length: runs }, () => P.planTournament(n, 7)));
  const best = [];
  for (let i = 0; i < Math.min(runs, 100); i++) best.push((await P.planBest(n, 7)).schedule);
  console.log(`\nBest-of planner (current), ${best.length} runs:`);
  distribution(best);
})();
