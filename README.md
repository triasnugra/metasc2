# metascalp — Mesin Analisis Scalping Crypto

Evolusi dari **tnv2** (mesin swing) menjadi mesin **scalping**.
Arsitektur sama — `core` + `gate` + `trade-sim` + `backtest` + `forward` + `audit` + `index.html` + GitHub Actions — logikanya diganti total ke scalping.

Doktrin dari `no tanggal postingan.docx` dipetakan 1:1 ke kode di `SCALPING.md`.

## Cara kerja — 1 kalimat

**H1 tentukan range & season → M15 tunggu sweep / deviasi / pullback / squeeze / reclaim → M5 tunggu trigger → baru entry. Tanpa trigger, tanpa trade.**

## Quick start (lokal)

```bash
node forward.mjs --account 10000   # scan live 8 simbol
node backtest.mjs --symbol BTCUSDT # backtest walk-forward + audit
npx --yes serve . -l 5173          # buka dashboard di http://localhost:5173
```

## Deploy ke GitHub Pages (repo metascalp)

1. Buat repo baru di GitHub: `triasnugra/metascalp` (Public).
2. Upload **seluruh isi folder ini** ke branch `main` (drag-drop di web GitHub, atau `git push`).
3. `Settings → Pages → Build and deployment → Source: GitHub Actions`.
4. Push apa pun → workflow `Deploy to GitHub Pages` jalan → situs live di `https://triasnugra.github.io/metascalp/`.
5. `Actions → Daily Forward Scan → Run workflow` untuk scan manual. Scan otomatis tiap hari 13:00 UTC (20:00 WIB).
6. `Actions → Backtest CI` jalan tiap push + tiap Minggu, hasil di Artifacts.

Tidak ada build step, tidak ada API key, tidak ada backend. Data dari Binance public API langsung dari browser / Node.

## File

| File | Peran (mirip tnv2) |
|---|---|
| `config.mjs` | Satu-satunya tempat tuning: simbol, gate, risk, sesi |
| `core.mjs` | Indikator + struktur: EMA/ATR/RSI/VWAP, range, sweep, trigger, sesi, regime, heatmap proxy (depth) |
| `scalp-lib.mjs` | 5 setup: SWEEP_RECLAIM, RANGE_DEVIATION, PULLBACK, SQUEEZE, RECLAIM |
| `gate.mjs` | Scoring 0–100 + hard gate + daily guard (max loss, max trade, cooldown) |
| `trade-sim.mjs` | Simulasi: TP1 60% + SL ke BE, TP2, fee + slippage |
| `backtest-lib.mjs` + `backtest.mjs` | Walk-forward backtest, tanpa lookahead |
| `forward-lib.mjs` + `forward.mjs` | Scan live, tanpa menaruh trade |
| `audit-gate.mjs` | Audit: min 30 trade, PF ≥1.3, expectancy >0, walk-forward |
| `research.mjs` | Ranking koin scalping + ringkasan regime |
| `index.html` | Dashboard: scan, backtest, kalkulator risiko, daily guard |
| `.github/workflows/` | `deploy.yml` (Pages), `backtest.yml` (CI), `forward.yml` (scan harian) |

## Aturan keras (ditegakkan kode, bukan niat)

- Tengah range = NO TRADE. Sentuhan ke-3 = setup tidak valid.
- Entry >0.10% dari trigger close = CANCEL, jangan chase.
- SL 0.12–0.80%. Lebih lebar bukan scalp.
- Risk 0.5% (A) / 0.25% (B). Max loss harian 1%. Max 5 trade/hari. 2 loss → cooldown 60 menit.
- TP1 1.5R ambil 60%, SL ke breakeven. TP2 2.5R. Max hold 2 jam.
- Heatmap hanya konfirmasi. Heatmap tanpa Price Action = ikut kerumunan.

## Peringatan

Ini mesin sinyal, **bukan auto-trader** dan **bukan nasihat keuangan**. Backtest ≠ jaminan. Jalankan audit gate, forward test 2 minggu di demo, baru pertimbangkan live dengan size kecil.
