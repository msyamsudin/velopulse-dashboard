import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig, saveAppConfig, AppConfig } from '@/lib/config-helper';

// GET: Returns current config (masked)
export async function GET() {
  const config = getAppConfig();
  
  // Mask sensitive values
  const maskedConfig: Partial<AppConfig> = {
    ...config,
    GOOGLE_CLIENT_SECRET: config.GOOGLE_CLIENT_SECRET ? '●●●●●●●●●' : '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: config.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '●●●●●●●●●' : '',
    MASTER_PASSWORD: '●●●●●●●●●'
  };

  return NextResponse.json(maskedConfig);
}

// POST: Saves new config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, ...newConfig } = body;

    const currentConfig = getAppConfig();

    // Simple password check (Master password)
    // For local dev, we check against the config's master password
    if (password !== currentConfig.MASTER_PASSWORD) {
      return NextResponse.json({ error: 'Invalid master password' }, { status: 401 });
    }

    // Don't overwrite with masked values
    if (newConfig.GOOGLE_CLIENT_SECRET === '●●●●●●●●●') delete newConfig.GOOGLE_CLIENT_SECRET;
    if (newConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY === '●●●●●●●●●') delete newConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (newConfig.MASTER_PASSWORD === '●●●●●●●●●') delete newConfig.MASTER_PASSWORD;

    const success = saveAppConfig(newConfig);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Interal server error' }, { status: 500 });
  }
}
