import fs from 'fs';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), '.app-data');
const PROFILE_PATH = path.join(CONFIG_DIR, 'profile.json');

export interface UserProfile {
  maxHr: number;
  ftp: number;
  weight: number;
  displayName?: string;
}

// Must stay in sync with DEFAULT_PROFILE in @/lib/constants.ts
const DEFAULT_PROFILE: UserProfile = {
  maxHr: 190,
  ftp: 0,
  weight: 0
};

export function getUserProfile(): UserProfile {
  try {
    if (fs.existsSync(PROFILE_PATH)) {
      const data = fs.readFileSync(PROFILE_PATH, 'utf-8');
      return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
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
