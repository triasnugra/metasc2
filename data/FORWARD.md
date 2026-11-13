# FORWARD.md — Cara forward test & live scan

## Scan live (tanpa menaruh trade)

```bash
node forward.mjs --account 10000
```

Output: satu keputusan per simbol (`TRADE` / `WAIT` / `ERROR`) + plan lengkap untuk yang `TRADE`:
Entry, SL (invalidation), TP1, TP2, size, margin, trigger, alasan.

Hasil disimpan ke `data/forward-latest.json` (dipakai GitHub Actions artifact).

## Di dashboard

Tombol **Scan Live** → scan 8 simbol → kartu sinyal. Tombol **Saya ambil setup ini** hanya mencatat ke Daily Guard (bukan menaruh trade ke exchange).

## GitHub Actions — Daily Forward Scan

Workflow `.github/workflows/forward.yml` jalan tiap hari 13:00 UTC (20:00 WIB, sebelum sesi NY) + bisa manual (`Run workflow`).
Hasil di `Actions → Daily Forward Scan → Artifacts → forward-latest`.

## Aturan forward test yang disarankan

1. 2 minggu demo / paper trade. Catat setiap sinyal TRADE: diambil / tidak, hasil R, alasan.
2. Bandingkan hasil paper vs backtest. Jika expectancy paper <0 sementara backtest >0, jangan naik size — regime mungkin berubah.
3. Jangan ubah `config.mjs` di tengah forward test. Satu variabel diubah = ulang 2 minggu.
4. Jika audit gate `FAIL` di backtest terbaru, hentikan forward live, kembali ke research.
