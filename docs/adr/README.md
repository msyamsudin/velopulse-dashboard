# Architecture Decision Records

Catatan keputusan arsitektur untuk VeloPulse Dashboard.

ADR merekam **kenapa** sebuah keputusan diambil, bukan hanya apa yang dilakukan.
Kode menunjukkan hasilnya; file ini menjelaskan alternatif yang ditolak dan
konsekuensi yang diterima. Sebagian besar perubahan di repositori ini ditulis
bersama agen AI, dan alasan di balik keputusan tidak tersimpan di percakapan yang
hilang — karena itu ia ditulis di sini.

## Daftar

| # | Keputusan | Status |
| --- | --- | --- |
| [0001](./0001-pelacakan-versi-dan-strategi-rilis.md) | Pelacakan versi dan strategi rilis | Diterima |

## Format

Setiap ADR memakai struktur ringan:

```markdown
# N. Judul

- **Status:** Diusulkan | Diterima | Digantikan oleh ADR-XXXX
- **Tanggal:** YYYY-MM-DD

## Konteks
## Keputusan
## Alasan
## Konsekuensi
## Alternatif yang ditolak
```

## Menambah ADR

1. Salin nomor berikutnya: `0002-<judul-singkat>.md`.
2. Jangan mengubah ADR yang sudah diterima. Kalau keputusannya berubah, tulis ADR
   baru dan tandai yang lama sebagai `Digantikan oleh ADR-XXXX`.
3. Tambahkan barisnya ke tabel di atas.
