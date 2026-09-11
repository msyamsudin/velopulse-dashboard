# AGENTS.md

Aturan untuk agen AI yang bekerja di repositori ini. Untuk manusia, lihat
[`CONTRIBUTING.md`](CONTRIBUTING.md) — berkas ini versi ringkas yang dioptimalkan
untuk dibaca agen.

**Repositori:** VeloPulse Dashboard — dashboard fitness Next.js 16 + React 19,
state di zustand, backend Supabase, di-deploy sebagai web app.

---

## 1. Gerbang wajib sebelum menyatakan pekerjaan selesai

```bash
pnpm exec tsc --noEmit        # 0 error
pnpm run lint                 # 0 error
pnpm run i18n:check:strict    # setiap t('...') literal punya terjemahan
pnpm run schema:check         # schema.sql sinkron dengan migrasi
pnpm test                     # seluruh suite hijau
```

`pnpm run lint` memang melaporkan beberapa peringatan `react-hooks/set-state-in-effect`
dan `@typescript-eslint/no-explicit-any`; itu disengaja dan bukan alasan untuk
tindakan apa pun. Yang harus nol adalah **error**.

**Jangan pernah melonggarkan gate ini** — melewati tes, menambah `eslint-disable`,
`@ts-ignore`, atau `--no-verify` — supaya pekerjaan terlihat selesai. Kalau sebuah
gate gagal, laporkan kegagalannya.

---

## 2. Pesan commit

[Conventional Commits](https://www.conventionalcommits.org/):
`<tipe>(<scope>): <subjek>`

Tipe yang sah: `feat`, `fix`, `perf`, `revert`, `docs`, `refactor`, `test`,
`build`, `ci`, `chore`, `style`.

- **Jangan pernah memulai pesan commit dengan BOM** (`U+FEFF`). Hook dan CI
  menolaknya, dan alasannya nyata: BOM membuat tooling rilis melewati commit itu
  tanpa satu pun pesan error.
- Tulis **kenapa** di body, bukan hanya apa. Perubahan agen cenderung besar dan
  multi-tujuan, dan subjek satu baris tidak bisa membawa niat itu.
- `.githooks/commit-msg` memvalidasi secara lokal; job `commits` di CI
  memvalidasi rentang yang sama, termasuk commit yang dibuat dengan `--no-verify`.

---

## 3. Atribusi AI

Tambahkan trailer `Assisted-by: <agent> <versi model>` pada commit yang dibantu AI.

```
feat(history): add the interval breakdown

Kenapa perubahan ini ada, dan apa yang diverifikasi manual.

Assisted-by: DeepSeek Harness (deepseek-v4-flash)
```

- Praktisnya, set `VELOPULSE_AI_ASSISTED="<nama>"` dan hook
  `.githooks/prepare-commit-msg` yang menuliskannya.
- **Jangan** memakai `Co-authored-by:` untuk AI. Itu default beberapa tool, tetapi
  menyatakan model sebagai rekan penulis, dan model tidak bisa menandatangani
  CLA/DCO atau memegang hak cipta.
- **Jangan** menambahkan `Signed-off-by` atas nama AI. Hanya manusia yang boleh
  mensertifikasi Developer Certificate of Origin.

Alasan lengkap dan rujukan kebijakan ada di
[CONTRIBUTING.md §5.1](CONTRIBUTING.md).

---

## 4. Berkas yang TIDAK boleh disunting langsung

| Berkas | Kenapa | Cara mengubah yang benar |
|---|---|---|
| `CHANGELOG.md` | Dimiliki `release-please` | Lewat release PR; `pnpm run changelog:write` hanya untuk bootstrap/pemulihan |
| `package.json` → `version` | Di-bump `release-please` dari tipe commit | Jangan pernah manual |
| `supabase/schema.sql` | Berkas hasil generate | Tambah migrasi baru, lalu `pnpm run schema:build` |
| `src/i18n/index.tsx` | Setiap `t('...')` literal wajib punya entri di map `id` | Tambahkan key **dan** terjemahannya |

---

## 5. Aturan versi (masih pra-1.0)

| Commit | Efek pada versi |
|---|---|
| `feat` | minor — `0.1.0` → `0.2.0` |
| `fix` | patch — `0.1.0` → `0.1.1` |
| breaking (`!` atau `BREAKING CHANGE:`) | minor, bukan major |
| `docs`, `refactor`, `test`, `ci`, `build`, `chore`, `style` | tidak menaikkan versi |

Versi hidup di satu tempat: `package.json`. Jangan menulis nomor versi di
komponen; baca dari `src/lib/version.ts`.

---

## 6. Yang tidak boleh dilakukan agen tanpa izin manusia

- `git push` ke remote, dalam bentuk apa pun.
- `git tag`, atau memindahkan/menghapus tag yang sudah ada.
- Menulis ulang riwayat yang **sudah di-push** (`rebase`, `commit --amend`,
  `filter-branch`).
- Mengubah `AGENTS.md`, `CONTRIBUTING.md`, atau gate di
  `.github/workflows/` untuk **melonggarkan** aturan — agen tidak boleh
  melunakkan aturannya sendiri.
- Menjalankan migrasi database terhadap project Supabase sungguhan.

Commit lokal di cabang kerja sendiri aman dan diharapkan.

---

## 7. Peta repositori

| Jalur | Isi |
|---|---|
| `src/app` | Next.js App Router — halaman dan API routes |
| `src/components` | UI; subfolder `layout/`, `dashboard/`, `history/`, `settings/`, `ui/` |
| `src/lib` | Logika murni, masing-masing dengan `.test.ts` di sebelahnya |
| `src/store` | State zustand |
| `src/hooks` | Hook React |
| `src/i18n/index.tsx` | Kamus: kunci Inggris → terjemahan Indonesia |
| `scripts/` | Tooling repo (linter commit, changelog, schema, hooks) |
| `supabase/migrations/` | Sumber kebenaran skema database |
| `docs/adr/` | Catatan keputusan arsitektur |
| `.githooks/` | Hook git yang terversi |

---

## 8. Bahasa

- Dokumen untuk manusia (`README.md`, `CONTRIBUTING.md`, `docs/adr/`, `AGENTS.md`):
  **Indonesia**.
- Kode, komentar kode, dan pesan commit: **Inggris**.

Jangan mencampur keduanya dalam satu berkas yang sama.
