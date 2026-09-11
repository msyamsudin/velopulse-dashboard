// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  findAttribution,
  parseCommitMessage,
  sectionForType,
  stripBom,
  validateCommitMessage,
} from './conventional-commits.mjs';

const BOM = '\uFEFF';

describe('stripBom', () => {
  it('removes a leading BOM and leaves the rest untouched', () => {
    expect(stripBom(`${BOM}feat: something`)).toBe('feat: something');
  });

  it('is a no-op without a BOM', () => {
    expect(stripBom('feat: something')).toBe('feat: something');
  });
});

describe('parseCommitMessage', () => {
  it('reads type, scope and subject', () => {
    const parsed = parseCommitMessage('feat(history): add the best-efforts curve');
    expect(parsed.type).toBe('feat');
    expect(parsed.scope).toBe('history');
    expect(parsed.subject).toBe('add the best-efforts curve');
    expect(parsed.breaking).toBe(false);
    expect(parsed.kind).toBe('normal');
  });

  it('accepts a missing scope', () => {
    const parsed = parseCommitMessage('chore: bump the toolchain');
    expect(parsed.type).toBe('chore');
    expect(parsed.scope).toBeNull();
  });

  it('flags a breaking change written as a bang', () => {
    expect(parseCommitMessage('feat(api)!: drop the legacy endpoint').breaking).toBe(true);
  });

  it('flags a breaking change written as a footer', () => {
    const message = 'feat(api): rework sync\n\nBREAKING CHANGE: the payload shape changed';
    expect(parseCommitMessage(message).breaking).toBe(true);
  });

  it('records the BOM it found instead of hiding it', () => {
    const parsed = parseCommitMessage(`${BOM}fix(ui): align the header`);
    expect(parsed.hadBom).toBe(true);
    expect(parsed.type).toBe('fix');
  });

  it('classifies git-generated messages', () => {
    expect(parseCommitMessage('Merge branch \'main\' into feat/x').kind).toBe('merge');
    expect(parseCommitMessage('Revert "feat(ui): add a widget"').kind).toBe('revert');
  });

  it('keeps footers available for attribution queries', () => {
    const message = 'feat(ui): add a widget\n\nAssisted-by: DeepSeek Harness\nRefs: #12';
    expect(parseCommitMessage(message).footers).toHaveLength(2);
  });
});

describe('findAttribution', () => {
  it('finds known attribution trailers case-insensitively', () => {
    const found = findAttribution('feat: x\n\nassisted-by: some agent');
    expect(found).toHaveLength(1);
    expect(found[0].value).toBe('some agent');
  });

  it('returns nothing for an unattributed message', () => {
    expect(findAttribution('feat: x\n\nRefs: #1')).toHaveLength(0);
  });
});

describe('validateCommitMessage', () => {
  it('accepts a conventional commit', () => {
    const result = validateCommitMessage('fix(i18n): follow the app locale in exports');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a BOM-prefixed message — the bug that hid 8 commits from the changelog', () => {
    const result = validateCommitMessage(`${BOM}fix(i18n): translate hardcoded UI text`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/BOM/);
  });

  it('rejects a free-form header', () => {
    const result = validateCommitMessage('Refine pre-ride workout UI');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/not a Conventional Commit/);
  });

  it('rejects an unknown type', () => {
    const result = validateCommitMessage('update(ui): tweak the header');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/unknown type/);
  });

  it('rejects a header over the length limit', () => {
    const result = validateCommitMessage(`feat: ${'x'.repeat(120)}`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/max 100/);
  });

  it('warns about a trailing period without failing the commit', () => {
    const result = validateCommitMessage('fix(ui): align the header.');
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it('skips merge and revert messages', () => {
    expect(validateCommitMessage('Merge branch \'main\'').valid).toBe(true);
    expect(validateCommitMessage('Revert "feat: x"').valid).toBe(true);
  });

  it('only demands attribution when the caller asks for it', () => {
    const message = 'feat(ui): add a widget';
    expect(validateCommitMessage(message).valid).toBe(true);
    expect(validateCommitMessage(message, { requireAttribution: true }).valid).toBe(false);
    expect(
      validateCommitMessage(`${message}\n\nAssisted-by: an agent`, { requireAttribution: true }).valid
    ).toBe(true);
  });
});

describe('sectionForType', () => {
  it('maps known types to changelog sections', () => {
    expect(sectionForType('feat')).toBe('Features');
    expect(sectionForType('fix')).toBe('Bug Fixes');
  });

  it('falls back to Other Changes', () => {
    expect(sectionForType('nonsense')).toBe('Other Changes');
  });
});
