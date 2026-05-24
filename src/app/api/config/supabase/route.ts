import { NextResponse } from 'next/server';
import { getAppConfig } from '@/lib/config-helper';

export async function GET() {
  const config = getAppConfig();
  
  // Only expose client-safe Supabase credentials
  return NextResponse.json({
    url: config.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: config.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  });
}
