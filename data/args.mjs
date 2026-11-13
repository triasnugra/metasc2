// metascalp — args.mjs
// Shared CLI parser. FIX 2026-11-13: the old parser only understood --key=value.
// GitHub Actions + humans write --key value (space). Old parser turned
// `--symbol BTCUSDT` into {symbol: true, BTCUSDT: true}, so backtest ran with
// symbol=true, limit=Number(true)=1, and requested ?symbol=true&limit=1.
// This parser handles both forms, plus bare --flag.
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue; // bare values are consumed as the previous key's value
    const eq = a.indexOf('=');
    if (eq !== -1) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}
