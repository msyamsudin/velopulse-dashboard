import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { DEFAULT_PROFILE } from './profile';
import { getUserProfile, saveUserProfile } from './profile-helper';

const CONFIG_DIR = path.join(process.cwd(), '.app-data');
const PROFILE_PATH = path.join(CONFIG_DIR, 'profile.json');

// Berkas ini adalah profil perangkat sungguhan. Tes menyimpan isinya lebih dulu
// dan mengembalikannya, sehingga menjalankan suite tidak menghapus data lokal.
let previousProfile: string | null = null;

beforeEach(() => {
  previousProfile = existsSync(PROFILE_PATH) ? readFileSync(PROFILE_PATH, 'utf-8') : null;
  mkdirSync(CONFIG_DIR, { recursive: true });
  rmSync(PROFILE_PATH, { force: true });
});

afterEach(() => {
  if (previousProfile === null) {
    rmSync(PROFILE_PATH, { force: true });
  } else {
    writeFileSync(PROFILE_PATH, previousProfile, 'utf-8');
  }
});

describe('getUserProfile', () => {
  it('falls back to the defaults when nothing was saved yet', () => {
    expect(getUserProfile()).toEqual(DEFAULT_PROFILE);
  });

  it('fills fields a legacy file does not have', () => {
    writeFileSync(PROFILE_PATH, JSON.stringify({ age: 42, ftp: 230 }), 'utf-8');

    const profile = getUserProfile();

    expect(profile.age).toBe(42);
    expect(profile.ftp).toBe(230);
    expect(profile.maxHr).toBe(DEFAULT_PROFILE.maxHr);
    expect(profile.maxHrSource).toBe('auto');
    expect(profile.restingHr).toBe(0);
  });

  it('does not throw on a corrupt file', () => {
    writeFileSync(PROFILE_PATH, '{not json', 'utf-8');

    expect(getUserProfile()).toEqual(DEFAULT_PROFILE);
  });
});

describe('saveUserProfile', () => {
  it('merges a partial save into what is already stored', () => {
    saveUserProfile({ age: 40, maxHr: 178, ftp: 220, weight: 74, restingHr: 52 });
    saveUserProfile({ weight: 73.5 });

    const profile = getUserProfile();

    expect(profile).toMatchObject({
      age: 40,
      maxHr: 178,
      ftp: 220,
      weight: 73.5,
      restingHr: 52,
    });
  });

  it('reports failure without throwing when the profile cannot be written', () => {
    // Direktori dihapus dan diganti berkas, sehingga penulisan pasti gagal.
    rmSync(CONFIG_DIR, { recursive: true, force: true });
    writeFileSync(CONFIG_DIR, 'not a directory', 'utf-8');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      expect(saveUserProfile({ age: 40 })).toBe(false);
    } finally {
      consoleError.mockRestore();
      rmSync(CONFIG_DIR, { force: true });
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
  });
});
