import fs from 'fs';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), '.app-data');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

// Ensure directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

export interface AppConfig {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APP_URL?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  MASTER_PASSWORD?: string; // Hashed or plain for local dev
}

export function getAppConfig(): AppConfig {
  let fileConfig: AppConfig = {};
  
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
      fileConfig = JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read config file:', err);
  }

  // Priority: config.json > process.env
  return {
    GOOGLE_CLIENT_ID: fileConfig.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: fileConfig.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    APP_URL: fileConfig.APP_URL || process.env.APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: fileConfig.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fileConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    MASTER_PASSWORD: fileConfig.MASTER_PASSWORD || 'admin' // Default password for bootstrap
  };
}

export function saveAppConfig(newConfig: Partial<AppConfig>) {
  const currentConfig = getAppConfig();
  const mergedConfig = { ...currentConfig, ...newConfig };
  
  try {
    const data = JSON.stringify(mergedConfig, null, 2);
    fs.writeFileSync(CONFIG_PATH, data, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save config file:', err);
    return false;
  }
}
export function isSystemConfigured(): { configured: boolean; missingFields: string[] } {
  const config = getAppConfig();
  const requiredFields: (keyof AppConfig)[] = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missingFields = requiredFields.filter(field => !config[field] || config[field] === '');

  return {
    configured: missingFields.length === 0,
    missingFields
  };
}
