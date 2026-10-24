import { NextRequest, NextResponse } from 'next/server';
import { getAppConfig, saveAppConfig, verifyPassword, AppConfig } from '@/lib/config-helper';
import { encrypt, decrypt } from '@/lib/crypto';
import { sanitizeBodyHistory } from '@/lib/body-history';
import { getUserProfile, saveUserProfile } from '@/lib/profile-helper';
import {
  hasProfileErrors,
  normalizeProfile,
  validateProfile,
  withResolvedMaxHr,
  type UserProfile,
} from '@/lib/profile';

const CONFIG_KEYS: (keyof AppConfig)[] = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'MASTER_PASSWORD'
];

/**
 * Versi 1 adalah objek konfigurasi datar. Versi 2 membungkusnya bersama profil
 * dan riwayat tubuh, karena "export configuration … to set up other devices
 * quickly" sebelumnya tidak membawa profil sama sekali: pengguna tanpa akun
 * kehilangan usia, FTP, berat, dan riwayatnya saat pindah perangkat.
 */
const BACKUP_VERSION = 2;

interface BackupEnvelope {
  version: number;
  config: unknown;
  profile?: unknown;
  bodyHistory?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const currentConfig = getAppConfig();

    if (action === 'export') {
      const { password, encryptionPassword, bodyHistory } = body;

      // Verify master password
      if (!password || !verifyPassword(password, currentConfig.MASTER_PASSWORD || '')) {
        return NextResponse.json({ error: 'Invalid master password' }, { status: 401 });
      }

      if (!encryptionPassword) {
        return NextResponse.json({ error: 'Encryption password is required' }, { status: 400 });
      }

      // Include all keys including master password in the backup token. Riwayat
      // tubuh datang dari klien karena hanya hidup di localStorage perangkat ini.
      const payload: BackupEnvelope = {
        version: BACKUP_VERSION,
        config: currentConfig,
        profile: getUserProfile(),
        bodyHistory: sanitizeBodyHistory(bodyHistory),
      };
      const token = encrypt(JSON.stringify(payload), encryptionPassword);
      return NextResponse.json({ token });
    }

    if (action === 'import') {
      const { token, decryptionPassword, masterPassword } = body;

      // Autentikasi perangkat dilakukan sebelum backup didekripsi atau disimpan.
      if (!masterPassword || !verifyPassword(masterPassword, currentConfig.MASTER_PASSWORD || '')) {
        return NextResponse.json({ error: 'Invalid master password' }, { status: 401 });
      }

      if (!token) {
        return NextResponse.json({ error: 'Token is required' }, { status: 400 });
      }
      if (!decryptionPassword) {
        return NextResponse.json({ error: 'Decryption password is required' }, { status: 400 });
      }

      try {
        const decryptedStr = decrypt(token, decryptionPassword);
        const imported = JSON.parse(decryptedStr);

        if (!isRecord(imported)) {
          throw new Error('Invalid configuration format decrypted');
        }

        const isEnvelope = imported.version !== undefined && 'config' in imported;
        const configSource = isEnvelope ? imported.config : imported;
        if (!isRecord(configSource)) {
          throw new Error('Invalid configuration format decrypted');
        }

        // Strip unknown keys to prevent injection
        const sanitized: Partial<AppConfig> = {};
        for (const key of CONFIG_KEYS) {
          if (key in configSource) {
            sanitized[key] = configSource[key] as AppConfig[typeof key];
          }
        }

        // Save configuration to disk
        const success = saveAppConfig(sanitized);
        if (!success) {
          return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
        }

        // Profil hanya dipulihkan dari token versi 2 dan hanya bila lolos
        // validasi yang sama dengan penyimpanan biasa; token rusak tidak boleh
        // menimpa profil yang sedang dipakai.
        let profile: UserProfile | null = null;
        if (isEnvelope && imported.profile !== undefined) {
          const candidate = withResolvedMaxHr(normalizeProfile(imported.profile));
          if (!hasProfileErrors(validateProfile(candidate))) {
            saveUserProfile(candidate);
            profile = candidate;
          }
        }

        const bodyHistory = isEnvelope ? sanitizeBodyHistory(imported.bodyHistory) : [];

        return NextResponse.json({
          success: true,
          ...(profile ? { profile } : {}),
          ...(bodyHistory.length > 0 ? { bodyHistory } : {}),
        });
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
