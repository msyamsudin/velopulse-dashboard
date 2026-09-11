#!/usr/bin/env node
/**
 * Commit-message linter.
 *
 * Enforces Conventional Commits and rejects a leading UTF-8 BOM, because both
 * feed the changelog/version automation: `scripts/gen-changelog.mjs` and
 * release-please only see commits whose header matches `^type(scope): subject`.
 * A BOM makes that regex fail, so the commit vanishes from the release notes
 * with no error anywhere — the failure mode this script exists to prevent.
 *
 * Usage:
 *   node scripts/check-commit-msg.mjs .git/COMMIT_EDITMSG   # as a git hook
 *   node scripts/check-commit-msg.mjs --source merge <file> # skips merge/squash
 *   node scripts/check-commit-msg.mjs --range v0.1.0..HEAD  # audit a range
 *   node scripts/check-commit-msg.mjs --fix <file>          # strip the BOM
 *
 * Options:
 *   --fix                   strip a leading BOM from the message file
 *   --source <source>       git hook source (merge/squash skip validation)
 *   --range <base>..<head>  validate every commit in a revision range
 *   --require-attribution   also require an Assisted-by:/Co-authored-by: trailer
 *   --max-header <n>        override the header length limit (default 100)
 *
 * Exit codes: 0 valid, 1 invalid message(s), 2 usage or I/O error.
 */
import fs from 'node:fs';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import {
  BOM,
  stripBom,
  validateCommitMessage,
} from './lib/conventional-commits.mjs';

const ALL_ZERO = /^0+$/;

function parseArgs(argv) {
  const options = {
    file: null,
    range: null,
    fix: false,
    source: '',
    requireAttribution: false,
    maxHeaderLength: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--fix') options.fix = true;
    else if (arg === '--require-attribution') options.requireAttribution = true;
    else if (arg === '--source') options.source = argv[++i] ?? '';
    else if (arg === '--range') options.range = argv[++i] ?? '';
    else if (arg === '--max-header') options.maxHeaderLength = Number(argv[++i]);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else if (options.file === null) options.file = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }

  return options;
}

function usage() {
  const header = fs.readFileSync(new URL(import.meta.url), 'utf8')
    .split('\n')
    .slice(1, 27)
    .map(line => line.replace(/^\/?\*+ ?/, '').replace(/^\/$/, ''))
    .join('\n');
  console.log(header.trim());
}

function readMessageFile(file) {
  if (!fs.existsSync(file)) throw new Error(`message file not found: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

/**
 * Turns `--range` input into git revisions to inspect. A deleted/unknown base
 * (all-zero SHA on a branch's first push) degrades to the head commit only,
 * which keeps the CI job useful instead of failing on an unresolvable range.
 */
function resolveRange(value) {
  if (!value) return { revs: ['HEAD'], label: 'HEAD (no range given)' };
  if (!value.includes('..')) {
    return ALL_ZERO.test(value)
      ? { revs: ['HEAD'], label: 'HEAD (base was all zeros)' }
      : { revs: [`${value}..HEAD`], label: `${value}..HEAD` };
  }
  const [base, head = 'HEAD'] = value.split('..');
  if (!base || ALL_ZERO.test(base)) {
    return { revs: [head], label: `${head} (base was all zeros)` };
  }
  return { revs: [value], label: value };
}

function readCommits(revs) {
  // 0x1f separates the SHA from the body, 0x1e separates records — both are
  // safe because real commit messages never contain control characters.
  const raw = execFileSync(
    'git',
    ['log', '--format=%H%x1f%B%x1e', ...revs],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );

  return raw
    .split('\x1e')
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const [sha, ...rest] = record.split('\x1f');
      return { sha: sha.trim(), message: rest.join('\x1f') };
    });
}

function reportFailure(message, errors) {
  console.error(`\u2716 ${message}`);
  for (const error of errors) console.error(`    ${error}`);
}

function checkRange(options) {
  const { revs, label } = resolveRange(options.range);
  let commits;
  try {
    commits = readCommits(revs);
  } catch (error) {
    const detail = error.stderr ? String(error.stderr).trim() : error.message;
    console.error(`Could not read commits for "${label}": ${detail}`);
    return 2;
  }

  let failures = 0;
  let skipped = 0;

  for (const { sha, message } of commits) {
    const { parsed, errors, warnings } = validateCommitMessage(message, options);
    if (parsed.kind !== 'normal') {
      skipped += 1;
      continue;
    }
    for (const warning of warnings) {
      console.warn(`\u26a0 ${sha.slice(0, 7)} ${warning}`);
    }
    if (errors.length > 0) {
      failures += 1;
      reportFailure(`${sha.slice(0, 7)} ${parsed.header}`, errors);
    }
  }

  console.log(
    `Checked ${commits.length} commit(s) in ${label}: ${failures} invalid` +
      (skipped ? `, ${skipped} merge/revert skipped` : '')
  );
  return failures > 0 ? 1 : 0;
}

function checkFile(options) {
  let message = readMessageFile(options.file);

  if (options.fix && message.startsWith(BOM)) {
    message = stripBom(message);
    fs.writeFileSync(options.file, message, 'utf8');
    console.log('Stripped a UTF-8 BOM from the commit message.');
  }

  const { parsed, errors, warnings } = validateCommitMessage(message, options);

  if (parsed.kind !== 'normal') {
    console.log(`Skipping ${parsed.kind} commit message.`);
    return 0;
  }
  for (const warning of warnings) console.warn(`\u26a0 ${warning}`);
  if (errors.length === 0) return 0;

  reportFailure(parsed.header || '(empty header)', errors);
  console.error(
    '\nFormat: type(scope): subject\n' +
      'Types : feat, fix, perf, revert, docs, refactor, test, build, ci, chore, style\n' +
      'Example: feat(history): add the best-efforts power curve'
  );
  return 1;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return 0;
  }

  // Git already knows whether this is a merge; validating a generated message
  // would only produce noise.
  if (options.source === 'merge' || options.source === 'squash') {
    console.log(`Skipping validation for "${options.source}" commit.`);
    return 0;
  }

  try {
    if (options.range !== null) return checkRange(options);
    if (!options.file) {
      usage();
      return 2;
    }
    return checkFile(options);
  } catch (error) {
    console.error(`check-commit-msg: ${error.message}`);
    return 2;
  }
}

process.exit(main());
