import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config-helper';

/**
 * GET /api/config/public
 * Returns only the non-sensitive, client-safe configuration values.
 * Supabase URL and anon key are intentionally public (they are already
 * exposed in the frontend bundle in standard Supabase setups).
 */
export async function GET() {
  const config = getAppConfig();

  return NextResponse.json({
    NEXT_PUBLIC_SUPABASE_URL: config.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: config.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  });
}
