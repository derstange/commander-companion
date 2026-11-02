// Loads the tournament planner straight from js/planner.js so tests always run the shipped code.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function loadPlanner(budgetMs = 1500) {
  const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  const pick = read('core.js').match(/function pickRandom[^\n]*/);
  if (!pick) throw new Error('pickRandom not found in js/core.js');
  const ctx = { window: {}, Math, Date, Set, Array, Uint16Array, Uint32Array, setTimeout, PLAN_BUDGET_MS: budgetMs };
  vm.createContext(ctx);
  vm.runInContext(pick[0] + '\n' + read('planner.js'), ctx);
  ctx.planBest = (n, rounds) => new Promise(resolve => {
    const t = Date.now();
    ctx.planBestTournament(n, rounds, schedule => resolve({ schedule, ms: Date.now() - t }));
  });
  return ctx;
};
