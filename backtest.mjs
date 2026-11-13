// metascalp — backtest.mjs
// CLI: node backtest.mjs --symbol BTCUSDT --limit 500
// Fetches Binance futures klines, runs runBacktest, prints table + writes data/backtest-result.json
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';
import { fetchKlines } from './core.mjs';
import { runBacktest } from './backtest-lib.mjs';
import { auditBacktest } from './audit-gate.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const symbol = args.symbol || 'BTCUSDT';
const limit = Number(args.limit || 500);

async function main() {
  console.log(`metascalp backtest — ${symbol} (H1/M15/M5, limit ${limit})`);
  const [h1, m15, m5] = await Promise.all([
    fetchKlines(symbol, '1h', limit),
    fetchKlines(symbol, '15m', limit),
    fetchKlines(symbol, '5m', limit),
  ]);
  let btcH1 = h1;
  if (symbol !== 'BTCUSDT') btcH1 = await fetchKlines('BTCUSDT', '1h', limit);
  const res = runBacktest({ symbol, h1, m15, m5, btcH1 });
  const audit = auditBacktest(res.metrics, res.trades);
  console.log(`Regime: ${res.regime} | Trades: ${res.metrics.trades} | WinRate: ${(res.metrics.winRate * 100).toFixed(1)}% | AvgR: ${res.metrics.avgR.toFixed(2)} | PF: ${res.metrics.profitFactor.toFixed(2)} | MaxDD: ${res.metrics.maxDrawdownR.toFixed(1)}R | Total: ${res.metrics.totalR.toFixed(1)}R`);
  console.log(`Audit: ${audit.verdict} — ${audit.checks.map((c) => `${c.name}:${c.pass ? 'PASS' : 'FAIL'}`).join(' ')}`);
  for (const w of audit.warnings) console.log(`  WARN: ${w}`);
  const outDir = 'data';
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `backtest-${symbol.toLowerCase()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ ...res, audit }, null, 2));
  console.log(`Wrote ${outPath}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
