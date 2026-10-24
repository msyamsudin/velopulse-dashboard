import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedClient: vi.fn(),
  rpc: vi.fn(),
  errorResponse: vi.fn(),
}));

vi.mock('@/lib/profile-server', () => ({
  getAuthenticatedClient: mocks.getAuthenticatedClient,
  errorResponse: mocks.errorResponse,
}));

import { GET } from './route';

const ask = () => GET(new Request('http://localhost/api/profile/orphan', {
  headers: { Authorization: 'Bearer token' },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAuthenticatedClient.mockResolvedValue({
    supabase: { rpc: mocks.rpc },
    userId: 'user-1',
  });
  mocks.errorResponse.mockReturnValue(new Response('error', { status: 500 }));
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});

describe('GET /api/profile/orphan', () => {
  it('reports availability for a signed-in rider', async () => {
    const response = await ask();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ available: true });
  });

  it('reports absence explicitly', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    const response = await ask();

    expect((await response.json()).available).toBe(false);
  });

  it('refuses a request without a valid session', async () => {
    mocks.getAuthenticatedClient.mockResolvedValue(null);

    const response = await ask();

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('answers with an error when the function is missing', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });

    const response = await ask();

    expect(response.status).toBe(500);
  });
});
