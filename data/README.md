# data/

Hasil backtest & forward scan disimpan di sini oleh `backtest.mjs` / `forward.mjs` dan GitHub Actions.

- `backtest-<symbol>.json` — hasil backtest + audit (dibuat lokal / CI, tidak wajib di-commit)
- `forward-latest.json` — hasil scan live terakhir (dibuat lokal / CI)

File `.gitkeep` ini menjaga folder tetap ada di repo kosong.
Dashboard tidak membaca file ini — dashboard fetch langsung dari Binance.
