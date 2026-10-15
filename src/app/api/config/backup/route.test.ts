import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAppConfig: vi.fn(),
  verifyPassword: vi.fn(),
  saveAppConfig: vi.fn(),
  decrypt: vi.fn(),
}));

vi.mock('@/lib/config-helper', () => ({
  getAppConfig: mocks.getAppConfig,
  verifyPassword: mocks.verifyPassword,
  saveAppConfig: mocks.saveAppConfig,
}));

vi.mock('@/lib/crypto', () => ({
  encrypt: vi.fn(),
  decrypt: mocks.decrypt,
}));

import { POST } from './route';

const sendImport = (body: Record<string, unknown>) => POST(new Request('http://localhost/api/config/backup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'import', token: 'backup-token', decryptionPassword: 'backup-secret', ...body }),
}) as NextRequest);

describe('POST /api/config/backup import authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppConfig.mockReturnValue({ MASTER_PASSWORD: 'stored-hash' });
    mocks.verifyPassword.mockImplementation((password: string, stored: string) => password === 'correct-device-password' && stored === 'stored-hash');
    mocks.decrypt.mockReturnValue(JSON.stringify({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    }));
    mocks.saveAppConfig.mockReturnValue(true);
  });

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
