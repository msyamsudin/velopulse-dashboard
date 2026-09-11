import { describe, expect, it } from 'vitest';
import { getPowerZoneIndex, getPowerZoneRangeLabel, summarizePowerZones } from './power-zones';
import { POWER_ZONES } from './constants';

const FTP = 200;
const sample = (power: number) => ({ power });

describe('getPowerZoneIndex', () => {
  it('places boundary values in the harder zone, following POWER_ZONES', () => {
    // 55 / 75 / 90 / 105 / 120 / 150 % of a 200 W FTP.
    expect(getPowerZoneIndex(110, FTP)).toBe(1);
    expect(getPowerZoneIndex(109, FTP)).toBe(0);
    expect(getPowerZoneIndex(150, FTP)).toBe(2);
    expect(getPowerZoneIndex(180, FTP)).toBe(3);
    expect(getPowerZoneIndex(210, FTP)).toBe(4);
    expect(getPowerZoneIndex(240, FTP)).toBe(5);
    expect(getPowerZoneIndex(300, FTP)).toBe(6);
  });

  it('keeps Z7 as the catch-all for anything above 150% FTP', () => {
    expect(getPowerZoneIndex(401, FTP)).toBe(POWER_ZONES.length - 1);
    expect(getPowerZoneIndex(900, FTP)).toBe(POWER_ZONES.length - 1);
  });

  it('returns -1 when the sample or the FTP cannot be attributed', () => {
    expect(getPowerZoneIndex(0, FTP)).toBe(-1);
    expect(getPowerZoneIndex(-30, FTP)).toBe(-1);
    expect(getPowerZoneIndex(200, 0)).toBe(-1);
    expect(getPowerZoneIndex(200, -1)).toBe(-1);
    expect(getPowerZoneIndex(Number.NaN, FTP)).toBe(-1);
    expect(getPowerZoneIndex(200, Number.NaN)).toBe(-1);
  });
});

describe('getPowerZoneRangeLabel', () => {
  it('renders open-ended first and last zones and absolute watts in between', () => {
    expect(getPowerZoneRangeLabel(FTP, 0)).toBe('<110');
    expect(getPowerZoneRangeLabel(FTP, 1)).toBe('110-150');
    expect(getPowerZoneRangeLabel(FTP, 4)).toBe('210-240');
    expect(getPowerZoneRangeLabel(FTP, 6)).toBe('>300');
    expect(getPowerZoneRangeLabel(FTP, 99)).toBe('');
  });
});

describe('summarizePowerZones', () => {
  it('returns an empty distribution when the FTP gate is closed', () => {
    const summary = summarizePowerZones([{ history: [sample(200), sample(220)], duration: 60 }], 0);

    expect(summary.zones).toEqual([]);
    expect(summary.countedSeconds).toBe(0);
    expect(summary.belowZoneSeconds).toBe(0);
  });

  it('spreads session duration across samples and percents over the counted time', () => {
    const history = [...Array.from({ length: 5 }, () => sample(100)), ...Array.from({ length: 5 }, () => sample(200))];
    const summary = summarizePowerZones([{ history, duration: 100 }], FTP);

    const [z1, z2, z3, z4] = summary.zones;
    expect(summary.zones).toHaveLength(POWER_ZONES.length);
    expect(z1.seconds).toBe(50);
    expect(z2.seconds).toBe(0);
    expect(z3.seconds).toBe(0);
    expect(z4.seconds).toBe(50);
    expect(z1.percent).toBe(50);
    expect(z4.percent).toBe(50);
    expect(summary.countedSeconds).toBe(100);
    expect(summary.belowZoneSeconds).toBe(0);
  });

  it('leaves coasting and missing samples out of the zones instead of calling them Z1', () => {
    const history = [...Array.from({ length: 6 }, () => sample(120)), ...Array.from({ length: 4 }, () => sample(0))];
    const summary = summarizePowerZones([{ history, duration: 100 }], FTP);

    expect(summary.zones[1].seconds).toBe(60);
    expect(summary.zones[0].seconds).toBe(0);
    expect(summary.countedSeconds).toBe(60);
    expect(summary.belowZoneSeconds).toBe(40);
    expect(summary.zones[1].percent).toBe(100);
  });

  it('agrees with the recorded duration for downsampled (non-1 Hz) sessions', () => {
    // Two samples covering 10 minutes: sample count must not become the weight.
    const summary = summarizePowerZones([{ history: [sample(120), sample(120)], duration: 600 }], FTP);

    expect(summary.countedSeconds).toBe(600);
    expect(summary.zones[1].seconds).toBe(600);
  });

  it('aggregates across sessions and keeps rounding error off Z7', () => {
    const summary = summarizePowerZones([
      { history: [sample(100), sample(200), sample(260)], duration: 100 },
      { history: [], duration: 50 },
    ], FTP);

    // Three samples split 100 s into 33.33 s each; the missing 1 s lands on the
    // largest zone (all equal here → the first), never on the catch-all.
    expect(summary.zones[0].seconds).toBe(34);
    expect(summary.zones[3].seconds).toBe(33);
    expect(summary.zones[5].seconds).toBe(33);
    expect(summary.zones[6].seconds).toBe(0);
    expect(summary.countedSeconds).toBe(100);
    expect(summary.belowZoneSeconds).toBe(50);
  });

  it('reports zero coverage for sessions without power samples', () => {
    const summary = summarizePowerZones([{ history: [], duration: 900 }], FTP);

    expect(summary.countedSeconds).toBe(0);
    expect(summary.belowZoneSeconds).toBe(900);
    expect(summary.zones.every(zone => zone.percent === 0 && zone.seconds === 0)).toBe(true);
  });

  it('formats zone seconds as a duration and labels ranges for the rider FTP', () => {
    const summary = summarizePowerZones([{ history: [sample(250)], duration: 3661 }], FTP);

    // 250 W / 200 W = 1.25 → Z6.
    expect(summary.zones[5].label).toBe('Z6');
    expect(summary.zones[5].name).toBe('Anaerobic');
    expect(summary.zones[5].range).toBe('240-300');
    expect(summary.zones[5].time).toBe('1:01:01');
    expect(summary.zones[5].color).toBe(POWER_ZONES[5].color);
  });
});
