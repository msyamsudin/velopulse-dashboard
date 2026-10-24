import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAppConfig: vi.fn(),
  verifyPassword: vi.fn(),
  saveAppConfig: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
}));

vi.mock('@/lib/config-helper', () => ({
  getAppConfig: mocks.getAppConfig,
  verifyPassword: mocks.verifyPassword,
  saveAppConfig: mocks.saveAppConfig,
}));

vi.mock('@/lib/crypto', () => ({
  encrypt: mocks.encrypt,
  decrypt: mocks.decrypt,
}));

vi.mock('@/lib/profile-helper', () => ({
  getUserProfile: mocks.getUserProfile,
  saveUserProfile: mocks.saveUserProfile,
}));

import { POST } from './route';

const deviceProfile = {
  age: 40, maxHr: 178, maxHrSource: 'auto', ftp: 220, weight: 74, restingHr: 52,
};

const send = (body: Record<string, unknown>) => POST(new Request('http://localhost/api/config/backup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}) as NextRequest);

const sendImport = (body: Record<string, unknown>) =>
  send({ action: 'import', token: 'backup-token', decryptionPassword: 'backup-secret', ...body });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAppConfig.mockReturnValue({ MASTER_PASSWORD: 'stored-hash' });
  mocks.verifyPassword.mockImplementation(
    (password: string, stored: string) => password === 'correct-device-password' && stored === 'stored-hash'
  );
  mocks.decrypt.mockReturnValue(JSON.stringify({
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  }));
  mocks.saveAppConfig.mockReturnValue(true);
  mocks.encrypt.mockReturnValue('new-token');
  mocks.getUserProfile.mockReturnValue(deviceProfile);
  mocks.saveUserProfile.mockReturnValue(true);
});

describe('POST /api/config/backup import authorization', () => {
  it('rejects an import without the device master password before decrypting or saving', async () => {
    const response = await sendImport({});

    expect(response.status).toBe(401);
    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(mocks.saveAppConfig).not.toHaveBeenCalled();
  });

  it('rejects an import with an incorrect device master password before decrypting or saving', async () => {
    const response = await sendImport({ masterPassword: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(mocks.decrypt).not.toHaveBeenCalled();
    expect(mocks.saveAppConfig).not.toHaveBeenCalled();
  });

  it('saves the decrypted configuration after verifying the device master password', async () => {
    const response = await sendImport({ masterPassword: 'correct-device-password' });

    expect(response.status).toBe(200);
    expect(mocks.decrypt).toHaveBeenCalledWith('backup-token', 'backup-secret');
    expect(mocks.saveAppConfig).toHaveBeenCalledWith({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});

describe('POST /api/config/backup version 2 payload', () => {
  it('exports configuration, profile and body history together', async () => {
    let exported = '';
    mocks.encrypt.mockImplementation((text: string) => {
      exported = text;
      return 'new-token';
    });

    const response = await send({
      action: 'export',
      password: 'correct-device-password',
      encryptionPassword: 'backup-secret',
      bodyHistory: [
        { date: '2026-10-02', weight: 74.5, restingHr: 50 },
        { date: 'not-a-date', weight: 80 },
      ],
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toBe('new-token');

    const payload = JSON.parse(exported);
    expect(payload.version).toBe(2);
    expect(payload.config).toEqual({ MASTER_PASSWORD: 'stored-hash' });
    expect(payload.profile).toEqual(deviceProfile);
    // Entri tanpa tanggal sah tidak ikut terbawa.
    expect(payload.bodyHistory).toEqual([{ date: '2026-10-02', weight: 74.5, restingHr: 50 }]);
  });

  it('restores the profile and body history from a version 2 token', async () => {
    mocks.decrypt.mockReturnValue(JSON.stringify({
      version: 2,
      config: { NEXT_PUBLIC_SUPABASE_URL: 'https://restored.supabase.co' },
      profile: { age: 41, max_hr: 177, max_hr_source: 'manual', ftp: 240, weight: 72.5 },
      bodyHistory: [{ date: '2026-10-01', weight: 73.5 }],
    }));

    const response = await sendImport({ masterPassword: 'correct-device-password' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile).toEqual({
      age: 41,
      maxHr: 177,
      maxHrSource: 'manual',
      ftp: 240,
      weight: 72.5,
      restingHr: 0,
    });
    expect(body.bodyHistory).toEqual([{ date: '2026-10-01', weight: 73.5 }]);
    expect(mocks.saveUserProfile).toHaveBeenCalledWith(body.profile);
    expect(mocks.saveAppConfig).toHaveBeenCalledWith({
      NEXT_PUBLIC_SUPABASE_URL: 'https://restored.supabase.co',
    });
  });

  it('does not let a corrupt profile inside the token overwrite the current one', async () => {
    mocks.decrypt.mockReturnValue(JSON.stringify({
      version: 2,
      config: { NEXT_PUBLIC_SUPABASE_URL: 'https://restored.supabase.co' },
      profile: { age: 0, ftp: 220, weight: 74 },
    }));

    const response = await sendImport({ masterPassword: 'correct-device-password' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile).toBeUndefined();
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
    // Konfigurasi tetap dipulihkan walau profilnya ditolak.
    expect(mocks.saveAppConfig).toHaveBeenCalled();
  });

  it('still accepts a version 1 flat configuration token', async () => {
    const response = await sendImport({ masterPassword: 'correct-device-password' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
  });
});
