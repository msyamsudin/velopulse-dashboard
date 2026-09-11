/**
 * Conventional Commits parsing shared by the commit-message linter
 * (`scripts/check-commit-msg.mjs`) and the changelog generator
 * (`scripts/gen-changelog.mjs`).
 *
 * Dependency-free ESM on purpose: the git hooks must run with nothing but
 * whatever `node` is on PATH, and CI must be able to validate commit messages
 * without an install step.
 */

/**
 * A UTF-8 BOM. Editors and tooling on Windows happily put one in front of a
 * commit message, and then every `^`-anchored pattern silently stops matching.
 * That is exactly how a release ends up dropping commits from its changelog
 * without reporting anything, so this module treats the BOM as a hard error
 * instead of trimming it away quietly.
 */
export const BOM = '\uFEFF';

export const COMMIT_TYPES = [
  'feat',
  'fix',
  'perf',
  'revert',
  'docs',
  'refactor',
  'test',
  'build',
  'ci',
  'chore',
  'style',
];

/** Commit type -> changelog section, matching what release tooling prints. */
export const CHANGELOG_SECTIONS = {
  feat: 'Features',
  fix: 'Bug Fixes',
  perf: 'Performance Improvements',
  revert: 'Reverts',
  docs: 'Documentation',
  refactor: 'Code Refactoring',
  test: 'Tests',
  build: 'Build System',
  ci: 'Continuous Integration',
  chore: 'Miscellaneous Chores',
  style: 'Styles',
};

/** Sections that carry a user-visible change, in release-note order. */
export const USER_FACING_SECTIONS = [
  'Features',
  'Bug Fixes',
  'Performance Improvements',
  'Reverts',
];

export const SECTION_ORDER = [
  ...USER_FACING_SECTIONS,
  'Documentation',
  'Code Refactoring',
  'Tests',
  'Build System',
  'Continuous Integration',
  'Miscellaneous Chores',
  'Styles',
  'Other Changes',
];

export const MAX_HEADER_LENGTH = 100;

/** Trailers that record who (or what) produced the change. */
export const ATTRIBUTION_TOKENS = ['assisted-by', 'co-authored-by', 'generated-by'];

export function hasBom(text) {
  return String(text ?? '').startsWith(BOM);
}

export function stripBom(text) {
  const value = String(text ?? '');
  return value.startsWith(BOM) ? value.slice(BOM.length) : value;
}

const HEADER_PATTERN = /^([a-zA-Z]+)(?:\(([^()]*)\))?(!)?:[ ]?(.*)$/;

/**
 * Parses one commit message into its Conventional Commits parts.
 * Never throws: an unparseable message comes back with `type: null`, which is
 * what the validator reports as "not a Conventional Commit".
 */
export function parseCommitMessage(rawMessage) {
  const hadBom = hasBom(rawMessage);
  const message = stripBom(rawMessage).replace(/\r\n/g, '\n');
  const [headerLine = '', ...restLines] = message.split('\n');
  const body = restLines.join('\n').trim();
  const header = headerLine.trim();

  const parsed = {
    message,
    hadBom,
    header,
    type: null,
    scope: null,
    breaking: false,
    subject: '',
    body,
    footers: [],
    kind: 'normal',
  };

  // Messages git writes itself are not authored prose — leave them alone.
  if (/^Merge\b/.test(header)) {
    parsed.kind = 'merge';
    return parsed;
  }
  if (/^Revert\b/.test(header)) {
    parsed.kind = 'revert';
    parsed.subject = header;
    return parsed;
  }

  const match = HEADER_PATTERN.exec(header);
  if (match) {
    parsed.type = match[1].toLowerCase();
    parsed.scope = match[2] ? match[2].trim() : null;
    parsed.breaking = match[3] === '!';
    parsed.subject = (match[4] ?? '').trim();
  } else {
    parsed.subject = header;
  }

  if (/^BREAKING[ -]CHANGE:/m.test(message)) parsed.breaking = true;
  parsed.footers = parseFooters(body);
  return parsed;
}

/** Collects `Token: value` trailers from the body. */
export function parseFooters(body) {
  const footers = [];
  for (const line of String(body ?? '').split('\n')) {
    const match = /^([A-Za-z][A-Za-z-]*):[ ]+(.+)$/.exec(line.trim());
    if (match) footers.push({ token: match[1], value: match[2].trim() });
  }
  return footers;
}

/** Returns the attribution trailers (`Assisted-by:` and friends) of a message. */
export function findAttribution(message) {
  return parseFooters(stripBom(message)).filter(footer =>
    ATTRIBUTION_TOKENS.includes(footer.token.toLowerCase())
  );
}

export function sectionForType(type) {
  return CHANGELOG_SECTIONS[type] ?? 'Other Changes';
}

/**
 * Validates a commit message.
 *
 * @returns {{parsed: object, errors: string[], warnings: string[], valid: boolean}}
 */
export function validateCommitMessage(rawMessage, options = {}) {
  const {
    requireAttribution = false,
    maxHeaderLength = MAX_HEADER_LENGTH,
  } = options;

  const parsed = parseCommitMessage(rawMessage);
  const errors = [];
  const warnings = [];

  if (parsed.kind !== 'normal') {
    return { parsed, errors, warnings, valid: true };
  }

  if (parsed.hadBom) {
    errors.push('message starts with a UTF-8 BOM (U+FEFF) — run with --fix to strip it');
  }
  if (!parsed.type) {
    errors.push(
      `header is not a Conventional Commit: "${parsed.header}" — expected "type(scope): subject"`
    );
  } else if (!COMMIT_TYPES.includes(parsed.type)) {
    errors.push(
      `unknown type "${parsed.type}" — allowed: ${COMMIT_TYPES.join(', ')}`
    );
  }
  if (!parsed.subject) {
    errors.push('missing subject after "type(scope): "');
  } else if (parsed.subject.endsWith('.')) {
    warnings.push('subject ends with a period');
  }
  if (parsed.header.length > maxHeaderLength) {
    errors.push(`header is ${parsed.header.length} characters (max ${maxHeaderLength})`);
  }
  if (requireAttribution && findAttribution(parsed.message).length === 0) {
    errors.push(
      `missing an attribution trailer — add one of ${ATTRIBUTION_TOKENS.map(t => `${t}:`).join(', ')}`
    );
  }

  return { parsed, errors, warnings, valid: errors.length === 0 };
}
