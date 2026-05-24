import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config-helper';

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Password dikirim sebagai Authorization header (Bearer token), bukan body,
// sehingga tidak ikut ter-log di request logger atau body parser.
function verifyMasterPassword(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const config = getAppConfig();
  return !!token && token === config.MASTER_PASSWORD;
}

export async function POST(req: Request) {
  // Auth check dilakukan sebelum body di-parse.
  if (!verifyMasterPassword(req)) {
    return NextResponse.json({ valid: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type } = body;

    // ─── Google ───────────────────────────────────────────────────────────────
    if (type === 'google') {
      const { clientId, clientSecret } = body;
      if (!clientId || !clientSecret) {
        return NextResponse.json({ valid: false, error: 'Client ID & Secret harus diisi.' }, { status: 400 });
      }

      // Jika secret masih masked → credential sudah pernah disimpan → anggap valid.
      // Tidak perlu fetch ulang; ini juga mencegah attacker menguji clientId orang lain
      // dengan masked secret milik kita.
      if (clientSecret === '●●●●●●●●●') {
        return NextResponse.json({ valid: true });
      }

      let googleData: any;
      try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code: 'dummy_code'
          })
        });
        googleData = await res.json();
      } catch {
        return NextResponse.json({
          valid: false,
          error: 'Tidak bisa menghubungi server Google. Periksa koneksi internet.'
        });
      }

      // "invalid_client"  → credentials salah
      // "invalid_grant"   → Google kenali client, dummy code ditolak → credentials OK
      // error lain        → tak terduga, tampilkan ke user
      if (googleData.error === 'invalid_client') {
        return NextResponse.json({ valid: false, error: 'Client ID atau Secret Google tidak valid.' });
      }
      if (googleData.error && googleData.error !== 'invalid_grant') {
        return NextResponse.json({
          valid: false,
          error: `Respon tidak diketahui dari Google: ${googleData.error}`
        });
      }

      return NextResponse.json({ valid: true });
    }

    // ─── Supabase ─────────────────────────────────────────────────────────────
    if (type === 'supabase') {
      const { url, key } = body;
      if (!url || !key) {
        return NextResponse.json({ valid: false, error: 'Supabase URL & Key harus diisi.' }, { status: 400 });
      }

      // Jika key masih masked → credential sudah pernah disimpan → anggap valid.
      if (key === '●●●●●●●●●') {
        return NextResponse.json({ valid: true });
      }

      // SSRF guard: hanya izinkan HTTPS
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return NextResponse.json({ valid: false, error: 'URL Supabase tidak valid.' }, { status: 400 });
      }
      if (parsedUrl.protocol !== 'https:') {
        return NextResponse.json({
          valid: false,
          error: 'URL Supabase harus menggunakan HTTPS.'
        }, { status: 400 });
      }

      // Connectivity check via Supabase REST base endpoint — tidak bergantung nama tabel.
      // GET /rest/v1/ → 200 (schema JSON) jika valid, 401/403 jika key salah.
      try {
        const healthUrl = `${url.replace(/\/$/, '')}/rest/v1/`;
        const healthRes = await fetch(healthUrl, {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
          }
        });

        if (healthRes.status === 401 || healthRes.status === 403) {
          return NextResponse.json({
            valid: false,
            error: 'Supabase Anon Key tidak valid atau tidak punya akses.'
          });
        }
        if (!healthRes.ok && healthRes.status !== 404) {
          return NextResponse.json({
            valid: false,
            error: `Gagal terhubung ke Supabase (HTTP ${healthRes.status}).`
          });
        }

        return NextResponse.json({ valid: true });
      } catch (err: any) {
        return NextResponse.json({ valid: false, error: err?.message || 'Error saat validasi Supabase.' });
      }
    }

    return NextResponse.json({ valid: false, error: 'Tipe tidak diketahui.' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ valid: false, error: err.message }, { status: 500 });
  }
}
