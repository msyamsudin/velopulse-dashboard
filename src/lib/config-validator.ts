export interface ValidationResult {
  valid: boolean;
  msg: string;
}

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
