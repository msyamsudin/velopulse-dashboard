import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAppConfig: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('@/lib/config-helper', () => ({
  getAppConfig: mocks.getAppConfig,
  verifyPassword: mocks.verifyPassword,
}));

import { POST } from './route';

const sendValidation = (url: unknown) => POST(new Request('http://localhost/api/config/validate', {
  method: 'POST',
  headers: { Authorization: 'Bearer correct-password', 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'supabase', url, key: 'anon-key' }),
}));

describe('POST /api/config/validate Supabase URL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAppConfig.mockReturnValue({ MASTER_PASSWORD: 'stored-hash' });
    mocks.verifyPassword.mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
  });

  it('validates a project URL and applies a timeout without following redirects', async () => {
    const response = await sendValidation('https://my-project.supabase.co/');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ valid: true });
    expect(fetch).toHaveBeenCalledWith('https://my-project.supabase.co/rest/v1/', expect.objectContaining({
      redirect: 'error',
      signal: expect.any(AbortSignal),
    }));
  });

  it.each([
    'http://my-project.supabase.co',
    'https://localhost',
    'https://supabase.co',
    'https://my-project.supabase.co.evil.example',
    'https://my-project.supabase.co@evil.example',
    'https://user:pass@my-project.supabase.co',
    'https://my-project.supabase.co:8443',
    'https://my-project.supabase.co/rest/v1',
    'https://my-project.supabase.co/?target=evil',
  ])('rejects unsupported URL %s before making a request', async url => {
    const response = await sendValidation(url);

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects non-string URLs before making a request', async () => {
    const response = await sendValidation({ toString: () => 'https://my-project.supabase.co' });

    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not authorize requests when no master password is configured', async () => {
    mocks.getAppConfig.mockReturnValue({});
    mocks.verifyPassword.mockReturnValue(false);

    const response = await sendValidation('https://my-project.supabase.co/');

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});
