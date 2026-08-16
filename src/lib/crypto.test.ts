import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './crypto';

describe('Cryptography Utils', () => {
  const secretConfig = JSON.stringify({
    NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key-abc',
    MASTER_PASSWORD: 'super-secure-password'
  });

  const password = 'my-backup-password';

  it('successfully encrypts and decrypts a config payload', () => {
    const token = encrypt(secretConfig, password);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(50); // Should be a solid Base64 string

    const decrypted = decrypt(token, password);
    expect(decrypted).toBe(secretConfig);
    
    const parsed = JSON.parse(decrypted);
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe('https://project.supabase.co');
    expect(parsed.MASTER_PASSWORD).toBe('super-secure-password');
  });

  it('fails to decrypt if the password is incorrect', () => {
    const token = encrypt(secretConfig, password);
    
    expect(() => {
      decrypt(token, 'wrong-password');
    }).toThrow('Failed to decrypt token');
  });

  it('fails to decrypt if the token is corrupted or tampered with', () => {
    const token = encrypt(secretConfig, password);
    
    // Corrupt the base64 string slightly
    const corruptedToken = token.substring(0, token.length - 4) + 'AAAA';
    
    expect(() => {
      decrypt(corruptedToken, password);
    }).toThrow('Failed to decrypt token');
  });

  it('fails to decrypt if the token is completely invalid', () => {
    expect(() => {
      decrypt('completely-invalid-base64-string', password);
    }).toThrow();
  });
});
