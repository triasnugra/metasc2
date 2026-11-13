// metascalp — config.mjs
// Single source of truth. Edit this file only to tune the engine.
// Doctrine: docx "no tanggal postingan" — scalping only, low drawdown,
// no chasing, precise entry, easy invalidation, Price Action + Heatmap.
export const CONFIG = {
  version: '1.0.1',
  engine: 'metascalp',
  // Universe — BTC leads, alts scalp. PEPE is explicitly "the coin for scalping".
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'PEPEUSDT', 'INJUSDT', 'LTCUSDT', 'HBARUSDT', 'TRBUSDT'],
  // TOTAL-box proxy: BTC is the market leader. If BTC is above its H1 box -> LONG_SEASON
  // for alts, below box -> SHORT_SEASON. See SCALPING.md §1.
  // Timeframes: H1 = range / season, M15 = structure, M5 = trigger / entry.
  timeframes: { range: '1h', structure: '15m', trigger: '5m' },
  rangeLookbackH1: 48,          // 48 x H1 = 2 days of range
  rangeLookbackM15: 48,
  // Gate — tnv2 gate.mjs, retuned for scalp (tighter, faster).
  gate: {
    minScore: 60,                // below this: WAIT, do not trade
    aScore: 75,                  // A setup: full size
    bScore: 60,                  // B setup: half size
    minRR: 1.5,                  // TP1 must be >= 1.5R, else reject
    maxSLPct: 0.008,             // 0.80% — wider than this is not a scalp
    minSLPct: 0.0012,            // 0.12% — too tight = noise stop
    maxChasePct: 0.0010,         // entry may not be >0.10% away from trigger close
    maxTouches: 2,               // 3rd touch is invalid (INJ: 6%, 5%, then invalid)
    maxHoldM5Bars: 24,           // 24 x M5 = 2h max hold, then exit at market
  },
  // Risk — low drawdown is the strategy, not a suggestion.
  risk: {
    riskPerTradePct: 0.5,        // % of account risked per trade
    riskPerTradePctB: 0.25,       // B setups risk half
    maxDailyLossPct: 1.0,        // hit this -> stop for the day
    maxTradesPerDay: 5,
    maxConsecutiveLosses: 2,     // 2 losses -> cooldown, no revenge
    cooldownMinutes: 60,
    tp1Share: 0.6,               // 60% off at TP1 (1.5R), rest to TP2
    tp1R: 1.5,
    tp2R: 2.5,
    moveToBEAfterTP1: true,
    maxLeverage: 10,
    defaultLeverage: 5,
    feeBps: 4,                   // 0.04% taker per side (Binance futures approx)
    slippageBps: 2,
  },
  // Sessions (UTC). US Open matters — "let's see after US open".
  sessions: {
    asia: { start: 0, end: 8 },
    london: { start: 7, end: 16 },
    newYork: { start: 13, end: 21 },
  },
  // Binance public endpoints (no API key). Browser + Node.
  binance: {
    spotKlines: 'https://api.binance.com/api/v3/klines',
    futuresKlines: 'https://fapi.binance.com/fapi/v1/klines',
    futuresDepth: 'https://fapi.binance.com/fapi/v1/depth',
    futuresTicker24h: 'https://fapi.binance.com/fapi/v1/ticker/24hr',
    futuresOpenInterest: 'https://fapi.binance.com/fapi/v1/openInterest',
    // FIX 2026-11-13: US runners (GitHub westus2) get HTTP 451 from fapi.binance.com.
    // data-api.binance.vision is Binance's market-data-only mirror, same spot
    // endpoints, no geo-block, no key. Used as fallback, never as first choice.
    visionKlines: 'https://data-api.binance.vision/api/v3/klines',
    visionDepth: 'https://data-api.binance.vision/api/v3/depth',
    visionTicker24h: 'https://data-api.binance.vision/api/v3/ticker/24hr',
  },
};

export const SETUP_TYPES = {
  SWEEP_RECLAIM: 'SWEEP_RECLAIM',
  RANGE_DEVIATION: 'RANGE_DEVIATION',
  PULLBACK: 'PULLBACK',
  SQUEEZE: 'SQUEEZE',
  RECLAIM: 'RECLAIM',
};

export const DIRECTIONS = { LONG: 'LONG', SHORT: 'SHORT' };
