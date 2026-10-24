import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedClient: vi.fn(),
  hasAuthorizationHeader: vi.fn(),
  saveUserProfile: vi.fn(),
  rpc: vi.fn(),
  errorResponse: vi.fn(),
}));

vi.mock('@/lib/profile-server', () => ({
  getAuthenticatedClient: mocks.getAuthenticatedClient,
  hasAuthorizationHeader: mocks.hasAuthorizationHeader,
  errorResponse: mocks.errorResponse,
}));

vi.mock('@/lib/profile-helper', () => ({
  saveUserProfile: mocks.saveUserProfile,
}));

import { POST } from './route';

const claim = () => POST(new Request('http://localhost/api/profile/claim', {
  method: 'POST',
  headers: { Authorization: 'Bearer token' },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasAuthorizationHeader.mockReturnValue(true);
  mocks.getAuthenticatedClient.mockResolvedValue({
    supabase: { rpc: mocks.rpc },
    userId: 'user-1',
  });
  mocks.saveUserProfile.mockReturnValue(true);
  mocks.errorResponse.mockReturnValue(new Response('error', { status: 500 }));
  mocks.rpc.mockResolvedValue({ data: [], error: null });
});

describe('POST /api/profile/claim', () => {
  it('refuses an unauthenticated request', async () => {
    mocks.hasAuthorizationHeader.mockReturnValue(false);

    const response = await claim();

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('refuses a stale session', async () => {
    mocks.getAuthenticatedClient.mockResolvedValue(null);

    const response = await claim();

    expect(response.status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('reports that there was nothing to claim', async () => {
    const response = await claim();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.claimed).toBe(false);
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
  });

  it('returns and caches the claimed profile in the canonical shape', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ age: 41, max_hr: 177, ftp: 240, weight: 72.5 }],
      error: null,
    });

    const response = await claim();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.claimed).toBe(true);
    expect(body.profile).toEqual({
      age: 41,
      maxHr: 178,
      maxHrSource: 'auto',
      ftp: 240,
      weight: 72.5,
      restingHr: 0,
    });
    expect(mocks.saveUserProfile).toHaveBeenCalledWith(body.profile);
  });

  it('surfaces a database failure as an error response', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });

    const response = await claim();

    expect(response.status).toBe(500);
    expect(mocks.errorResponse).toHaveBeenCalled();
  });
});
