import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  getAppConfig: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('@/lib/profile-helper', () => ({
  getUserProfile: mocks.getUserProfile,
  saveUserProfile: mocks.saveUserProfile,
}));

vi.mock('@/lib/config-helper', () => ({
  getAppConfig: mocks.getAppConfig,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

import { GET, POST } from './route';

const validProfile = { age: 40, maxHr: 178, ftp: 220, weight: 74, restingHr: 52 };

const realProfile = {
  id: 'profile-1',
  age: 41,
  max_hr: 177,
  ftp: 240,
  weight: 72.5,
  updated_at: '2026-10-01T00:00:00Z',
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request('http://localhost/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as NextRequest);

const get = (headers: Record<string, string> = {}) =>
  GET(new Request('http://localhost/api/profile', { headers }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAppConfig.mockReturnValue({
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  });
  mocks.getUserProfile.mockReturnValue({
    age: 0, maxHr: 190, ftp: 0, weight: 0, restingHr: 0,
  });
  mocks.saveUserProfile.mockReturnValue(true);
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  mocks.single.mockResolvedValue({ data: realProfile, error: null });
  mocks.upsert.mockImplementation(() => ({ select: () => ({ single: mocks.single }) }));
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.createClient.mockReturnValue({
    auth: { getUser: mocks.getUser },
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }), upsert: mocks.upsert }),
    rpc: mocks.rpc,
  });
});

describe('POST /api/profile', () => {
  it('saves a valid profile locally when signed out', async () => {
    const response = await post(validProfile);

    expect(response.status).toBe(200);
    expect(mocks.saveUserProfile).toHaveBeenCalledWith(validProfile);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('accepts the snake_case payload an older client may send', async () => {
    const response = await post({ age: 40, max_hr: 178, ftp: 220, weight: 74 });

    expect(response.status).toBe(200);
    expect(mocks.saveUserProfile).toHaveBeenCalledWith({
      age: 40, maxHr: 178, ftp: 220, weight: 74, restingHr: 0,
    });
  });

  it('rejects an out-of-range profile before touching storage', async () => {
    const response = await post({ ...validProfile, age: 0, weight: -5 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid profile');
    expect(body.fields.sort()).toEqual(['age', 'weight']);
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects a malformed JSON body with 400 instead of a database error', async () => {
    const response = await post('{ not json');

    expect(response.status).toBe(400);
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
  });

  it('rejects an expired session instead of falling back to the local file', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') });

    const response = await post(validProfile, { Authorization: 'Bearer stale' });

    expect(response.status).toBe(401);
    expect(mocks.saveUserProfile).not.toHaveBeenCalled();
  });

  it('writes the cloud row for a signed-in rider', async () => {
    const response = await post({ ...validProfile, maxHr: 190 }, { Authorization: 'Bearer token' });

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', age: 40, ftp: 220, weight: 74 }),
      { onConflict: 'user_id' }
    );
    // max_hr tetap nilai dari klien pada langkah ini; server baru menurunkannya
    // sendiri saat mode Auto diperkenalkan.
    expect(mocks.upsert.mock.calls[0][0].max_hr).toBe(190);
  });
});

describe('GET /api/profile', () => {
  it('returns the device-local profile when signed out', async () => {
    const local = { age: 39, maxHr: 179, ftp: 210, weight: 75, restingHr: 50 };
    mocks.getUserProfile.mockReturnValue(local);

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(local);
  });

  it('rejects a stale token instead of returning the local profile', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') });

    const response = await get({ Authorization: 'Bearer stale' });

    expect(response.status).toBe(401);
  });

  it('normalises the cloud row to the camelCase contract', async () => {
    const response = await get({ Authorization: 'Bearer token' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ age: 41, maxHr: 177, ftp: 240, weight: 72.5, restingHr: 0 });
  });
});
