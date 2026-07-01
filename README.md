# VeloPulse Dashboard

VeloPulse adalah dashboard fitness untuk memvisualisasikan data saat latihan.

## Mulai

### Prasyarat

- **Node.js** (disarankan versi LTS terbaru)
- **Akun Google Cloud** (untuk Google Fit API)
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
    # Kredensial OAuth Google Fit
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret

    # Konfigurasi Supabase
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

    # Pengaturan Aplikasi
    APP_URL=http://localhost:3000
    MASTER_PASSWORD=admin
    ```

### Panduan Setup

#### 1. Google Fit API
1.  Buka [Google Cloud Console](https://console.cloud.google.com/).
2.  Buat project baru.
3.  Aktifkan **Fitness API**.
4.  Konfigurasi OAuth Consent Screen (Internal atau External).
5.  Buat **OAuth 2.0 Client IDs** dengan tipe Web Application.
6.  Tambahkan `http://localhost:3000/api/auth/callback` ke **Authorized redirect URIs**.

#### 2. Supabase
1.  Buat project baru di [Supabase.com](https://supabase.com/).
2.  Buka **Project Settings** > **API** untuk menemukan URL dan Anon Key.

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
2.  Sistem mendekripsi dan memvalidasi hanya field konfigurasi yang dikenal (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `APP_URL`, `MASTER_PASSWORD`).
3.  Halaman akan reload, login dengan master password dari perangkat sebelumnya.
