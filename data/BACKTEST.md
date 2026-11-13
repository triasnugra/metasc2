# BACKTEST.md — Cara backtest yang jujur

## Jalankan

```bash
node backtest.mjs --symbol BTCUSDT --limit 500
node backtest.mjs --symbol ETHUSDT --limit 500
node backtest.mjs --symbol PEPEUSDT --limit 500
```

Atau dari dashboard: tombol **Backtest BTC**.

## Yang dilakukan engine

1. Di setiap bar M15, deteksi setup **hanya dari histori sampai bar itu** (tanpa lookahead).
2. Gate: skor ≥60, RR ≥1.5, SL 0.12–0.80%, bukan tengah range, bukan sentuhan ke-3, bukan chasing.
3. Simulasi maju di M5: TP1 1.5R ambil 60% + SL ke breakeven, TP2 2.5R, atau SL, atau timeout 2 jam (24 bar M5).
4. Fee 0.04% + slippage 0.02% per sisi sudah dipotong.

## Yang dicek audit gate (`audit-gate.mjs`)

- Min 30 trade (di bawah itu: tidak cukup bukti)
- Profit factor ≥1.3
- Expectancy >0
- Win rate ≥40%
- Max drawdown ≤8R
- Walk-forward: paruh pertama DAN paruh kedua harus expectancy >0 (kalau paruh kedua negatif = kemungkinan overfit / regime berubah)

`FAIL` = jangan live. `WARN` = forward test demo dulu. `PASS` = layak forward test, bukan jaminan live.

## Batasan yang harus diakui

- Backtest memakai candle M5 (bukan tick), jadi fill diasumsikan di TP/SL dalam bar, SL didahulukan (konservatif).
- Depth / heatmap tidak ada di histori — di backtest, konfirmasi heatmap dianggap netral (skor tanpa +5 heatmap).
- Regime (season) di backtest memakai BTC H1 yang sama — ini wajar karena season adalah konteks, bukan sinyal entry.
- Spread / funding tidak dimodelkan penuh. Untuk scalp, funding & spread nyata bisa mengubah hasil — cek di forward test.
