// metascalp — scalp-lib.mjs
// Setup detection. This is the heart of the engine.
// Doctrine (docx): wait for price to come to YOUR level, sweep -> trigger -> entry.
// Never chase, never anticipate, never trade middle of range.
// 5 setups, all with an easy, close invalidation.
import { CONFIG, SETUP_TYPES } from './config.mjs';
import {
  last, ema, closes, atr, findRange, rangePosition, isMiddleOfRange,
  triggerQuality, volumeStats, mondayLow, isSqueezed,
} from './core.mjs';

function buildLevels({ h1, m15, price }) {
  const rangeH1 = findRange(h1, CONFIG.rangeLookbackH1);
  const rangeM15 = findRange(m15, CONFIG.rangeLookbackM15);
  const ml = mondayLow(h1);
  const ema20M15 = last(ema(closes(m15), 20));
  const ema50H1 = last(ema(closes(h1), 50));
  const atrM15 = last(atr(m15, 14)) || price * 0.002;
  return { rangeH1, rangeM15, mondayLow: ml?.price ?? null, ema20M15, ema50H1, atrM15 };
}

function makeSetup({ symbol, type, direction, entry, sl, tp1, tp2, trigger, touches, reason, atrM15 }) {
  const risk = Math.abs(entry - sl);
  const reward1 = Math.abs(tp1 - entry);
  const rr = risk > 0 ? reward1 / risk : 0;
  return {
    id: `${symbol}-${type}-${direction}-${Date.now()}`,
    symbol, type, direction, entry, sl, tp1, tp2,
    riskPct: risk / entry, rr,
    invalidation: sl,
    trigger: trigger?.type ?? 'UNKNOWN',
    triggerStrength: trigger?.strength ?? 0,
    touches, reason, atr: atrM15,
    createdAt: new Date().toISOString(),
  };
}

// --- 1. SWEEP + RECLAIM (highest priority) ---
// Wick below range low / Monday low, close back inside, trigger up.
// Mirror for SHORT above range high.
function detectSweepReclaim({ symbol, h1, m15, price, L }) {
  const out = [];
  const prev = m15[m15.length - 2], curr = last(m15);
  if (!prev || !curr) return out;
  const trig = triggerQuality(prev, curr, L.ema20M15);
  if (!trig) return out;
  const vol = volumeStats(m15);
  // LONG sweep
  const sweepLowTarget = Math.min(L.rangeH1.low, L.mondayLow ?? Infinity);
  const wickedBelow = Math.min(prev.l, curr.l) < sweepLowTarget;
  const sweptPct = wickedBelow ? (sweepLowTarget - Math.min(prev.l, curr.l)) / sweepLowTarget : 0;
  const reclaimed = curr.c > sweepLowTarget && curr.c > L.rangeH1.low;
  if (trig.dir === 'LONG' && wickedBelow && sweptPct >= 0.0005 && sweptPct <= 0.006 && reclaimed) {
    const entry = curr.c;
    const sl = Math.min(prev.l, curr.l) - L.atrM15 * 0.15;
    const tp1 = entry + (entry - sl) * CONFIG.risk.tp1R;
    const tp2 = entry + (entry - sl) * CONFIG.risk.tp2R;
    out.push(makeSetup({ symbol, type: SETUP_TYPES.SWEEP_RECLAIM, direction: 'LONG', entry, sl, tp1, tp2, trigger: trig, touches: L.rangeH1.touchesLow, reason: `Sweep below ${sweepLowTarget.toFixed(4)} (range/Monday low) + reclaim + ${trig.type}. Vol ${vol.ratio.toFixed(2)}x`, atrM15: L.atrM15 }));
  }
  // SHORT sweep
  const sweepHighTarget = L.rangeH1.high;
  const wickedAbove = Math.max(prev.h, curr.h) > sweepHighTarget;
  const sweptPctH = wickedAbove ? (Math.max(prev.h, curr.h) - sweepHighTarget) / sweepHighTarget : 0;
  const reclaimedDown = curr.c < sweepHighTarget;
  if (trig.dir === 'SHORT' && wickedAbove && sweptPctH >= 0.0005 && sweptPctH <= 0.006 && reclaimedDown) {
    const entry = curr.c;
    const sl = Math.max(prev.h, curr.h) + L.atrM15 * 0.15;
    const tp1 = entry - (sl - entry) * CONFIG.risk.tp1R;
    const tp2 = entry - (sl - entry) * CONFIG.risk.tp2R;
    out.push(makeSetup({ symbol, type: SETUP_TYPES.SWEEP_RECLAIM, direction: 'SHORT', entry, sl, tp1, tp2, trigger: trig, touches: L.rangeH1.touchesHigh, reason: `Sweep above ${sweepHighTarget.toFixed(4)} + reclaim down + ${trig.type}. Vol ${vol.ratio.toFixed(2)}x`, atrM15: L.atrM15 }));
  }
  return out;
}

