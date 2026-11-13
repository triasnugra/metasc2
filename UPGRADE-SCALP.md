# UPGRADE-SCALP.md — tnv2 (swing) → metascalp (scalping)

## Yang dipertahankan dari tnv2

- Arsitektur: `core` + `gate` + `trade-sim` + `backtest` + `forward` + `audit` + `index.html` + GitHub Actions.
- Konvensi file `.mjs` (ES modules, tanpa build step, jalan di browser + Node).
- Alur: deteksi → gate → simulasi / scan → audit → dashboard.
- Workflow: deploy Pages + backtest CI + forward harian.

## Yang berubah — dan kenapa

| Aspek | tnv2 (swing) | metascalp (scalping) | Alasan (docx) |
|---|---|---|---|
| Timeframe | H4 / D1 | H1 range, M15 struktur, M5 trigger | "Work on ranges in H1" |
| Hold | Berhari-hari | Max 2 jam (24 bar M5) | Scalp = quick, "small scalps" |
| Entry | Sinyal swing | Sweep → trigger → entry, tanpa trigger tanpa trade | "Triggers are now the norm" |
| SL | Lebar (%) | 0.12–0.80%, invalidation dekat | "Easy invalidations following liquidity" |
| TP | Jauh | TP1 1.5R (60%), TP2 2.5R, SL ke BE | "Small scalps, no loss days" |
| Filter utama | Trend H4 | Lokasi range + sweep + season | "Tengah range = no edge" |
| Season | Trend panjang | BTC di atas/bawah H1 box → bias long/short alts | "TOTAL box" |
| Heatmap | Tidak ada / sekunder | Depth proxy, hanya konfirmasi +5 max | "PA + Heatmap, heatmap bukan strategi" |
| Risk | Lebih besar per trade | 0.5% A / 0.25% B, max loss harian 1%, max 5 trade, cooldown 2 loss | "Low drawdown satu-satunya strategi viable" |
| Setup | Swing (breakout / trend) | 5 setup scalp: sweep-reclaim, deviasi, pullback, squeeze, reclaim | Postingan sweep / squeeze / reclaim |
| Validasi | Backtest | Backtest + walk-forward + audit gate | Mencegah overfit di regime berubah |

## Migrasi: jika kamu punya parameter tnv2 yang terbukti

Jangan copy mentah parameter swing ke scalp. Yang boleh dipindah: struktur file, konvensi naming, workflow Actions.
Parameter (SL, TP, hold, risk) harus di-backtest ulang di `backtest.mjs` karena distribusi return scalp beda total dari swing.
