import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAppConfig: vi.fn(),
  saveAppConfig: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('@/lib/config-helper', () => ({
  getAppConfig: mocks.getAppConfig,
  saveAppConfig: mocks.saveAppConfig,
  verifyPassword: mocks.verifyPassword,
}));

import { POST } from './route';

const sendConfig = (body: Record<string, unknown>) => POST(new Request('http://localhost/api/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
}) as never);

describe('POST /api/config master password setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppConfig.mockReturnValue({});
    mocks.saveAppConfig.mockReturnValue(true);
    mocks.verifyPassword.mockReturnValue(true);
  });

  it('creates the initial master password without accepting other settings', async () => {
    const response = await sendConfig({ MASTER_PASSWORD: 'a-strong-password' });

    expect(response.status).toBe(200);
    expect(mocks.saveAppConfig).toHaveBeenCalledWith({ MASTER_PASSWORD: 'a-strong-password' });
  });

  it('rejects setup passwords shorter than 12 characters', async () => {
    const response = await sendConfig({ MASTER_PASSWORD: 'short' });

    expect(response.status).toBe(400);
    expect(mocks.saveAppConfig).not.toHaveBeenCalled();
  });

  it('does not allow sensitive configuration before the initial password is set', async () => {
    const response = await sendConfig({
      MASTER_PASSWORD: 'a-strong-password',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sensitive-key',
    });

    expect(response.status).toBe(428);
    expect(mocks.saveAppConfig).not.toHaveBeenCalled();
  });

  it('continues to require the existing password for an older configured installation', async () => {
    mocks.getAppConfig.mockReturnValue({ MASTER_PASSWORD: 'legacy-plaintext' });
    mocks.verifyPassword.mockReturnValue(false);

    const response = await sendConfig({ password: 'wrong-password', MASTER_PASSWORD: 'replacement-password' });

    expect(response.status).toBe(401);
    expect(mocks.saveAppConfig).not.toHaveBeenCalled();
  });

  it('accepts a valid password from an older configured installation', async () => {
    mocks.getAppConfig.mockReturnValue({ MASTER_PASSWORD: 'legacy-plaintext' });

    const response = await sendConfig({ password: 'legacy-plaintext', NEXT_PUBLIC_SUPABASE_URL: 'https://my-project.supabase.co' });

    expect(response.status).toBe(200);
    expect(mocks.verifyPassword).toHaveBeenCalledWith('legacy-plaintext', 'legacy-plaintext');
    expect(mocks.saveAppConfig).toHaveBeenCalledWith({ NEXT_PUBLIC_SUPABASE_URL: 'https://my-project.supabase.co' });
  });
});
