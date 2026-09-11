# 1. Pelacakan versi dan strategi rilis

- **Status:** Diterima
- **Tanggal:** 2026-09-11
- **Konteks:** Repositori ini sudah memakai git sejak commit pertama (113 commit,
  2026-05-24 → 2026-09-11) dan sudah punya CI, tetapi tidak punya satu pun konsep
  "versi": `package.json` masih bernama `react-example` dengan `version: 0.0.0`,
  tidak ada tag rilis, tidak ada `CHANGELOG.md`, dan aplikasi yang berjalan tidak
  bisa menyebutkan versi dirinya sendiri.

## Konteks

VeloPulse adalah dashboard Next.js yang di-deploy berkelanjutan ke web, dengan
Supabase sebagai satu-satunya state. Konsekuensinya:

- Tidak ada artefak yang "di-install", jadi tidak ada nomor versi yang bisa
  diperiksa pengguna dari berkas yang mereka miliki. Deployment-nya sendiri yang
  menjadi identitas rilis.
- Perubahan skema database harus ikut naik-turun bersama kode; kalau tidak, satu
  rollback kode bisa meninggalkan skema yang tidak cocok.
- Riwayat commit sudah berisi cukup banyak perubahan tanpa konvensi apa pun
  (50 dari 113 commit tidak mengikuti Conventional Commits, dan 8 di antaranya
  membawa BOM yang membuat tooling rilis pihak ketiga melewatinya diam-diam).

## Keputusan

1. **SemVer untuk komunikasi, commit SHA untuk identitas.** `package.json`
   memegang versi SemVer; setiap build juga menyematkan commit SHA
   (`NEXT_PUBLIC_APP_VERSION`/`COMMIT_SHA`/`BUILD_DATE`) dan menampilkannya di
   footer serta Settings > System.
2. **Conventional Commits sebagai kontrak yang ditegakkan**, bukan konvensi tak
   tertulis: validator tanpa dependensi, git hook, dan job CI.
3. **`release-please` memegang siklus rilis** (bump versi, changelog, tag,
   GitHub Release) lewat release PR.
4. **Pra-1.0 memakai `bump-minor-pre-major`**, sehingga breaking change menaikkan
   minor, bukan major, selama versi masih `0.x`.
5. **`v0.1.0` ditandai manual** sebagai baseline, dengan `CHANGELOG.md`
   direkonstruksi dari seluruh riwayat. Commit pra-konvensi masuk ke bagian
   *Other Changes* alih-alih dibuang.
6. **Skema Supabase menjadi migrasi bertimestamp.** `supabase/schema.sql`
   dipertahankan sebagai bundel hasil generate untuk SQL Editor, dan CI memastikan
   ia sinkron dengan `supabase/migrations/`.

## Alasan

- **SHA lebih berguna daripada nomor versi untuk aplikasi web.** "Versi 0.2.0"
  bisa berarti belasan deployment; `0.2.0+abc1234` hanya satu. Rollback dan
  laporan bug butuh yang kedua.
- **Changelog otomatis hanya sebaik pesan commit-nya.** Kalau tipe commit tidak
  ditegakkan, changelog akan bolong tanpa error — dan changelog yang bolong lebih
  berbahaya daripada tidak ada changelog, karena tampak lengkap.
- **Release PR lebih aman daripada rilis otomatis penuh.** `semantic-release`
  menerbitkan rilis setiap kali `main` berubah; `release-please` menahan versi di
  sebuah PR sehingga manusia masih bisa memutuskan "ya, ini 0.2.0".
- **Satu sumber kebenaran untuk skema.** Dua berkas SQL yang dipelihara manual
  akan menyimpang; berkas hasil generate yang diperiksa CI tidak bisa.

## Konsekuensi

- Pesan commit menjadi bagian dari proses build: commit non-konvensional
  menggagalkan CI. Ini disengaja, dan hook lokal memberi umpan balik sebelum push.
- `CHANGELOG.md` dan `package.json` `version` tidak boleh disunting manual lagi.
- 8 commit lama tetap ber-BOM di riwayat. Memperbaikinya berarti menulis ulang
  sejarah `main` yang sudah di-push dan memaksa `push --force` pada repositori
  bersama — biayanya lebih besar daripada manfaatnya, karena generator changelog
  repo ini sudah tahan-BOM dan rentang CI bersifat inkremental sehingga commit
  lama tidak pernah divalidasi ulang.
- `docs/adr/` di-un-ignore dari `.gitignore` (`docs/*` + `!docs/adr/`) supaya
  catatan keputusan ikut terversi, sementara `docs/` tetap ruang kerja lokal.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
| --- | --- |
| Tanpa versi sama sekali, hanya SHA | Cukup untuk deploy, tetapi tidak ada cara menyebut rilis ke pengguna, dan tidak ada titik yang bisa ditandai "stabil". |
| `semantic-release` (rilis penuh otomatis) | Terlalu banyak kekuatan untuk proyek satu orang: setiap push ke `main` langsung menjadi rilis. |
| `changesets` | Dirancang untuk monorepo; satu paket tidak butuh upacara per-PR. |
| Memperbaiki BOM dengan menulis ulang seluruh riwayat | Butuh `push --force` ke `main` bersama, dan memutus setiap hash commit yang sudah direferensikan. |
| Membiarkan dua berkas SQL dipelihara manual | Persis masalah dual-truth yang ADR ini ada untuk mencegahnya. |
| Nomor versi saja di footer, tanpa SHA | Tidak menjawab pertanyaan yang sebenarnya ditanyakan saat ada bug. |
