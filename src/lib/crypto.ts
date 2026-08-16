import crypto from 'crypto';

const ITERATIONS = 600000;
const KEY_LEN = 32; // 256 bits for AES-256
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a string payload with a password/secret key using AES-256-GCM.
 * The output is a base64 encoded token containing the salt, IV, auth tag, and ciphertext.
 */
export function encrypt(text: string, secret: string): string {
  const salt = crypto.randomBytes(16);
  // Derive a 256-bit key from the password
  const key = crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LEN, 'sha256');
  const iv = crypto.randomBytes(12); // GCM standard IV size is 12 bytes
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  const backupData = {
    s: salt.toString('hex'),
    i: iv.toString('hex'),
    t: tag,
    c: encrypted
  };

  return Buffer.from(JSON.stringify(backupData)).toString('base64');
}

/**
 * Decrypts a base64 configuration backup token using the provided password/secret key.
 * Throws an error if decryption fails or authentication is invalid.
 */
export function decrypt(token: string, secret: string): string {
  try {
    const rawJson = Buffer.from(token, 'base64').toString('utf8');
    const { s, i, t, c } = JSON.parse(rawJson);
    
    if (!s || !i || !t || !c) {
      throw new Error('Invalid token structure');
    }

    const salt = Buffer.from(s, 'hex');
    const iv = Buffer.from(i, 'hex');
    const tag = Buffer.from(t, 'hex');
    
    // Derive key using same parameters
    const key = crypto.pbkdf2Sync(secret, salt, ITERATIONS, KEY_LEN, 'sha256');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(c, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch {
    throw new Error('Failed to decrypt token. Please check password and token.');
  }
}
