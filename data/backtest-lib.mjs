// metascalp — backtest-lib.mjs
// Walk-forward backtest: at every M15 bar, detect setups on history ONLY,
// gate them, then simulate forward on M5. No lookahead, no repaint.
import { CONFIG } from './config.mjs';
import { detectSetups } from './scalp-lib.mjs';
import { gateDecision } from './gate.mjs';
import { simulateTrade } from './trade-sim.mjs';
import { regimeFromBTC } from './core.mjs';

export function backtestMetrics(trades) {
  if (!trades.length) return { trades: 0, winRate: 0, avgR: 0, expectancy: 0, profitFactor: 0, maxDrawdownR: 0, totalR: 0, bestR: 0, worstR: 0 };
  const wins = trades.filter((t) => t.pnlR > 0);
  const losses = trades.filter((t) => t.pnlR <= 0);
  const totalR = trades.reduce((s, t) => s + t.pnlR, 0);
  const grossWin = wins.reduce((s, t) => s + t.pnlR, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlR, 0)) || 1;
  // Max drawdown in R from equity curve
  let peak = 0, eq = 0, maxDD = 0;
  for (const t of trades) { eq += t.pnlR; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, peak - eq); }
  return {
    trades: trades.length,
    winRate: wins.length / trades.length,
    avgR: totalR / trades.length,
    expectancy: totalR / trades.length,
    profitFactor: grossWin / grossLoss,
    maxDrawdownR: maxDD,
    totalR,
    bestR: Math.max(...trades.map((t) => t.pnlR)),
    worstR: Math.min(...trades.map((t) => t.pnlR)),
    avgHoldBars: trades.reduce((s, t) => s + t.barsHeld, 0) / trades.length,
    byType: groupAvg(trades, 'type'),
    byDirection: groupAvg(trades, 'direction'),
    byGrade: groupAvg(trades, 'grade'),
  };
}
function groupAvg(trades, key) {
  const g = {};
  for (const t of trades) {
    g[t.key] = g[t.key] || { n: 0, totalR: 0 };
    g[t.key].n++; g[t.key].totalR += t.pnlR;
  }
  // fix: use actual key
  const out = {};
  for (const t of trades) {
    const k = t[key];
    out[k] = out[k] || { n: 0, totalR: 0, winRate: 0 };
    out[k].n++; out[k].totalR += t.pnlR;
  }
  for (const k of Object.keys(out)) out[k].avgR = out[k].totalR / out[k].n;
  return out;
}

export function runBacktest({ symbol, h1, m15, m5, btcH1 = null, account = 10000, minBars = 100 }) {
  const trades = [];
  const regime = btcH1 ? regimeFromBTC(btcH1) : { season: 'CHOP' };
  // Align: for each M15 index i, use history up to i, simulate on M5 after m15[i].t
  for (let i = minBars; i < m15.length - 1; i++) {
    const histH1 = h1.filter((c) => c.t <= m15[i].t);
    const histM15 = m15.slice(0, i + 1);
    if (histH1.length < 30 || histM15.length < 50) continue;
    const setups = detectSetups({ symbol, h1: histH1, m15: histM15, season: regime.season });
    for (const setup of setups) {
      const gated = gateDecision(setup, { volumeRatio: 1.1, triggerClose: histM15[histM15.length - 1].c });
      if (gated.decision !== 'TRADE') continue;
      const futureM5 = m5.filter((c) => c.t > m15[i].t);
      if (!futureM5.length) continue;
      const riskPct = gated.grade === 'A' ? CONFIG.risk.riskPerTradePct : CONFIG.risk.riskPerTradePctB;
      const sim = simulateTrade({ candles: futureM5, setup, account, riskPct });
      trades.push({ ...sim, symbol, type: setup.type, direction: setup.direction, grade: gated.grade, score: gated.score, entry: setup.entry, sl: setup.sl, tp1: setup.tp1, tp2: setup.tp2, t: m15[i].t, date: new Date(m15[i].t).toISOString() });
      break; // one trade per bar — no overlapping scalps on same symbol
    }
  }
  return { symbol, trades, metrics: backtestMetrics(trades), regime: regime.season, generatedAt: new Date().toISOString() };
}
