import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig, saveAppConfig, verifyPassword, AppConfig } from '@/lib/config-helper';

// GET: Returns current config (masked)
export async function GET() {
  const config = getAppConfig();
  
  // Mask sensitive values
  const maskedConfig: Partial<AppConfig> = {
    ...config,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: config.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '●●●●●●●●●' : '',
    MASTER_PASSWORD: '●●●●●●●●●'
  };

  return NextResponse.json({ ...maskedConfig, setupRequired: !config.MASTER_PASSWORD });
}

// POST: Saves new config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, ...newConfig } = body;

    const currentConfig = getAppConfig();

    // Setup awal hanya boleh menyimpan password master; konfigurasi sensitif
    // baru bisa diubah setelah password itu dibuat.
    if (!currentConfig.MASTER_PASSWORD) {
      const keys = Object.keys(newConfig);
      if (keys.length !== 1 || keys[0] !== 'MASTER_PASSWORD') {
        return NextResponse.json({ error: 'Set a master password before configuring sensitive settings' }, { status: 428 });
      }
      if (typeof newConfig.MASTER_PASSWORD !== 'string' || newConfig.MASTER_PASSWORD.length < 12) {
        return NextResponse.json({ error: 'Master password must be at least 12 characters' }, { status: 400 });
      }
      const success = saveAppConfig(newConfig);
      return success
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }

    // Verify master password
    if (!password || !verifyPassword(password, currentConfig.MASTER_PASSWORD || '')) {
      return NextResponse.json({ error: 'Invalid master password' }, { status: 401 });
    }

    // Don't overwrite with masked values
    if (newConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY === '●●●●●●●●●') delete newConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (newConfig.MASTER_PASSWORD === '●●●●●●●●●') delete newConfig.MASTER_PASSWORD;

    const success = saveAppConfig(newConfig);

    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: 'Interal server error' }, { status: 500 });
  }
}
