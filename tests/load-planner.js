// Loads the tournament planner functions straight from index.html so tests always run the shipped code.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

module.exports = function loadPlanner(budgetMs = 1500) {
  const src = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = src.indexOf('function getLayout(');
  const end = src.indexOf('function setTab(');
  const pick = src.match(/function pickRandom[^\n]*/);
  if (start < 0 || end < 0 || !pick) throw new Error('Planner functions not found in index.html');
  const ctx = { window: {}, Math, Date, Set, Array, Uint16Array, Uint32Array, setTimeout, PLAN_BUDGET_MS: budgetMs };
  vm.createContext(ctx);
  vm.runInContext(pick[0] + '\n' + src.slice(start, end), ctx);
  ctx.planBest = (n, rounds) => new Promise(resolve => {
    const t = Date.now();
    ctx.planBestTournament(n, rounds, schedule => resolve({ schedule, ms: Date.now() - t }));
  });
  return ctx;
};
