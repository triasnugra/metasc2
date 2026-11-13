// metascalp — gate.mjs
// The gate decides WAIT vs TRADE. Mirrors tnv2 gate.mjs.
// Doctrine: Price Action first, Heatmap only confirms. Never trade on heatmap alone.
// Score 0-100. <60 WAIT, 60-74 B (half size), >=75 A (full size).
import { CONFIG } from './config.mjs';
import { sessionOf, sessionScore, heatmapProxy, rangePosition } from './core.mjs';

export function scoreSetup(setup, ctx = {}) {
  const { depth = null, session = sessionOf(new Date()), price = setup.entry } = ctx;
  const reasons = [];
  let score = 0;

  // 1. Location — edge of range is where edge lives (0-25)
  const pos = setup.rangePos ?? rangePosition(price, setup.range);
  const edgeDist = setup.direction === 'LONG' ? pos : 1 - pos; // 0 = perfect edge
  const loc = Math.round(25 * Math.max(0, 1 - edgeDist / 0.35));
  score += loc; reasons.push(`Location ${loc}/25 (rangePos ${(pos * 100).toFixed(0)}%)`);

  // 2. Setup type — sweep is king (0-20)
  const typeScore = { SWEEP_RECLAIM: 20, RECLAIM: 16, RANGE_DEVIATION: 15, SQUEEZE: 14, PULLBACK: 11 }[setup.type] ?? 10;
  score += typeScore; reasons.push(`Setup ${setup.type} ${typeScore}/20`);

  // 3. Trigger quality (0-20)
  const trig = Math.round((setup.triggerStrength || 0) * 20);
  score += trig; reasons.push(`Trigger ${setup.trigger} ${trig}/20`);

  // 4. Season alignment (0-15)
  let seasonScore = 7;
  if (setup.season === 'LONG_SEASON' && setup.direction === 'LONG') seasonScore = 15;
  if (setup.season === 'SHORT_SEASON' && setup.direction === 'SHORT') seasonScore = 15;
  if (setup.season === 'LONG_SEASON' && setup.direction === 'SHORT') seasonScore = 2;
  if (setup.season === 'SHORT_SEASON' && setup.direction === 'LONG') seasonScore = 2;
  if (setup.season === 'NO_TRADE') seasonScore = 0;
  score += seasonScore; reasons.push(`Season ${setup.season} ${seasonScore}/15`);

  // 5. Volume — spike = real absorption, not drift (0-10)
  const volRatio = ctx.volumeRatio ?? 1;
  const volScore = volRatio >= 1.5 ? 10 : volRatio >= 1.2 ? 7 : volRatio >= 1.0 ? 4 : 1;
  score += volScore; reasons.push(`Volume ${volRatio.toFixed(2)}x ${volScore}/10`);

  // 6. Session (0-5)
  const sess = Math.round(sessionScore(session) * 5);
  score += sess; reasons.push(`Session ${session} ${sess}/5`);

  // 7. Heatmap proxy — CONFIRM only, never lead (0-5)
  let heat = 0;
  if (depth) {
    const hm = heatmapProxy(depth, price);
    // LONG wants bid wall below (support) + not a huge ask wall directly above
    if (setup.direction === 'LONG' && hm.bias === 'BID_HEAVY') heat = 5;
    else if (setup.direction === 'SHORT' && hm.bias === 'ASK_HEAVY') heat = 5;
    else if (hm.bias === 'BALANCED') heat = 2;
    reasons.push(`Heatmap proxy ${hm.bias} (imb ${(hm.imbalance * 100).toFixed(0)}%) ${heat}/5`);
  } else {
    reasons.push('Heatmap proxy: no depth data (0/5) — PA still leads');
  }
  score += heat;

  // Touch decay penalty
  if (setup.touches >= 2) { score -= 10; reasons.push('Touch decay: 2nd touch -10'); }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= CONFIG.gate.aScore ? 'A' : score >= CONFIG.gate.minScore ? 'B' : 'C';
  return { score, grade, reasons, session };
}

export function gateDecision(setup, ctx = {}) {
  const scored = scoreSetup(setup, ctx);
  const hardRejects = [];
  if (setup.season === 'NO_TRADE') hardRejects.push('Season NO_TRADE — BTC middle of range');
  if (setup.rr < CONFIG.gate.minRR) hardRejects.push(`RR ${setup.rr.toFixed(2)} < ${CONFIG.gate.minRR}`);
  if (setup.riskPct > CONFIG.gate.maxSLPct) hardRejects.push(`SL ${(setup.riskPct * 100).toFixed(2)}% too wide for scalp`);
  if (setup.touches >= CONFIG.gate.maxTouches + 1) hardRejects.push('3rd touch — setup invalid (decay)');
  // Chase check: entry must be near trigger close, not extended
  const chase = Math.abs(setup.entry - (ctx.triggerClose ?? setup.entry)) / setup.entry;
  if (chase > CONFIG.gate.maxChasePct) hardRejects.push(`Chasing: entry ${(chase * 100).toFixed(2)}% from trigger close`);
  if (hardRejects.length) return { decision: 'NO_TRADE', ...scored, hardRejects };
  if (scored.score < CONFIG.gate.minScore) return { decision: 'WAIT', ...scored, hardRejects: [`Score ${scored.score} < ${CONFIG.gate.minScore}`] };
  return { decision: 'TRADE', ...scored, hardRejects: [] };
}

// Daily guard — low drawdown doctrine, enforced in code not willpower.
export function dailyGuard(state, tradeResultR = 0) {
  // state: {tradesToday, pnlTodayPct, consecutiveLosses, lastLossAt}
  const { risk } = CONFIG;
  const reasons = [];
  if (state.tradesToday >= risk.maxTradesPerDay) reasons.push(`Max trades ${risk.maxTradesPerDay}/day`);
  if (state.pnlTodayPct <= -risk.maxDailyLossPct) reasons.push(`Max daily loss ${risk.maxDailyLossPct}% hit`);
  if (state.consecutiveLosses >= risk.maxConsecutiveLosses) {
    const mins = state.lastLossAt ? (Date.now() - state.lastLossAt) / 60000 : 999;
    if (mins < risk.cooldownMinutes) reasons.push(`Cooldown: ${Math.ceil(risk.cooldownMinutes - mins)} min left after ${state.consecutiveLosses} losses`);
  }
  return { allowed: reasons.length === 0, reasons };
}

export function riskForGrade(grade) {
  if (grade === 'A') return CONFIG.risk.riskPerTradePct;
  if (grade === 'B') return CONFIG.risk.riskPerTradePctB;
  return 0;
}
