import fs from 'fs';
import path from 'path';
import { DEFAULT_PROFILE, normalizeProfile, type UserProfile } from './profile';

const CONFIG_DIR = path.join(process.cwd(), '.app-data');
const PROFILE_PATH = path.join(CONFIG_DIR, 'profile.json');

export type { UserProfile } from './profile';

export function getUserProfile(): UserProfile {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      const data = fs.readFileSync(PROFILE_PATH, 'utf-8');
      // Nilai yang hilang memakai default; nilai yang tidak terbaca menjadi NaN
      // dan ditolak validasi saat profil hendak disimpan.
      return normalizeProfile(JSON.parse(data));
    }
  } catch (err) {
    console.error('Failed to read profile file:', err);
  }
  return DEFAULT_PROFILE;
}

export function saveUserProfile(newProfile: Partial<UserProfile>) {
  const currentProfile = getUserProfile();
  const mergedProfile = { ...currentProfile, ...newProfile };
  
  try {
    // Ensure directory exists (redundant but safe)
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const data = JSON.stringify(mergedProfile, null, 2);
    fs.writeFileSync(PROFILE_PATH, data, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save profile file:', err);
    return false;
  }
}
