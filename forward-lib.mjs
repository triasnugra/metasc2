// metascalp — forward-lib.mjs
// Live scan: fetch H1/M15/M5 + depth, detect, gate, return one decision per symbol.
// No trade is placed. This is a signal engine, not an auto-trader.
import { CONFIG } from './config.mjs';
import { fetchKlines, fetchDepth, fetchTicker24h, regimeFromBTC, volumeStats, sessionOf } from './core.mjs';
import { detectSetups } from './scalp-lib.mjs';
import { gateDecision, riskForGrade } from './gate.mjs';
import { positionSize } from './trade-sim.mjs';

export async function scanSymbol(symbol, btcH1, opts = {}) {
  const account = opts.account ?? 10000;
  try {
    const [h1, m15, m5, depth, ticker] = await Promise.all([
      fetchKlines(symbol, '1h', 200),
      fetchKlines(symbol, '15m', 200),
      fetchKlines(symbol, '5m', 60),
      fetchDepth(symbol, 100).catch(() => null),
      fetchTicker24h(symbol).catch(() => null),
    ]);
    const season = btcH1 ? regimeFromBTC(btcH1).season : 'CHOP';
    const setups = detectSetups({ symbol, h1, m15, season });
    const vol = volumeStats(m15);
    const price = m15[m15.length - 1]?.c ?? 0;
    const base = { symbol, price, season, session: sessionOf(new Date()), range: setups[0]?.range ?? null, ticker24h: ticker ? { changePct: +ticker.priceChangePercent, volume: +ticker.volume, funding: null } : null, scannedAt: new Date().toISOString() };
    if (!setups.length) return { ...base, decision: 'WAIT', reason: 'No setup: no sweep / deviation / pullback / squeeze / reclaim + trigger on M15' };
    // Best setup = first (already priority-sorted)
    const setup = setups[0];
    const gated = gateDecision(setup, { depth, volumeRatio: vol.ratio, triggerClose: m15[m15.length - 1].c });
    if (gated.decision !== 'TRADE') {
      return { ...base, setup, gate: gated, decision: gated.decision, reason: gated.hardRejects.join('; ') || `Score ${gated.score} < ${CONFIG.gate.minScore}` };
    }
    const riskPct = riskForGrade(gated.grade);
    const size = positionSize({ account, riskPct, entry: setup.entry, sl: setup.sl });
    return { ...base, setup, gate: gated, decision: 'TRADE', reason: `A/B setup ${setup.type} ${setup.direction} — score ${gated.score} (${gated.grade})`, riskPct, size, plan: planText(setup, gated, size) };
  } catch (e) {
    return { symbol, decision: 'ERROR', reason: e.message, scannedAt: new Date().toISOString() };
  }
}

export function planText(setup, gated, size) {
  return [
    `${setup.symbol} ${setup.direction} ${setup.type} — Grade ${gated.grade} (${gated.score})`,
    `Entry ${setup.entry} | SL ${setup.sl} (invalidation, ${(setup.riskPct * 100).toFixed(2)}%) | TP1 ${setup.tp1} (1.5R, take 60%) | TP2 ${setup.tp2} (2.5R)`,
    `Risk ${size ? `$${size.riskUsd.toFixed(2)}` : '-'} | Qty ${size ? size.qty.toFixed(4) : '-'} | Margin ~$${size ? size.margin.toFixed(0) : '-'} @ ${size?.leverage}x`,
    `Trigger: ${setup.trigger} — ${setup.reason}`,
    `If price moves ${(CONFIG.gate.maxChasePct * 100).toFixed(2)}% away from entry without filling, CANCEL. Do not chase.`,
  ].join('\n');
}

export async function scanMarket(symbols = CONFIG.symbols, opts = {}) {
  const btcH1 = await fetchKlines('BTCUSDT', '1h', 200).catch(() => null);
  const results = [];
  for (const s of symbols) results.push(await scanSymbol(s, btcH1, opts));
  return { scannedAt: new Date().toISOString(), season: btcH1 ? regimeFromBTC(btcH1).season : 'UNKNOWN', results };
}
