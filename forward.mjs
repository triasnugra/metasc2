// metascalp — forward.mjs
// CLI: node forward.mjs [--account 10000]
// Prints today's scan + writes data/forward-latest.json (used by GitHub Actions artifact + dashboard).
import fs from 'node:fs';
import { CONFIG } from './config.mjs';
import { scanMarket } from './forward-lib.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const account = Number(args.account || 10000);

async function main() {
  console.log(`metascalp forward scan — account $${account} — ${new Date().toISOString()}`);
  const res = await scanMarket(CONFIG.symbols, { account });
  console.log(`Season (BTC): ${res.season}`);
  for (const r of res.results) {
    if (r.decision === 'TRADE') {
      console.log(`\n✅ TRADE ${r.symbol} ${r.setup.direction} ${r.setup.type} — score ${r.gate.score} (${r.gate.grade})`);
      console.log(r.plan);
    } else {
      console.log(`⏸️  ${r.symbol}: ${r.decision} — ${r.reason}`);
    }
  }
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/forward-latest.json', JSON.stringify(res, null, 2));
  console.log('\nWrote data/forward-latest.json');
}
main().catch((e) => { console.error(e); process.exit(1); });
