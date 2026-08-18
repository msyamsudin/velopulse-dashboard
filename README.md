# VeloPulse Dashboard

VeloPulse adalah dashboard fitness untuk memvisualisasikan data saat latihan.

## Mulai

### Prasyarat

- **Node.js** (disarankan versi LTS terbaru)
- **Akun Supabase** (untuk penyimpanan data)

### Instalasi

1.  **Clone repositori**:
    ```bash
    git clone <repository-url>
    cd velopulse-dashboard
    ```

2.  **Instal dependensi**:
    ```bash
    npm install
    ```

3.  **Konfigurasi environment variable**:
    Buat file `.env` di direktori root, lalu isi dengan konfigurasi berikut:

    ```env
    # Konfigurasi Supabase
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

    # Pengaturan Aplikasi
    MASTER_PASSWORD=admin
    ```

### Panduan Setup

#### 1. Supabase
1.  Buat project baru di [Supabase.com](https://supabase.com/).
2.  Buka **Project Settings** > **API** untuk menemukan URL dan Anon Key.

#### 2. Supabase Auth (login email/password)

Data latihan diamankan per-akun dengan **Supabase Auth**. Setiap baris pada
tabel `workouts` dimiliki oleh satu user (`user_id`), dan seluruh policy RLS
mengacu pada `auth.uid()`.

1.  Buka **Supabase Dashboard > Authentication > Providers > Email**, lalu
    aktifkan provider **Email**. Nyalakan **"Enable Sign ups"** jika ingin
    pengguna bisa mendaftar sendiri dari layar login.
2.  Jalankan file [`supabase/schema.sql`](supabase/schema.sql) di
    **Supabase Dashboard > SQL Editor** (aman dijalankan ulang).
3.  Buka aplikasi → layar **Masuk** akan muncul. Daftar dengan email pertama
    kali, lalu masuk. Data latihan lama (yang dibuat sebelum migrasi auth)
    otomatis di-claim ke akun Anda — tidak perlu backfill manual.
4.  Tombol **"Lanjutkan tanpa akun"** dipakai untuk mode lokal: data tetap di
    perangkat dan disinkronkan setelah Anda masuk.

Catatan: sebelum migrasi ini, tabel `workouts` dibuka untuk role `anon`.
`schema.sql` menghapus policy anon tersebut, jadi tanpa login cloud tidak lagi
bisa dibaca/diubah oleh siapa pun.

### Menjalankan Secara Lokal

Untuk menjalankan development server:

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser untuk melihat hasilnya.

## Akses Administratif

- **Master Password**: Default `admin`, bisa diubah di Settings > System.
- Setelah login pertama, konfigurasi disimpan di `.app-data/config.json`.
- **Keamanan**: Master password di-hash dengan **bcrypt** (salt 10 rounds) sebelum disimpan. Password lama (plaintext) tetap diverifikasi dengan fallback komparasi langsung sampai diubah.
- Environment variable `MASTER_PASSWORD` hanya dipakai sebagai cadangan (`fallback`) jika file `.app-data/config.json` belum ada atau belum memiliki master password.

## Backup & Restore

Settings > System > Backup & Restore menyediakan export/import konfigurasi antar perangkat tanpa perlu memasukkan API key ulang.

### Export

1.  Masukkan master password untuk otorisasi.
2.  Buat **encryption password** untuk mengamankan token.
3.  Token terenkripsi (AES-256-GCM + PBKDF2 600.000 iterasi) akan dihasilkan — salin dan simpan.

### Import

1.  Tempel token dan masukkan **decryption password** yang sama saat export.
2.  Sistem mendekripsi dan memvalidasi hanya field konfigurasi yang dikenal (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MASTER_PASSWORD`).
3.  Halaman akan reload, login dengan master password dari perangkat sebelumnya.
