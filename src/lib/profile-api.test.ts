import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProfileApi } from './profile-api';

const { getSupabaseClient } = vi.hoisted(() => ({ getSupabaseClient: vi.fn() }));
vi.mock('./supabase', () => ({ getSupabaseClient }));

describe('fetchProfileApi', () => {
  afterEach(() => vi.restoreAllMocks());

  it('forwards the active Supabase session token', async () => {
    getSupabaseClient.mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'session-token' } } }) },
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    await fetchProfileApi('/api/profile', { method: 'POST' });

    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer session-token');
  });

  it('leaves the request unauthenticated for local-only use', async () => {
    getSupabaseClient.mockResolvedValue(null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));

    await fetchProfileApi('/api/profile');

    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
  });
});
