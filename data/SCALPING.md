# SCALPING.md — Doktrin dari docx → Kode

Sumber: `no tanggal postingan.docx` (postingan scalping, Nov 2025 – Nov 2026).
Setiap baris di bawah adalah aturan yang ditegakkan kode, bukan sekadar nasihat.

## 1. Season / Regime — "Scalp long di long season, short di short season"

| Postingan | Aturan | Kode |
|---|---|---|
| 23 Agu 2026: "Work on ranges in H1, deviations from range highs/lows. Scalp long in long season, short in short season" | H1 = timeframe range. Arah scalp mengikuti season. | `config.mjs: timeframes`, `core.mjs: regimeFromBTC()` |
| 13 Mei 2026: "TOTAL di atas red box → long scalp bias alts. Di bawah → short bias. Jangan prediksi, reaksi." | BTC di atas box H1 → LONG_SEASON. Di bawah → SHORT_SEASON. | `core.mjs: regimeFromBTC()` — BTC dipakai sebagai proxy TOTAL box karena BTC memimpin alts |
| 10 Nov 2026: "Scalping + low drawdown satu-satunya strategi viable" | Risk kecil, drawdown dijaga kode. | `config.mjs: risk`, `gate.mjs: dailyGuard()` |

## 2. Lokasi — "Tengah range = no-man's land, tidak ada edge"

| Postingan | Aturan | Kode |
|---|---|---|
| 8 Okt 2026: "BTC di tengah nowhere, tengah range, tanpa edge. Tanpa influx liquidity di atas high / bawah low + trigger, tidak ada yang dilakukan. Saya tidak chase, tidak antisipasi." | Tengah range (35–65%) = NO_TRADE. Hanya edge + sweep + trigger yang boleh trade. | `core.mjs: isMiddleOfRange()`, `scalp-lib.mjs: detectSetups()` filter, `gate.mjs: gateDecision()` |
| 8 Okt 2026: "Altcoin lebih menarik, tapi quick scalps. Pilih sedikit peluang berkualitas, timing tepat. Jangan force." | Max 5 trade/hari, skor ≥60, B = setengah size. | `gate.mjs` |

## 3. Trigger — "Bekerja dengan trigger adalah norma; tanpanya semua berisiko"

| Postingan | Aturan | Kode |
|---|---|---|
| 5 Nov 2026: "Working with triggers is now the norm" | Entry HANYA setelah trigger M15: engulfing / EMA flip / pinbar / momentum close. | `core.mjs: triggerQuality()`, semua detektor di `scalp-lib.mjs` |
| 31 Mar 2026: "Ikuti trigger, bertindak sesuai rencana" | Trigger close = acuan anti-chase (max 0.10%). | `gate.mjs: gateDecision()` chase check |
| 8 Okt 2026: "Scalp pun harus di entry presisi, di situlah RR terbaik. Jangan entry random, jangan chase." | Entry = trigger close, SL = invalidation dekat. | `scalp-lib.mjs: makeSetup()` |

## 4. Lima Setup

| Setup | Postingan kunci | Kode |
|---|---|---|
| **SWEEP_RECLAIM** | 13 Okt 2026: "Dip BTC, liquidity sweep di bawah Monday low, sempurna untuk scalp long." + 5 Jan 2025: scalp leverage + invalidation mudah mengikuti liquidity | `detectSweepReclaim()` — wick 0.05–0.60% di bawah range/Monday low + close balik + trigger. Prioritas tertinggi. |
| **RANGE_DEVIATION** | 23 Agu 2026: fokus deviasi dari range high/low H1 | `detectDeviation()` |
| **PULLBACK** | 12 Jul 2026 TRB: "rally momentum → pullback ke area → tunggu konfirmasi, selama area jadi support RR menarik" | `detectPullback()` — pullback ke EMA20 / mid H1 |
| **SQUEEZE** | 8 Agu 2026: "Box kunci untuk squeeze. BTC 1% 3 hari. Tahan 63.8k → dorong 65k. Di atas 65k short squeeze + akselerasi." + 2 Jul 2026: "Flip EMA → squeeze up" | `detectSqueeze()` + `core.mjs: isSqueezed()` — box <0.8% + breakout + trigger |
| **RECLAIM** | 9 Okt 2026 INJ: "Reclaiming range → menarik untuk scalp long. Sampai itu, tidak ada minat." + 9 Okt: short hanya jika konfirmasi level kunci hilang | `detectReclaim()` |

