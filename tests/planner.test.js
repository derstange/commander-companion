// Tournament planner checks. Run: node tests/planner.test.js
const assert = require('assert');
const P = require('./load-planner')();

let failed = 0;
async function test(name, fn) {
  try { await fn(); console.log('ok   ' + name); }
  catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}

function validSchedule(schedule, n) {
  const layout = P.getLayout(n);
  for (const round of schedule) {
    const seen = new Set(round.bye === null ? [] : [round.bye]);
    for (const t of round.tables) {
      assert.strictEqual(t.players.length, layout.size, 'table size');
      for (const p of t.players) { assert(!seen.has(p), 'player twice in a round'); seen.add(p); }
    }
    assert.strictEqual(seen.size, n, 'every player placed or on bye');
  }
}

(async () => {
  await test('schedules are valid for 2-32 players', () => {
    for (let n = 2; n <= 32; n++) validSchedule(P.planTournament(n, 6), n);
  });

  await test('no back-to-back byes across cycle boundaries', () => {
    for (const n of [5, 7, 9, 11]) for (let i = 0; i < 200; i++) {
      const s = P.planTournament(n, 50);
      for (let r = 1; r < s.length; r++) assert.notStrictEqual(s[r].bye, s[r - 1].bye, `n=${n} round ${r + 1}`);
    }
  });

  await test('bye counts stay exactly even over full cycles', () => {
    for (let i = 0; i < 200; i++) {
      const c = new Array(7).fill(0);
      P.planTournament(7, 21).forEach(r => c[r.bye]++);
      assert(c.every(x => x === 3), 'counts ' + c.join(','));
    }
  });

  await test('7 players / 7 rounds: every pair meets exactly twice', async () => {
    const runs = 50, ms = [];
    for (let i = 0; i < runs; i++) {
      const { schedule, ms: t } = await P.planBest(7, 7);
      validSchedule(schedule, 7);
      assert(P.scheduleCost(schedule, 7).ideal, 'not optimal in run ' + (i + 1));
      ms.push(t);
    }
    ms.sort((a, b) => a - b);
    console.log(`     median ${ms[runs >> 1]} ms, max ${ms[runs - 1]} ms`);
  });

  await test('planning stays within ~2 s for larger tournaments', async () => {
    for (const [n, r] of [[6, 5], [12, 10], [16, 10], [32, 50]]) {
      const { schedule, ms } = await P.planBest(n, r);
      validSchedule(schedule, n);
      const c = P.scheduleCost(schedule, n);
      console.log(`     ${n}p/${r}r: ${ms} ms, max pair meetings ${c.key[0]}, ideal ${c.ideal}`);
      assert(ms < 2500, `${n}p/${r}r took ${ms} ms`);
    }
  });

  console.log(failed ? `\n${failed} test(s) failed` : '\nall tests passed');
  process.exit(failed ? 1 : 0);
})();
