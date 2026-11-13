// metascalp — trade-sim.mjs
// Trade simulator: entry -> TP1 (60% off, SL to BE) -> TP2 / SL / timeout.
// Fees + slippage included. No lookahead: simulation starts AFTER setup bar.
import { CONFIG } from './config.mjs';

export function positionSize({ account = 10000, riskPct = 0.5, entry, sl, leverage = CONFIG.risk.defaultLeverage }) {
  const riskUsd = account * (riskPct / 100);
  const riskPerUnit = Math.abs(entry - sl);
  if (!riskPerUnit || !entry) return null;
  const qty = riskUsd / riskPerUnit;               // in coin units
  const notional = qty * entry;
  const margin = notional / leverage;
  const levUsed = Math.min(leverage, CONFIG.risk.maxLeverage);
  return { qty, notional, margin, leverage: levUsed, riskUsd };
}

export function simulateTrade({ candles, setup, account = 10000, riskPct = 0.5 }) {
  // candles: M5 candles AFTER the setup bar. Max hold = gate.maxHoldM5Bars.
  const { entry, sl, tp1, tp2, direction } = setup;
  const isLong = direction === 'LONG';
  const size = positionSize({ account, riskPct, entry, sl });
  if (!size) return { result: 'INVALID', pnlR: 0, pnlPct: 0, barsHeld: 0, reason: 'bad size' };
  const fee = CONFIG.risk.feeBps / 10000;
  const slip = CONFIG.risk.slippageBps / 10000;
  const effEntry = entry * (1 + (isLong ? slip : -slip));
  let remaining = 1, pnlUsd = 0, barsHeld = 0, maxAdverse = 0, maxFav = 0;
  let curSl = sl, tp1Done = false, exitPrice = null, result = 'TIMEOUT';

  for (const c of candles.slice(0, CONFIG.gate.maxHoldM5Bars)) {
    barsHeld++;
    // Track excursion in R
    const fav = isLong ? (c.h - effEntry) / Math.abs(effEntry - sl) : (effEntry - c.l) / Math.abs(effEntry - sl);
    const adv = isLong ? (effEntry - c.l) / Math.abs(effEntry - sl) : (c.h - effEntry) / Math.abs(effEntry - sl);
    maxFav = Math.max(maxFav, fav); maxAdverse = Math.max(maxAdverse, adv);
    const hitSl = isLong ? c.l <= curSl : c.h >= curSl;
    const hitTp1 = !tp1Done && (isLong ? c.h >= tp1 : c.l <= tp1);
    const hitTp2 = isLong ? c.h >= tp2 : c.l <= tp2;
    // Order within a bar: SL first (conservative), then TP.
    if (hitSl) {
      pnlUsd += remaining * size.qty * (curSl - effEntry) * (isLong ? 1 : -1);
      exitPrice = curSl; result = tp1Done ? 'WIN_BE' : 'LOSS'; remaining = 0; break;
    }
    if (hitTp1) {
      const share = CONFIG.risk.tp1Share;
      pnlUsd += share * size.qty * (tp1 - effEntry) * (isLong ? 1 : -1);
      remaining -= share; tp1Done = true;
      if (CONFIG.risk.moveToBEAfterTP1) curSl = effEntry; // SL to breakeven
    }
    if (hitTp2 && remaining > 0) {
      pnlUsd += remaining * size.qty * (tp2 - effEntry) * (isLong ? 1 : -1);
      exitPrice = tp2; result = 'WIN'; remaining = 0; break;
    }
  }
  if (remaining > 0) {
    // Timeout: exit at last close
    const lastClose = candles[Math.min(barsHeld, candles.length) - 1]?.c ?? effEntry;
    pnlUsd += remaining * size.qty * (lastClose - effEntry) * (isLong ? 1 : -1);
    exitPrice = lastClose;
    if (result === 'TIMEOUT') result = pnlUsd > 0 ? 'WIN_TIMEOUT' : pnlUsd < 0 ? 'LOSS_TIMEOUT' : 'BE_TIMEOUT';
  }
  // Fees: entry + exit, on full notional (approx)
  const fees = size.notional * fee * 2;
  pnlUsd -= fees;
  const riskUsd = size.riskUsd || 1;
  const pnlR = pnlUsd / riskUsd;
  return {
    result, pnlUsd, pnlR, pnlPct: (pnlUsd / account) * 100,
    barsHeld, exitPrice, maxAdverse, maxFav, tp1Done, fees,
    qty: size.qty, notional: size.notional, margin: size.margin,
  };
}
