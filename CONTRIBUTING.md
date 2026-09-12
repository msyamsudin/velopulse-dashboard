# Panduan Kontribusi

Dokumen ini menjelaskan cara perubahan masuk ke repositori ini: format commit,
cara versi ditentukan, cara rilis dibuat, dan bagaimana pekerjaan yang dibantu AI
dicatat.

**Bahasa:** dokumen untuk manusia (README, CONTRIBUTING, ADR), komentar kode,
dan pesan commit ditulis dalam **Indonesia**. Identifier — nama variabel,
fungsi, tipe, dan berkas — serta kunci i18n tetap **Inggris**: bahasa Indonesia
masuk ke kalimat, bukan ke nama. Token yang dibaca mesin (tipe/scope commit,
`BREAKING CHANGE:`, `Assisted-by:`) juga tetap Inggris. Karena identifier tetap
Inggris, satu berkas sumber wajar memuat dua bahasa; yang dilarang adalah
mencampurnya dalam satu paragraf.

---

## 1. Pesan commit

Repositori ini memakai [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipe>(<scope opsional>): <subjek>

<body opsional: kenapa, bukan apa>

<footer opsional>
```

Tipe yang diizinkan:

| Tipe | Untuk |
| --- | --- |
| `feat` | Fitur baru yang terlihat pengguna |
| `fix` | Perbaikan bug |
| `perf` | Peningkatan performa |
| `revert` | Membatalkan commit sebelumnya |
| `docs` | Dokumentasi |
| `refactor` | Perubahan struktur tanpa mengubah perilaku |
| `test` | Menambah/memperbaiki tes |
| `build` | Build, dependensi, toolchain |
| `ci` | Konfigurasi CI |
| `chore` | Perawatan rutin |
| `style` | Formatting, tanpa perubahan perilaku |

Contoh yang baik:

```
feat(history): gambar kurva power upaya terbaik
fix(i18n): terjemahkan sisa aplikasi dan tegakkan pemeriksaannya di CI
feat(api)!: hapus endpoint sinkronisasi lama
```

### Kenapa ini bukan sekadar preferensi gaya

`release-please` membaca tipe commit untuk memutuskan naik atau tidaknya versi,
dan `scripts/gen-changelog.mjs` memakainya untuk menyusun catatan rilis. Pesan
commit yang tidak sesuai **tidak menghasilkan error di mana pun** — perubahannya
hanya hilang dari changelog. Karena itu pelanggarannya dijadikan kegagalan build.

Subjek boleh berbahasa Indonesia, tetapi **tipe dan scope tidak**. Keduanya
dibaca mesin: `scripts/lib/conventional-commits.mjs` mencocokkan tipe terhadap
daftar tertutup, dan `release-please-config.json` memetakan tipe itu ke section
changelog. Header seperti `fitur(riwayat): ...` karena itu ditolak hook, dan
`BREAKING CHANGE:` harus tetap ditulis dalam bahasa Inggris agar terdeteksi.

### Jebakan BOM

Delapan commit dalam riwayat repo ini diawali karakter **UTF-8 BOM** (`U+FEFF`)
sebelum kata `feat`/`fix`. BOM tidak terlihat di `git log`, tetapi membuat setiap
pola yang berjangkar `^` gagal cocok. Akibatnya commit tersebut dilewati oleh
tooling rilis pihak ketiga tanpa pesan apa pun.

`scripts/check-commit-msg.mjs` menolak BOM sebagai error dan `--fix` akan
menghapusnya. Generator changelog milik repo ini sendiri sudah tahan-BOM, jadi
riwayat lama tetap terbaca utuh — tetapi jangan mengandalkan itu untuk commit
baru.

### Hook

`pnpm install` otomatis menjalankan `scripts/setup-git-hooks.mjs`, yang
mengarahkan `core.hooksPath` ke `.githooks/`. Setelah itu setiap commit divalidasi
secara lokal:

- `.githooks/commit-msg` — menghapus BOM dan memvalidasi header
- `.githooks/prepare-commit-msg` — menambahkan trailer atribusi (lihat bagian 5)

Perintah terkait:

```bash
pnpm run hooks:install     # pasang ulang (mis. setelah clone baru)
pnpm run hooks:uninstall   # lepaskan core.hooksPath
pnpm run commit:check -- v0.1.0..HEAD   # audit rentang commit
```

Job `commits` di CI menjalankan validator yang sama, jadi hook yang dilewati
(`--no-verify`) tetap tertangkap.

---

## 2. Versi

Repositori ini memakai [Semantic Versioning](https://semver.org/). Versi hidup di
satu tempat: field `version` pada `package.json`.

**Selama masih pra-1.0 (`0.x`):**

| Perubahan | Naik ke |
| --- | --- |
| `feat` | **minor** — `0.1.0` → `0.2.0` |
| `fix` | **patch** — `0.1.0` → `0.1.1` |
| breaking (`!` atau `BREAKING CHANGE:`) | **minor**, bukan major (`bump-minor-pre-major`) |
| `docs`, `refactor`, `test`, `ci`, `build`, `chore`, `style` | tidak menaikkan versi, tetap masuk changelog |

> Versi **tidak pernah** di-bump manual. `release-please` yang melakukannya
> (bagian 3). Satu-satunya pengecualian ada di bagian 3.4.

### 2.1 Identitas build

Nomor versi saja tidak bisa menjawab "commit mana yang sedang live?". Karena itu
setiap build menyematkan tiga nilai dari `next.config.mjs`:

| Variabel | Isi |
| --- | --- |
| `NEXT_PUBLIC_APP_VERSION` | `version` dari `package.json` |
| `NEXT_PUBLIC_COMMIT_SHA` | commit SHA (dari host, atau `git rev-parse HEAD`) |
| `NEXT_PUBLIC_BUILD_DATE` | waktu build (ISO) |

Ketiganya dibaca lewat `src/lib/version.ts` dan ditampilkan di footer dashboard
serta **Settings > System > Info build**. Saat melaporkan bug, sertakan
`versi+sha` dari sana — tanpa itu, "versi 0.2.0" bisa berarti belasan deployment
berbeda.

---

## 3. Proses rilis

### 3.1 Alur normal

1. Merge commit konvensional ke `main`.
2. Workflow `Release` menjalankan `release-please`, yang membuka/memperbarui
   **release PR**. PR itu berisi bump `package.json` + entri `CHANGELOG.md` baru.
3. Saat siap rilis, **merge release PR tersebut**.
4. `release-please` membuat tag git (`v0.2.0`) dan GitHub Release.

Anda tidak menulis changelog dan tidak menyentuh nomor versi dalam alur ini.

**Tag harus berbentuk `v<versi>`** (`v0.2.0`). Karena itu
`include-component-in-tag` sengaja dimatikan di `release-please-config.json`:
dengan nilai default `true`, release-please mencari tag
`velopulse-dashboard-v0.2.0`, tidak menemukannya, lalu menyimpulkan bahwa
**tidak ada satu pun rilis** yang pernah ada — dan menawarkan changelog yang
memuat ulang seluruh riwayat ke dalam satu versi. Ini sudah pernah terjadi dan
tercatat di riwayat PR repo ini.

### 3.2 Setup sekali di GitHub

- **Settings > Actions > General >** aktifkan *"Allow GitHub Actions to create and
  approve pull requests"*. Tanpa ini release PR tidak bisa dibuka.
- Opsional: tambahkan secret `RELEASE_PLEASE_TOKEN` (PAT). Dengan `GITHUB_TOKEN`
  bawaan, release PR tetap dibuat tetapi workflow lain tidak berjalan di atasnya,
  sehingga hasil CI tidak muncul di PR itu. Workflow sudah otomatis memakai PAT
  begitu secret-nya ada.

### 3.3 Verifikasi lokal sebelum push

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run i18n:check:strict
pnpm run schema:check
pnpm test
```

Semuanya juga berjalan di CI (`.github/workflows/test.yml`).

### 3.4 Rilis manual (bootstrap / pemulihan)

`release-please` memegang `CHANGELOG.md` untuk rilis normal. `gen-changelog.mjs`
adalah jalur manual untuk dua situasi: membangun changelog pada proyek yang belum
punya rilis (yang terjadi pada `v0.1.0`), atau memulihkan riwayat yang rusak.

```bash
pnpm run changelog -- --range v0.1.0..HEAD        # pratinjau ke stdout
pnpm run changelog:write -- --version 0.2.0      # tulis ke CHANGELOG.md
```

Untuk merilis tanpa release-please:

```bash
git tag -a v0.2.0 -m "VeloPulse Dashboard 0.2.0"
git push origin v0.2.0
```

### 3.5 Catatan tentang `v0.1.0`

Tag `v0.1.0` dibuat manual dan berisi rekonstruksi 113 commit pertama, yang
sebagian besar belum mengikuti Conventional Commits. Commit tersebut muncul di
bagian **Other Changes** pada `CHANGELOG.md` — tidak ada yang dibuang. Setelah
`v0.1.0`, seluruh alur diserahkan ke `release-please`.

---

## 4. Cabang

- Cabang berumur pendek, satu tujuan, lalu dihapus.
- Merge ke `main` memakai **squash**, supaya satu perubahan = satu commit
  konvensional. Ini yang membuat changelog otomatis tetap bisa dibaca.
- Aktifkan **Settings > Automatically delete head branches** agar cabang tidak
  menumpuk. Cabang yang sudah ter-merge bisa dilihat dengan:

  ```bash
  git branch --merged main
  ```

- Jaga `main` tetap bisa di-deploy: perubahan masuk lewat PR, bukan push langsung.

---

## 5. Pengembangan dengan bantuan AI

Sebagian besar perubahan di repositori ini ditulis bersama agen AI. Git tetap
sumber kebenaran, tetapi ada tiga hal yang berubah.

### 5.1 Catat atribusinya

Trailer yang jadi konsensus lintas proyek adalah **`Assisted-by:`** — dipakai
Fedora, Rocky Linux, LLVM, OpenInfra, OpenTelemetry, dan Linux kernel. Artinya
penting: **manusia tetap penulisnya**, AI adalah alat yang membantu. Itu juga yang
menjaga rantai hak cipta tetap utuh, karena CLA dan DCO hanya bisa ditandatangani
manusia.

```
feat(history): add the interval breakdown

Kenapa perubahan ini ada, dan apa yang diverifikasi manual.

Assisted-by: DeepSeek Harness (deepseek-v4-flash)
```

Nilainya adalah **nama agent + versi model**, karena itulah yang membuat trailer
ini berguna. Contoh resmi dari
[OpenTelemetry](https://github.com/open-telemetry/community/blob/main/policies/genai.md)
adalah `Assisted-by: Claude Opus 4.5`, sedangkan
[dokumen Linux kernel](https://docs.kernel.org/process/coding-assistants.html)
memakai bentuk `Assisted-by: LLM [TOOL1] [TOOL2]` — dengan catatan bahwa daftar
tool itu hanya untuk alat analisis khusus (coccinelle, sparse), **bukan** tool
dasar seperti git, gcc, atau editor.

Dua hal yang jangan dilakukan:

- **Jangan pakai `Co-authored-by:` untuk AI.** Itu default GitHub Copilot, Cursor,
  dan Claude, tetapi menyatakan model sebagai rekan penulis, sedangkan model tidak
  bisa menandatangani CLA/DCO atau memegang hak cipta. Lihat diskusi
  [CALCITE-7752](https://issues.apache.org/jira/browse/CALCITE-7752).
- **Jangan menambahkan `Signed-off-by` atas nama AI.** Hanya manusia yang boleh
  mensertifikasi Developer Certificate of Origin, dan hook di repo ini tidak
  pernah menulisnya.

Cara praktisnya, biarkan hook yang menuliskan trailernya:

```bash
VELOPULSE_AI_ASSISTED="DeepSeek Harness (deepseek-v4-flash)" git commit -m "feat(ui): ..."
```

`VELOPULSE_AI_ASSISTED=1` menghasilkan trailer generik `AI assistant`. Tanpa
variabel ini tidak ada yang ditambahkan, sehingga commit yang murni ditulis
manusia tidak tersentuh.

Berguna untuk apa: saat insiden produksi terjadi, Anda bisa menjawab "perubahan
mana yang perlu ditinjau ulang" — dan itu pertanyaan yang berbeda dari "siapa yang
menekan tombol commit". Survei kebijakan lintas foundation dirangkum di
[All Things Open](https://allthingsopen.org/articles/open-source-ai-contributions-assisted-by-git-trailer-standard),
dan tooling seperti
[AI attribution hooks](https://github.com/mgoodric/ai-attribution-hooks) bergerak
ke arah yang sama.

Kebijakan untuk agen ditulis terpisah di [`AGENTS.md`](AGENTS.md), supaya agen
membacanya otomatis alih-alih menebak.

### 5.2 Yang tetap harus dilakukan manusia

- **Tulis "kenapa" pada body commit/PR.** Subjek "tambahkan panel analisis
  lanjutan" tidak memberi tahu apa pun tentang alasan. Agen bisa mengubah 20 file
  dalam satu langkah; niatnya harus ditulis manusia.
- **Tinjau diff-nya, bukan ringkasannya.** Ringkasan agen selalu terdengar yakin,
  termasuk saat salah.
- **Jangan longgarkan gate.** Karena throughput naik, satu-satunya yang menjaga
  kualitas adalah CI yang ketat. Jangan merge dengan tes yang di-skip.

### 5.3 Catatan keputusan

Alasan di balik keputusan arsitektur disimpan sebagai ADR di
[`docs/adr/`](docs/adr/), bukan di percakapan. Percakapan hilang; berkas tidak.

---

## 6. Perubahan skema database

Skema Supabase dilacak sebagai migrasi bertimestamp. Jangan pernah menyunting
`supabase/schema.sql` langsung — berkas itu hasil generate.

Lihat [`supabase/README.md`](supabase/README.md). Singkatnya:

1. Tambah `supabase/migrations/<timestamp>_<deskripsi>.sql` (idempoten).
2. `pnpm run schema:build`
3. Commit migrasi **dan** `schema.sql` hasil generate.

CI akan gagal kalau keduanya tidak sinkron (`pnpm run schema:check`).
