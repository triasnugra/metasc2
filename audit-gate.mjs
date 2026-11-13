// metascalp — audit-gate.mjs
// Audit: does this backtest / signal deserve trust? Mirrors tnv2 audit-gate.mjs.
// A strategy that only works in-sample, or on 12 trades, is not a strategy.
import { CONFIG } from './config.mjs';

export function auditBacktest(metrics, trades = []) {
  const checks = [];
  const warnings = [];
  const check = (name, pass, detail) => checks.push({ name, pass, detail });
  check('MIN_TRADES_30', metrics.trades >= 30, `${metrics.trades} trades`);
  check('PROFIT_FACTOR_1.3', metrics.profitFactor >= 1.3, `PF ${metrics.profitFactor.toFixed(2)}`);
  check('EXPECTANCY_POS', metrics.expectancy > 0, `E ${metrics.expectancy.toFixed(2)}R`);
  check('WINRATE_40', metrics.winRate >= 0.40, `${(metrics.winRate * 100).toFixed(1)}%`);
  check('MAX_DD_8R', metrics.maxDrawdownR <= 8, `MaxDD ${metrics.maxDrawdownR.toFixed(1)}R`);
  // Walk-forward: first half vs second half must both be non-negative-ish
  if (trades.length >= 40) {
    const half = Math.floor(trades.length / 2);
    const e1 = trades.slice(0, half).reduce((s, t) => s + t.pnlR, 0) / half;
    const e2 = trades.slice(half).reduce((s, t) => s + t.pnlR, 0) / (trades.length - half);
    check('WALK_FORWARD', e2 > 0 && e1 > 0, `H1 ${e1.toFixed(2)}R H2 ${e2.toFixed(2)}R`);
    if (e2 < 0) warnings.push('Second-half expectancy negative — possible overfit / regime change. Re-tune, do not trade live.');
  }
  // Grade concentration: if everything is B, the A filter is not discriminating
  if (metrics.byGrade?.A && metrics.byGrade?.B) {
    const aAvg = metrics.byGrade.A.avgR ?? 0, bAvg = metrics.byGrade.B.avgR ?? 0;
    if (aAvg < bAvg) warnings.push(`A setups (${aAvg.toFixed(2)}R) underperform B (${bAvg.toFixed(2)}R) — gate scoring needs retune.`);
  }
  const failed = checks.filter((c) => !c.pass);
  const verdict = failed.length === 0 ? 'PASS' : failed.length <= 2 ? 'WARN' : 'FAIL';
  return { verdict, checks, warnings, auditedAt: new Date().toISOString() };
}

export function auditSignal(signal) {
  const issues = [];
  if (!signal?.setup) return { pass: false, issues: ['no setup'] };
  const s = signal.setup;
  if (s.rr < CONFIG.gate.minRR) issues.push(`RR ${s.rr.toFixed(2)} < ${CONFIG.gate.minRR}`);
  if (s.riskPct > CONFIG.gate.maxSLPct) issues.push(`SL too wide ${(s.riskPct * 100).toFixed(2)}%`);
  if (s.riskPct < CONFIG.gate.minSLPct) issues.push(`SL too tight ${(s.riskPct * 100).toFixed(2)}% — noise stop`);
  if (signal.gate?.score < CONFIG.gate.minScore) issues.push(`Score ${signal.gate.score} below gate`);
  if (signal.decision !== 'TRADE') issues.push(`Decision is ${signal.decision}, not TRADE`);
  return { pass: issues.length === 0, issues };
}