// --- 2. RANGE DEVIATION ---
// Price deviates outside H1 range, fails, closes back inside + trigger.
function detectDeviation({ symbol, h1, m15, price, L }) {
  const out = [];
  const prev = m15[m15.length - 2], curr = last(m15);
  if (!prev || !curr) return out;
  const trig = triggerQuality(prev, curr, L.ema20M15);
  if (!trig) return out;
  const pos = rangePosition(price, L.rangeH1);
  if (trig.dir === 'LONG' && prev.c < L.rangeH1.low && curr.c > L.rangeH1.low && pos < 0.25) {
    const entry = curr.c, sl = Math.min(prev.l, curr.l) - L.atrM15 * 0.1;
    out.push(makeSetup({ symbol, type: SETUP_TYPES.RANGE_DEVIATION, direction: 'LONG', entry, sl, tp1: entry + (entry - sl) * 1.5, tp2: entry + (entry - sl) * 2.5, trigger: trig, touches: L.rangeH1.touchesLow, reason: 'Deviation below range low failed, back inside + trigger', atrM15: L.atrM15 }));
  }
  if (trig.dir === 'SHORT' && prev.c > L.rangeH1.high && curr.c < L.rangeH1.high && pos > 0.75) {
    const entry = curr.c, sl = Math.max(prev.h, curr.h) + L.atrM15 * 0.1;
    out.push(makeSetup({ symbol, type: SETUP_TYPES.RANGE_DEVIATION, direction: 'SHORT', entry, sl, tp1: entry - (sl - entry) * 1.5, tp2: entry - (sl - entry) * 2.5, trigger: trig, touches: L.rangeH1.touchesHigh, reason: 'Deviation above range high failed, back inside + trigger', atrM15: L.atrM15 }));
  }
  return out;
}

// --- 3. PULLBACK CONTINUATION ---
// Momentum impulse, pullback to EMA20 / range-mid holds, trigger in impulse direction.
function detectPullback({ symbol, h1, m15, price, L }) {
  const out = [];
  if (m15.length < 10) return out;
  const prev = m15[m15.length - 2], curr = last(m15);
  const trig = triggerQuality(prev, curr, L.ema20M15);
  if (!trig) return out;
  // Impulse = last 5 M15 closes moved >1% in direction
  const impulse = (curr.c - m15[m15.length - 6].c) / m15[m15.length - 6].c;
  const nearEma = Math.abs(price - L.ema20M15) / price < 0.002;
  const nearMid = Math.abs(price - L.rangeH1.mid) / price < 0.003;
  if (!nearEma && !nearMid) return out;
  if (trig.dir === 'LONG' && impulse > -0.002 && curr.c > L.ema20M15 && (nearEma || nearMid)) {
    // Only if the broader move was up: H1 last 6 closes up
    const h1Imp = (last(h1).c - h1[h1.length - 6].c) / h1[h1.length - 6].c;
    if (h1Imp > 0) {
      const entry = curr.c, sl = Math.min(prev.l, curr.l) - L.atrM15 * 0.1;
      out.push(makeSetup({ symbol, type: SETUP_TYPES.PULLBACK, direction: 'LONG', entry, sl, tp1: entry + (entry - sl) * 1.5, tp2: entry + (entry - sl) * 2.5, trigger: trig, touches: 0, reason: `Pullback held at EMA20/mid (${nearEma ? 'EMA' : 'MID'}) + ${trig.type}`, atrM15: L.atrM15 }));
    }
  }
  if (trig.dir === 'SHORT' && impulse < 0.002 && curr.c < L.ema20M15) {
    const h1Imp = (last(h1).c - h1[h1.length - 6].c) / h1[h1.length - 6].c;
    if (h1Imp < 0) {
      const entry = curr.c, sl = Math.max(prev.h, curr.h) + L.atrM15 * 0.1;
      out.push(makeSetup({ symbol, type: SETUP_TYPES.PULLBACK, direction: 'SHORT', entry, sl, tp1: entry - (sl - entry) * 1.5, tp2: entry - (sl - entry) * 2.5, trigger: trig, touches: 0, reason: `Pullback held at EMA20/mid + ${trig.type}`, atrM15: L.atrM15 }));
    }
  }
  return out;
}

