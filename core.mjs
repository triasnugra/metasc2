// metascalp — core.mjs
// Pure indicators + market-structure helpers. No DOM, no fetch side-effects
// except fetchKlines / fetchDepth (both use global fetch).
// Mirrors tnv2 core.mjs: same role, scalping timeframes + liquidity helpers.
import { CONFIG } from './config.mjs';

// ---------- basic math ----------
export const last = (a) => a[a.length - 1];
export const sum = (a) => a.reduce((x, y) => x + y, 0);
export const avg = (a) => (a.length ? sum(a) / a.length : 0);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function ema(values, period) {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}
export function sma(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) out.push(null);
    else out.push(avg(values.slice(i - period + 1, i + 1)));
  }
  return out;
}
export function stdev(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    const w = values.slice(i - period + 1, i + 1);
    const m = avg(w);
    out.push(Math.sqrt(avg(w.map((v) => (v - m) ** 2))));
  }
  return out;
}

// Candle: [openTime, open, high, low, close, volume, closeTime, ...] (Binance)
// or object {t,o,h,l,c,v}. Normalise once at the edge.
export function normCandles(raw) {
  return (raw || []).map((c) => {
    if (Array.isArray(c)) {
      return { t: c[0], o: +c[1], h: +c[2], l: +c[3], c: +c[4], v: +c[5], closeT: c[6] };
    }
    return { t: c.t ?? c.time ?? 0, o: +c.o, h: +c.h, l: +c.l, c: +c.c, v: +(c.v ?? 0), closeT: c.closeT ?? 0 };
  });
}
export const closes = (cs) => cs.map((c) => c.c);
export const highs = (cs) => cs.map((c) => c.h);
export const lows = (cs) => cs.map((c) => c.l);

