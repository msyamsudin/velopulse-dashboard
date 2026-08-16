import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig, saveAppConfig, verifyPassword, AppConfig } from '@/lib/config-helper';
import { encrypt, decrypt } from '@/lib/crypto';

const CONFIG_KEYS: (keyof AppConfig)[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'MASTER_PASSWORD'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const currentConfig = getAppConfig();

    if (action === 'export') {
      const { password, encryptionPassword } = body;
      
      // Verify master password
      if (!password || !verifyPassword(password, currentConfig.MASTER_PASSWORD || '')) {
        return NextResponse.json({ error: 'Invalid master password' }, { status: 401 });
      }

      if (!encryptionPassword) {
        return NextResponse.json({ error: 'Encryption password is required' }, { status: 400 });
      }

      // Include all keys including master password in the backup token
      const configStr = JSON.stringify(currentConfig);
      const token = encrypt(configStr, encryptionPassword);
      return NextResponse.json({ token });
    }

    if (action === 'import') {
      const { token, decryptionPassword } = body;

      if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 });
      }
      if (!decryptionPassword) {
        return NextResponse.json({ error: 'Decryption password is required' }, { status: 400 });
      }

      try {
        const decryptedStr = decrypt(token, decryptionPassword);
        const importedConfig = JSON.parse(decryptedStr);

        if (typeof importedConfig !== 'object' || importedConfig === null) {
          throw new Error('Invalid configuration format decrypted');
        }

        // Strip unknown keys to prevent injection
        const sanitized: Partial<AppConfig> = {};
        for (const key of CONFIG_KEYS) {
          if (key in importedConfig) {
            sanitized[key] = importedConfig[key];
          }
        }

        // Save configuration to disk
        const success = saveAppConfig(sanitized);
        if (success) {
          return NextResponse.json({ success: true });
        } else {
          return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
        }
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Decryption failed' }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('[Backup API] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
