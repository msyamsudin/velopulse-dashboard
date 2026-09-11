import { describe, expect, it } from 'vitest';
import { classifyHrrScore, hrrLevelKey } from './hrr';

describe('classifyHrrScore', () => {
  it('maps the 2-minute HR drop onto the stable levels', () => {
    expect(classifyHrrScore(35)).toBe('excellent');
    expect(classifyHrrScore(29)).toBe('excellent');
    expect(classifyHrrScore(28)).toBe('good');
    expect(classifyHrrScore(18)).toBe('good');
    expect(classifyHrrScore(17)).toBe('fair');
    expect(classifyHrrScore(12)).toBe('fair');
    expect(classifyHrrScore(11)).toBe('poor');
    expect(classifyHrrScore(0)).toBe('poor');
  });
});

describe('hrrLevelKey', () => {
  it('translates the stored level codes', () => {
    expect(hrrLevelKey('excellent')).toBe('Excellent (athletic)');
    expect(hrrLevelKey('good')).toBe('Good (normal)');
    expect(hrrLevelKey('fair')).toBe('Fair');
    expect(hrrLevelKey('poor')).toBe('Not optimal');
  });

  it('still reads the labels older versions stored', () => {
    // Sessions recorded before the level codes existed kept the translated
    // label, so both languages have to resolve back to the same key.
    expect(hrrLevelKey('Sangat Baik (Atletis)')).toBe('Excellent (athletic)');
    expect(hrrLevelKey('Baik (Normal)')).toBe('Good (normal)');
    expect(hrrLevelKey('Cukup')).toBe('Fair');
    expect(hrrLevelKey('Kurang Optimal')).toBe('Not optimal');
    expect(hrrLevelKey('Good')).toBe('Good (normal)');
    expect(hrrLevelKey('normal')).toBe('Good (normal)');
  });

  it('falls back to "Not classified" for missing or unknown values', () => {
    expect(hrrLevelKey(null)).toBe('Not classified');
    expect(hrrLevelKey(undefined)).toBe('Not classified');
    expect(hrrLevelKey('')).toBe('Not classified');
    expect(hrrLevelKey('something else')).toBe('Not classified');
  });
});
