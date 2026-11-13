// metascalp — research.mjs
// Research: which coins are worth scalping TODAY? And what is the regime?
// Scalp universe needs: high volume + high volatility + tight spread.
// PEPE scores high on volatility; BTC scores high on volume. Both can work —
// for different reasons. Rank, don't guess.
import { fetchTicker24h, regimeFromBTC } from './core.mjs';
import { CONFIG } from './config.mjs';

export function scalpScore(ticker) {
  // ticker: Binance futures 24hr {priceChangePercent, volume, quoteVolume, count}
  const vol = Math.abs(+ticker.priceChangePercent || 0);      // % move = opportunity
  const quoteVol = +ticker.quoteVolume || 0;                  // liquidity
  const trades = +ticker.count || 0;
  const volScore = Math.min(40, vol * 4);                     // 10% move = 40
  const liqScore = quoteVol > 500_000_000 ? 40 : quoteVol > 100_000_000 ? 30 : quoteVol > 20_000_000 ? 18 : 5;
  const actScore = trades > 500000 ? 20 : trades > 100000 ? 14 : 5;
  return Math.round(volScore + liqScore + actScore);
}

export async function rankCoins(symbols = CONFIG.symbols) {
  const out = [];
  for (const s of symbols) {
    try {
      const t = await fetchTicker24h(s);
      out.push({ symbol: s, changePct: +t.priceChangePercent, quoteVolume: +t.quoteVolume, trades: +t.count, price: +t.lastPrice, scalpScore: scalpScore(t) });
    } catch (e) { out.push({ symbol: s, scalpScore: 0, error: e.message }); }
  }
  return out.sort((a, b) => b.scalpScore - a.scalpScore);
}

export function researchSummary({ btcH1, ranked }) {
  const regime = regimeFromBTC(btcH1);
  const top = ranked?.slice(0, 3).map((r) => r.symbol).join(', ') ?? '';
  return {
    season: regime.season, reason: regime.reason,
    topScalpCoins: top,
    advice: regime.season === 'NO_TRADE'
      ? 'NO_TRADE: BTC middle of range. Watch alts for sweep setups only, or stay out.'
      : regime.season === 'CHOP'
        ? 'CHOP: alts only, A setups only, quick scalps, no forcing.'
        : `${regime.season}: bias ${regime.season === 'LONG_SEASON' ? 'LONG' : 'SHORT'} on alts. Focus on ${top}.`,
  };
}
