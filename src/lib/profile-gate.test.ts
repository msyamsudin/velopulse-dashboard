import { describe, expect, it } from 'vitest';
import { getProfileGate } from './profile-gate';

describe('getProfileGate', () => {
  it('closes both metric gates when nothing is filled', () => {
    const gate = getProfileGate({ ftp: 0, weight: 0 });

    expect(gate.hasFtp).toBe(false);
    expect(gate.hasWeight).toBe(false);
    expect(gate.complete).toBe(false);
    expect(gate.missing).toEqual(['ftp', 'weight']);
  });

  it('keeps the weight gate closed while FTP is set', () => {
    const gate = getProfileGate({ ftp: 250, weight: 0 });

    expect(gate.hasFtp).toBe(true);
    expect(gate.hasWeight).toBe(false);
    expect(gate.complete).toBe(false);
    expect(gate.missing).toEqual(['weight']);
  });

  it('keeps the FTP gate closed while weight is set', () => {
    const gate = getProfileGate({ ftp: 0, weight: 78 });

    expect(gate.hasFtp).toBe(false);
    expect(gate.hasWeight).toBe(true);
    expect(gate.missing).toEqual(['ftp']);
  });

  it('reports a complete profile when both values are usable', () => {
    const gate = getProfileGate({ ftp: 210, weight: 72 });

    expect(gate.hasFtp).toBe(true);
    expect(gate.hasWeight).toBe(true);
    expect(gate.complete).toBe(true);
    expect(gate.missing).toEqual([]);
  });

  it('treats missing, negative and non-finite values as not usable', () => {
    expect(getProfileGate({}).missing).toEqual(['ftp', 'weight']);
    expect(getProfileGate({ ftp: null, weight: null }).complete).toBe(false);
    expect(getProfileGate({ ftp: -1, weight: -5 }).missing).toEqual(['ftp', 'weight']);
    expect(getProfileGate({ ftp: Number.NaN, weight: Number.POSITIVE_INFINITY }).complete).toBe(false);
  });
});
