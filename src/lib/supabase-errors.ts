export type SupabaseErrorKind = 'paused' | 'network' | 'auth' | 'config' | 'empty' | 'other';

export type SupabaseErrorCode =
  | 'SUPABASE_PAUSED'
  | 'NETWORK_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'NOT_CONFIGURED'
  | 'NO_ROWS'
  | 'UNKNOWN';

export interface SupabaseErrorInfo {
  code: SupabaseErrorCode;
  kind: SupabaseErrorKind;
  message: string;
  userMessage: string;
  retryable: boolean;
}

const PAUSED_PATTERNS = [
  /\bpaus/i,
  /PROJECT_IS_PAUSED/i,
  /instance is paused/i,
];

const NETWORK_PATTERNS = [
  /fetch failed/i,
  /failed to fetch/i,
  /networkerror/i,
  /network error/i,
  /econnrefused/i,
  /econnreset/i,
  /etimedout/i,
  /eai_again/i,
  /enotfound/i,
  /epipe/i,
  /und_err/i,
  /socket hang up/i,
  /connection (reset|refused|closed|terminated|lost)/i,
  /unable to connect/i,
];

const AUTH_PATTERNS = [
  /invalid api key/i,
  /invalid jwt/i,
  /\bjwt/i,
  /unauthorized/i,
  /permission denied/i,
  /apikey invalid/i,
];

const CONFIG_PATTERNS = [
  /supabase is not configured/i,
  /missing environment/i,
];

interface RawErrorInfo {
  text: string;
  code?: string;
  status?: number;
}

function collectErrorInfo(err: unknown): RawErrorInfo {
  const candidates: string[] = [];
  const push = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
  };

  let current: unknown = err;
  const seen = new Set<unknown>();

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    push(record.message);
    push(record.error_description);
    push(record.details);
    push(record.hint);
    if (typeof record.code === 'string' || typeof record.code === 'number') {
      candidates.push(`code:${record.code}`);
    }
    if (typeof record.status === 'number') {
      candidates.push(`status:${record.status}`);
    }
    current = record.cause;
  }

  const text = candidates.join(' | ');
  const codeMatch = candidates.find(c => c.startsWith('code:'));
  const statusMatch = candidates.find(c => c.startsWith('status:'));

  return {
    text,
    code: codeMatch ? codeMatch.slice('code:'.length) : undefined,
    status: statusMatch ? Number(statusMatch.slice('status:'.length)) : undefined,
  };
}

/**
 * Classifies a Supabase / network error into a stable machine-readable code plus
 * a human-friendly message. Isomorphic: works on both server (Next.js route) and
 * browser (client-side Supabase calls).
 */
export function classifySupabaseError(err: unknown): SupabaseErrorInfo {
  const { text, code, status } = collectErrorInfo(err);
  const combined = `${text} ${code ?? ''} ${status ?? ''}`;
  const message =
    text ||
    (err instanceof Error ? err.message : '') ||
    (typeof err === 'string' ? err : '') ||
    'Unknown Supabase error';

  if (status === 503 || code === '503' || PAUSED_PATTERNS.some(p => p.test(combined))) {
    return {
      code: 'SUPABASE_PAUSED',
      kind: 'paused',
      message,
      userMessage:
        'The Supabase database is paused. Resume it in the Supabase Dashboard, then retry.',
      retryable: true,
    };
  }

  if (code === 'PGRST116') {
    return {
      code: 'NO_ROWS',
      kind: 'empty',
      message,
      userMessage: 'No rows found.',
      retryable: false,
    };
  }

  if (status === 401 || status === 403 || code === '401' || code === '403' || AUTH_PATTERNS.some(p => p.test(combined))) {
    return {
      code: 'INVALID_CREDENTIALS',
      kind: 'auth',
      message,
      userMessage: 'The Supabase URL or anon key is invalid. Check it in Settings.',
      retryable: true,
    };
  }

  if (CONFIG_PATTERNS.some(p => p.test(combined))) {
    return {
      code: 'NOT_CONFIGURED',
      kind: 'config',
      message,
      userMessage: 'Supabase is not configured. Set the URL and anon key in Settings.',
      retryable: true,
    };
  }

  if (NETWORK_PATTERNS.some(p => p.test(combined))) {
    return {
      code: 'NETWORK_ERROR',
      kind: 'network',
      message,
      userMessage:
        'Could not reach the Supabase database. Check your internet connection, or the database may be paused.',
      retryable: true,
    };
  }

  return {
    code: 'UNKNOWN',
    kind: 'other',
    message,
    userMessage: 'Unexpected error contacting the cloud database. Try again in a moment.',
    retryable: true,
  };
}
