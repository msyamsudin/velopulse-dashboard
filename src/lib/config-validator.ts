export interface ValidationResult {
  valid: boolean;
  msg: string;
}

export const validateGoogleConfig = async (password: string, clientId?: string, clientSecret?: string): Promise<ValidationResult> => {
  try {
    const res = await fetch('/api/config/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${password}`
      },
      body: JSON.stringify({
        type: 'google',
        clientId,
        clientSecret
      })
    });
    const data = await res.json();
    return { valid: data.valid, msg: data.error || 'Google Config Valid!' };
  } catch (err: any) {
    return { valid: false, msg: err.message || 'Error validating Google config.' };
  }
};

export const validateSupabaseConfig = async (password: string, url?: string, key?: string): Promise<ValidationResult> => {
  try {
    const res = await fetch('/api/config/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${password}`
      },
      body: JSON.stringify({
        type: 'supabase',
        url,
        key
      })
    });
    const data = await res.json();
    return { valid: data.valid, msg: data.error || 'Supabase Config Valid!' };
  } catch (err: any) {
    return { valid: false, msg: err.message || 'Error validating Supabase config.' };
  }
};