## 5. Decay — "Bounce pertama 6%, kedua 5%, ketiga tidak valid"

| Postingan | Aturan | Kode |
|---|---|---|
| 18 Jun 2026 INJ: "Bounce pertama 6%, kedua 5%, sekarang tidak valid lagi" | Sentuhan ke-3 tidak valid. Sentuhan ke-2 kena penalti skor −10. | `config.mjs: maxTouches: 2`, `gate.mjs: scoreSetup()` |

## 6. Heatmap / Likuiditas — "Heatmap alat, bukan strategi"

| Postingan | Aturan | Kode |
|---|---|---|
| 7 Jul 2026: "Heatmap tanpa Price Action = ikut kerumunan. PA + Heatmap = probabilitas lebih tinggi. Heatmap terbaik saat uptrend kuat." | Depth hanya konfirmasi (+5 skor max), tidak pernah memicu entry. | `core.mjs: heatmapProxy()` (depth Binance), `gate.mjs: scoreSetup()` |
| 5 Nov 2025 ETH: "Harga mengikuti klaster likuidasi / stop-loss. Likuiditas tunjukkan KEMANA harga mungkin pergi, bukan KAPAN entry. Butuh konteks: struktur, volume, konfirmasi." | Likuiditas = target & lokasi sweep, entry tetap butuh trigger. | `scalp-lib.mjs` |
| 28 Nov 2025 BTC: "Binance menggerakkan harga dengan dinding likuiditas heatmap: geser order, hapus bawah, bangun atas → paksa ke channel. Spike volume + absorpsi di low konfirmasi." | Volume spike = konfirmasi absorpsi (≥1.2x). | `core.mjs: volumeStats()`, `gate.mjs` volume score |
| 6 Mei 2026: "Heatmap + likuiditas = strategi scalping excellent" | Heatmap dipakai sebagai konfirmasi di gate, bukan pengganti PA. | `gate.mjs` |

## 7. Risk — "Small scalps, no loss days = sukses besar"

| Postingan | Aturan | Kode |
|---|---|---|
| 11 Nov 2026: "Small scalps, tanpa sukses besar, hampir tepat di entry, tanpa loss — itu sudah sukses besar" | Target: bertahan, bukan jackpot. TP1 1.5R ambil 60%. | `trade-sim.mjs` |
| 21 Okt 2026: "Kalau tidak tahu apa yang harus dilakukan, tunggu. Lebih baik di pinggir daripada wipe out menebak." | WAIT adalah keputusan valid. Gate default WAIT. | `gate.mjs` |
| 22 Okt 2026: "Scalping sekarang profitable, tapi kalau tidak tahu caranya, mundur dan tonton, kalau tidak akan terluka" | Dashboard menampilkan WAIT dengan alasan, bukan memaksa sinyal. | `index.html`, `forward-lib.mjs` |
| 30 Okt 2026: "Tunggu arah jelas, small scalp saja" | B setup = setengah risk. | `config.mjs` |

## 8. Sesi

| Postingan | Aturan | Kode |
|---|---|---|
| 13 Okt 2026: "Move terbaik selalu saat saya tidur" + 5 Nov 2026: "Lihat setelah US open" | Asia = skor sesi rendah (0.45), NY = tertinggi (1.0). | `core.mjs: sessionOf()`, `sessionScore()` |
| PEPE 30 Okt 2026: "The coin for scalping" | PEPE masuk universe default (volatilitas tinggi). | `config.mjs: symbols` |

## Yang TIDAK diambil dari docx

- Level harga spesifik (63.8k, 65k) dipakai sebagai **contoh**, bukan level hardcoded. Level dihitung live dari H1 box.
- Gambar/chart di docx tidak bisa dibaca sebagai data — aturan yang diambil hanya yang tertulis.
- Tidak ada klaim win rate dari postingan. Win rate harus dibuktikan backtest + audit (`audit-gate.mjs`).
