import { describe, expect, it } from 'vitest';
import { classifySupabaseError } from './supabase-errors';

describe('classifySupabaseError', () => {
  it('detects a paused Supabase project from a PostgREST 503 payload', () => {
    const info = classifySupabaseError({
      message: "The project's instance is paused. Please unpause it to continue.",
      code: '503',
    });
    expect(info.code).toBe('SUPABASE_PAUSED');
    expect(info.kind).toBe('paused');
    expect(info.retryable).toBe(true);
    expect(info.userMessage).toContain('paused');
  });

  it('detects a paused project from the PROJECT_IS_PAUSED code', () => {
    const info = classifySupabaseError({ message: 'Project is paused', code: 'PROJECT_IS_PAUSED' });
    expect(info.code).toBe('SUPABASE_PAUSED');
  });

  it('detects a Node fetch failure with a nested network cause', () => {
    const err = new Error('fetch failed', { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) });
    const info = classifySupabaseError(err);
    expect(info.code).toBe('NETWORK_ERROR');
    expect(info.kind).toBe('network');
    expect(info.retryable).toBe(true);
  });

  it('detects a browser "Failed to fetch" network error', () => {
    const info = classifySupabaseError(new TypeError('Failed to fetch'));
    expect(info.code).toBe('NETWORK_ERROR');
  });

  it('detects invalid API key / JWT errors', () => {
    const info = classifySupabaseError({ message: 'Invalid API key', code: '401' });
    expect(info.code).toBe('INVALID_CREDENTIALS');
    expect(info.kind).toBe('auth');
  });

  it('treats missing rows as a non-retryable empty result', () => {
    const info = classifySupabaseError({ message: 'No rows found', code: 'PGRST116' });
    expect(info.code).toBe('NO_ROWS');
    expect(info.retryable).toBe(false);
  });

  it('falls back to UNKNOWN for unrecognized errors', () => {
    const info = classifySupabaseError({ message: 'Something else went wrong' });
    expect(info.code).toBe('UNKNOWN');
    expect(info.retryable).toBe(true);
  });
});