// --- 4. SQUEEZE BREAKOUT ---
// Box compression (<0.8% on H1 for 24 bars) + breakout + retest/trigger.
// Docx: "The box is key for squeezing" — 63.8k held -> push to 65k -> squeeze above.
function detectSqueeze({ symbol, h1, m15, price, L }) {
  const out = [];
  const sq = isSqueezed(h1, 24, 0.008);
  if (!sq.squeezed) return out;
  const prev = m15[m15.length - 2], curr = last(m15);
  const trig = triggerQuality(prev, curr, L.ema20M15);
  if (!trig) return out;
  const boxHigh = sq.range.high, boxLow = sq.range.low;
  if (trig.dir === 'LONG' && curr.c > boxHigh) {
    const entry = curr.c, sl = boxHigh - L.atrM15 * 0.2;
    // Squeeze target is wider: TP2 goes to next liquidity (box width x2)
    out.push(makeSetup({ symbol, type: SETUP_TYPES.SQUEEZE, direction: 'LONG', entry, sl, tp1: entry + (entry - sl) * 1.5, tp2: entry + (boxHigh - boxLow) * 1.5, trigger: trig, touches: 0, reason: `Squeeze box ${(sq.range.widthPct * 100).toFixed(2)}% broke up + ${trig.type}`, atrM15: L.atrM15 }));
  }
  if (trig.dir === 'SHORT' && curr.c < boxLow) {
    const entry = curr.c, sl = boxLow + L.atrM15 * 0.2;
    out.push(makeSetup({ symbol, type: SETUP_TYPES.SQUEEZE, direction: 'SHORT', entry, sl, tp1: entry - (sl - entry) * 1.5, tp2: entry - (boxHigh - boxLow) * 1.5, trigger: trig, touches: 0, reason: `Squeeze box ${(sq.range.widthPct * 100).toFixed(2)}% broke down + ${trig.type}`, atrM15: L.atrM15 }));
  }
  return out;
}

// --- 5. RECLAIM ---
// Level was lost, price reclaims it with trigger. Docx INJ: "Reclaiming the range
// would make this interesting for a scalp long. Until then, no interest."
function detectReclaim({ symbol, h1, m15, price, L }) {
  const out = [];
  const prev = m15[m15.length - 2], curr = last(m15);
  if (!prev || !curr || m15.length < 5) return out;
  const trig = triggerQuality(prev, curr, L.ema20M15);
  if (!trig) return out;
  // Lost low then reclaimed: 3 bars ago close < range low, now close > range low
  const threeAgo = m15[m15.length - 4];
  if (trig.dir === 'LONG' && threeAgo.c < L.rangeH1.low && curr.c > L.rangeH1.low) {
    const entry = curr.c, sl = Math.min(prev.l, curr.l) - L.atrM15 * 0.1;
    out.push(makeSetup({ symbol, type: SETUP_TYPES.RECLAIM, direction: 'LONG', entry, sl, tp1: entry + (entry - sl) * 1.5, tp2: entry + (entry - sl) * 2.5, trigger: trig, touches: L.rangeH1.touchesLow, reason: 'Range low lost then reclaimed + trigger', atrM15: L.atrM15 }));
  }
  if (trig.dir === 'SHORT' && threeAgo.c > L.rangeH1.high && curr.c < L.rangeH1.high) {
    const entry = curr.c, sl = Math.max(prev.h, curr.h) + L.atrM15 * 0.1;
    out.push(makeSetup({ symbol, type: SETUP_TYPES.RECLAIM, direction: 'SHORT', entry, sl, tp1: entry - (sl - entry) * 1.5, tp2: entry - (sl - entry) * 2.5, trigger: trig, touches: L.rangeH1.touchesHigh, reason: 'Range high lost then reclaimed down + trigger', atrM15: L.atrM15 }));
  }
  return out;
}

// Main entry: returns setups sorted by type priority, with middle-of-range
// setups already discarded (no edge in no-man's land).
export function detectSetups({ symbol, h1, m15, season = 'CHOP' }) {
  if (!h1?.length || !m15?.length) return [];
  const price = last(m15).c;
  const L = buildLevels({ h1, m15, price });
  const pos = rangePosition(price, L.rangeH1);
  // Hard rule: middle of range = no trade. The only exception is a squeeze
  // breakout, which by definition starts at the box edge.
  const candidates = [
    ...detectSweepReclaim({ symbol, h1, m15, price, L }),
    ...detectDeviation({ symbol, h1, m15, price, L }),
    ...detectPullback({ symbol, h1, m15, price, L }),
    ...detectSqueeze({ symbol, h1, m15, price, L }),
    ...detectReclaim({ symbol, h1, m15, price, L }),
  ];
  const priority = { SWEEP_RECLAIM: 0, RECLAIM: 1, RANGE_DEVIATION: 2, SQUEEZE: 3, PULLBACK: 4 };
  return candidates
    .filter((s) => {
      // Middle filter (except squeeze which already proved edge breakout)
      if (s.type !== 'SQUEEZE' && isMiddleOfRange(pos) && s.type !== 'SWEEP_RECLAIM') return false;
      // Touch decay: 3rd touch invalid
      if (s.touches >= CONFIG.gate.maxTouches + 1) return false;
      // SL sanity for scalp
      if (s.riskPct > CONFIG.gate.maxSLPct || s.riskPct < CONFIG.gate.minSLPct) return false;
      if (s.rr < CONFIG.gate.minRR) return false;
      // Season: in LONG_SEASON, SHORT setups need sweep (counter-trend only on sweep)
      if (season === 'LONG_SEASON' && s.direction === 'SHORT' && s.type !== 'SWEEP_RECLAIM') return false;
      if (season === 'SHORT_SEASON' && s.direction === 'LONG' && s.type !== 'SWEEP_RECLAIM') return false;
      return true;
    })
    .map((s) => ({ ...s, rangePos: pos, range: L.rangeH1, season }))
    .sort((a, b) => priority[a.type] - priority[b.type]);
}
