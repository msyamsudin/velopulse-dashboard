import { NextResponse } from 'next/server';
import { getAppConfig, verifyPassword } from '@/lib/config-helper';

const SUPABASE_FETCH_TIMEOUT_MS = 10_000;
const SUPABASE_HOST_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.supabase\.co$/;

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Password dikirim sebagai Authorization header (Bearer token), bukan body,
// sehingga tidak ikut ter-log di request logger atau body parser.
function verifyMasterPassword(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const config = getAppConfig();
  return !!token && verifyPassword(token, config.MASTER_PASSWORD || '');
}

export async function POST(req: Request) {
  // Auth check dilakukan sebelum body di-parse.
  if (!verifyMasterPassword(req)) {
    return NextResponse.json({ valid: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { type } = body;

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

      // SSRF guard: hanya izinkan URL origin project Supabase resmi.
      let parsedUrl: URL;
      try {
        if (typeof url !== 'string') throw new TypeError('URL harus berupa teks.');
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
      if (
        !SUPABASE_HOST_PATTERN.test(parsedUrl.hostname) ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.port ||
        parsedUrl.pathname !== '/' ||
        parsedUrl.search ||
        parsedUrl.hash
      ) {
        return NextResponse.json({ valid: false, error: 'URL harus berupa domain project Supabase yang valid.' }, { status: 400 });
      }

      // Connectivity check via Supabase REST base endpoint — tidak bergantung nama tabel.
      // GET /rest/v1/ → 200 (schema JSON) jika valid, 401/403 jika key salah.
      try {
        const healthUrl = `${parsedUrl.origin}/rest/v1/`;
        const healthRes = await fetch(healthUrl, {
          signal: AbortSignal.timeout(SUPABASE_FETCH_TIMEOUT_MS),
          redirect: 'error',
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
      } catch (err) {
        return NextResponse.json({ valid: false, error: err instanceof Error ? err.message : 'Error saat validasi Supabase.' });
      }
    }
    if (type === 'master') {
      return NextResponse.json({ valid: true });
    }

    return NextResponse.json({ valid: false, error: 'Tipe tidak diketahui.' }, { status: 400 });

  } catch (err) {
    return NextResponse.json({ valid: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