export function atr(candles, period = 14) {
  if (candles.length < 2) return [];
  const trs = [candles[0].h - candles[0].l];
  for (let i = 1; i < candles.length; i++) {
    const p = candles[i - 1].c;
    trs.push(Math.max(candles[i].h - candles[i].l, Math.abs(candles[i].h - p), Math.abs(candles[i].l - p)));
  }
  // Wilder smoothing
  const out = [avg(trs.slice(0, period))];
  for (let i = period; i < trs.length; i++) out.push((out[out.length - 1] * (period - 1) + trs[i]) / period);
  return out;
}
export function rsi(candles, period = 14) {
  const cs = closes(candles);
  const out = [null];
  let gain = 0, loss = 0;
  for (let i = 1; i <= period && i < cs.length; i++) {
    const d = cs[i] - cs[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  if (cs.length <= period) return out;
  let ag = gain / period, al = loss / period;
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (let i = period + 1; i < cs.length; i++) {
    const d = cs[i] - cs[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}
export function vwap(candles) {
  let cumPV = 0, cumV = 0;
  return candles.map((c) => {
    const tp = (c.h + c.l + c.c) / 3;
    cumPV += tp * c.v; cumV += c.v;
    return cumV ? cumPV / cumV : c.c;
  });
}

// ---------- range / structure ----------
export function findRange(candles, lookback = 48) {
  const w = candles.slice(-lookback);
  if (!w.length) return null;
  const high = Math.max(...highs(w));
  const low = Math.min(...lows(w));
  const mid = (high + low) / 2;
  const widthPct = (high - low) / mid;
  // Touches: COUNT CLUSTERS, not candles. One visit to the edge = one touch,
  // even if price spends 3 candles there. Cluster ends when price moves
  // >0.5% away from the edge. Without this, every sideways range reads as
  // "3rd touch" and every setup is wrongly rejected.
  const tol = 0.0015;
  let touchesHigh = 0, touchesLow = 0, inHigh = false, inLow = false;
  for (const c of w) {
    const nearHigh = Math.abs(c.h - high) / high <= tol;
    const nearLow = Math.abs(c.l - low) / low <= tol;
    const awayHigh = Math.abs(c.c - high) / high > 0.005;
    const awayLow = Math.abs(c.c - low) / low > 0.005;
    if (nearHigh && !inHigh) { touchesHigh++; inHigh = true; }
    if (awayHigh) inHigh = false;
    if (nearLow && !inLow) { touchesLow++; inLow = true; }
    if (awayLow) inLow = false;
  }
  return { high, low, mid, widthPct, touchesHigh, touchesLow, bars: w.length, startT: w[0].t, endT: last(w).t };
}
export function rangePosition(price, range) {
  if (!range || range.high === range.low) return 0.5;
  return clamp((price - range.low) / (range.high - range.low), 0, 1);
}
export const isMiddleOfRange = (pos) => pos > 0.35 && pos < 0.65;
export const isNearEdge = (pos) => pos <= 0.18 || pos >= 0.82;

export function swingLevels(candles, lookback = 100, window = 3) {
  // Recent swing highs / lows — the liquidity pools price hunts.
  const out = [];
  const w = candles.slice(-lookback);
  for (let i = window; i < w.length - window; i++) {
    const c = w[i];
    if (c.h === Math.max(...w.slice(i - window, i + window + 1).map((x) => x.h))) out.push({ type: 'HIGH', price: c.h, t: c.t });
    if (c.l === Math.min(...w.slice(i - window, i + window + 1).map((x) => x.l))) out.push({ type: 'LOW', price: c.l, t: c.t });
  }
  return out.slice(-20);
}

// Monday low: lowest low since Monday 00:00 UTC. Docx: sweep below Monday low = perfect scalp long.
export function mondayLow(candles) {
  if (!candles.length) return null;
  const now = new Date(last(candles).t);
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = monday.getUTCDay(); // 0 Sun
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const w = candles.filter((c) => c.t >= monday.getTime());
  if (!w.length) return null;
  return { price: Math.min(...lows(w)), t: monday.getTime() };
}

// ---------- trigger candles ----------
export const bodyPct = (c) => Math.abs(c.c - c.o) / (c.h - c.l || 1);
export const isBullish = (c) => c.c > c.o;
export const isBearish = (c) => c.c < c.o;
export function isEngulfing(prev, curr) {
  if (!prev || !curr) return null;
  if (isBullish(curr) && isBearish(prev) && curr.o <= prev.c && curr.c >= prev.o) return 'LONG';
  if (isBearish(curr) && isBullish(prev) && curr.o >= prev.c && curr.c <= prev.o) return 'SHORT';
  return null;
}
export function isPinbar(c, dir) {
  const range = c.h - c.l || 1;
  const body = Math.abs(c.c - c.o);
  const upper = c.h - Math.max(c.o, c.c);
  const lower = Math.min(c.o, c.c) - c.l;
  if (body / range > 0.35) return false;
  if (dir === 'LONG') return lower / range >= 0.6;  // long lower wick = rejection below
  return upper / range >= 0.6;
}
export function triggerQuality(prev, curr, ema20) {
  // Returns {type, strength 0..1} — trigger is the entry permission, not the idea.
  const eng = isEngulfing(prev, curr);
  if (eng) return { type: 'ENGULFING', dir: eng, strength: 0.95 };
  if (curr && ema20 != null) {
    if (curr.c > ema20 && prev && prev.c <= ema20) return { type: 'EMA_FLIP_UP', dir: 'LONG', strength: 0.85 };
    if (curr.c < ema20 && prev && prev.c >= ema20) return { type: 'EMA_FLIP_DOWN', dir: 'SHORT', strength: 0.85 };
  }
  if (curr && isPinbar(curr, 'LONG')) return { type: 'PINBAR_LONG', dir: 'LONG', strength: 0.7 };
  if (curr && isPinbar(curr, 'SHORT')) return { type: 'PINBAR_SHORT', dir: 'SHORT', strength: 0.7 };
  if (curr && bodyPct(curr) > 0.7) return { type: 'MOMENTUM_CLOSE', dir: isBullish(curr) ? 'LONG' : 'SHORT', strength: 0.6 };
  return null;
}

// ---------- volume ----------
export function volumeStats(candles, period = 20) {
  const vols = candles.map((c) => c.v);
  const avgVol = avg(vols.slice(-period));
  const cur = last(vols) || 0;
  return { avgVol, cur, ratio: avgVol ? cur / avgVol : 1 };
}
export function isVolumeSpike(candles, minRatio = 1.2) {
  return volumeStats(candles).ratio >= minRatio;
}

// ---------- squeeze / compression ----------
// Docx: BTC traded in a 1% range for 3 days, then squeeze. Box is key for squeezing.
export function isSqueezed(candles, lookback = 24, maxWidthPct = 0.008) {
  const r = findRange(candles, lookback);
  if (!r) return { squeezed: false, range: null };
  return { squeezed: r.widthPct <= maxWidthPct, range: r };
}

// ---------- sessions ----------
export function sessionOf(date = new Date()) {
  const h = date.getUTCHours() + date.getUTCMinutes() / 60;
  const { asia, london, newYork } = CONFIG.sessions;
  const inS = (s) => h >= s.start && h < s.end;
  if (inS(newYork)) return 'NEW_YORK';
  if (inS(london)) return 'LONDON';
  if (inS(asia)) return 'ASIA';
  return 'OFF';
}
export function sessionScore(session) {
  // Scalps work best when liquidity is present: London + NY overlap is prime.
  if (session === 'NEW_YORK') return 1.0;
  if (session === 'LONDON') return 0.8;
  if (session === 'ASIA') return 0.45; // docx: best moves happen while asleep — Asia is thin
  return 0.2;
}

// ---------- regime / season ----------
export function regimeFromBTC(btcH1, btcH4) {
  // Returns LONG_SEASON / SHORT_SEASON / CHOP / NO_TRADE.
  // Rule from docx May 13: above the (TOTAL) box -> long scalp bias, below -> short bias.
  // We proxy TOTAL box with BTC H1 box because BTC leads alts.
  if (!btcH1?.length) return { season: 'NO_TRADE', reason: 'no BTC data' };
  const range = findRange(btcH1, CONFIG.rangeLookbackH1);
  const price = last(btcH1).c;
  const pos = rangePosition(price, range);
  const ema50 = last(ema(closes(btcH1), 50));
  const ema200 = btcH4?.length ? last(ema(closes(btcH4), 50)) : ema50;
  const aboveBox = price > range.high;
  const belowBox = price < range.low;
  if (aboveBox && price > ema50) return { season: 'LONG_SEASON', reason: 'BTC above H1 box + above EMA50', range, pos, price };
  if (belowBox && price < ema50) return { season: 'SHORT_SEASON', reason: 'BTC below H1 box + below EMA50', range, pos, price };
  if (isMiddleOfRange(pos) && Math.abs(price - ema50) / price < 0.002) return { season: 'NO_TRADE', reason: 'BTC middle of range, no-man land', range, pos, price };
  if (price > ema50 && ema50 >= ema200) return { season: 'LONG_SEASON', reason: 'BTC above EMA50/EMA200', range, pos, price };
  if (price < ema50 && ema50 <= ema200) return { season: 'SHORT_SEASON', reason: 'BTC below EMA50/EMA200', range, pos, price };
  return { season: 'CHOP', reason: 'BTC choppy, no clear season — alts only, A setups only', range, pos, price };
}

// ---------- Binance public data (no key) ----------
async function httpGet(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}
export async function fetchKlines(symbol, interval, limit = 200, useFutures = true) {
  const base = useFutures ? CONFIG.binance.futuresKlines : CONFIG.binance.spotKlines;
  const url = `${base}?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  return normCandles(await httpGet(url));
}
export async function fetchDepth(symbol, limit = 100) {
  const url = `${CONFIG.binance.futuresDepth}?symbol=${symbol}&limit=${limit}`;
  return httpGet(url);
}
export async function fetchTicker24h(symbol) {
  const url = `${CONFIG.binance.futuresTicker24h}?symbol=${symbol}`;
  return httpGet(url);
}
// Heatmap proxy: depth walls within X% of price. Real heatmap is paid;
// this is the honest proxy — Price Action leads, depth only confirms.
export function heatmapProxy(depth, price) {
  if (!depth?.bids?.length || !depth?.asks?.length) return { bias: 'UNKNOWN', bidWall: 0, askWall: 0, imbalance: 0 };
  const sumWithin = (side, pct) => {
    let s = 0;
    for (const [p, q] of side) {
      const pr = +p;
      if (Math.abs(pr - price) / price <= pct) s += +q * pr; // notional
    }
    return s;
  };
  const bidWall = sumWithin(depth.bids, 0.01);
  const askWall = sumWithin(depth.asks, 0.01);
  const total = bidWall + askWall || 1;
  const imbalance = (bidWall - askWall) / total; // + = bid heavy (support below)
  const bias = imbalance > 0.25 ? 'BID_HEAVY' : imbalance < -0.25 ? 'ASK_HEAVY' : 'BALANCED';
  return { bias, bidWall, askWall, imbalance };
}
