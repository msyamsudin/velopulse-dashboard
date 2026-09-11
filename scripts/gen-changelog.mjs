#!/usr/bin/env node
/**
 * Renders release notes from git history.
 *
 * Written for two jobs:
 *   1. Bootstrap / recovery — reconstruct a changelog for a project that has
 *      commits but no releases yet (which is how this repo started).
 *   2. Audit — answer "what actually shipped between these two tags?".
 *
 * release-please owns CHANGELOG.md for normal releases (see CONTRIBUTING.md);
 * `--write` is the manual bootstrap/recovery path, not part of the routine flow,
 * so the two mechanisms never fight over the same file.
 *
 * Unlike third-party release tooling, this generator tolerates a UTF-8 BOM in a
 * commit message (see scripts/lib/conventional-commits.mjs). Commits that do not
 * follow Conventional Commits are reported under "Other Changes" instead of
 * being dropped — a changelog that silently omits half the history is worse
 * than one that admits it.
 *
 * Usage:
 *   node scripts/gen-changelog.mjs                          # print, HEAD back to the last tag
 *   node scripts/gen-changelog.mjs --all                    # print, whole history
 *   node scripts/gen-changelog.mjs --range v0.1.0..HEAD
 *   node scripts/gen-changelog.mjs --version 0.1.0 --include-internal --write
 *
 * Options:
 *   --range <rev-range>     commits to include (default: last tag..HEAD, or all)
 *   --all                   ignore the last tag and use the whole history
 *   --version <x.y.z>       version heading (default: package.json version)
 *   --date <YYYY-MM-DD>     release date (default: today)
 *   --note <text>           paragraph to place under the version heading
 *   --include-internal      also list docs/refactor/test/build/ci/chore/style
 *   --write                 write into CHANGELOG.md instead of stdout
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  SECTION_ORDER,
  parseCommitMessage,
  sectionForType,
} from './lib/conventional-commits.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_PATH = path.join(root, 'CHANGELOG.md');
const REPO_SLUG_FALLBACK = 'msyamsudin/velopulse-dashboard';

const SCAFFOLD = `# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function parseArgs(argv) {
  const options = { range: null, all: false, version: null, date: null, note: '', includeInternal: false, write: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') options.all = true;
    else if (arg === '--write') options.write = true;
    else if (arg === '--include-internal') options.includeInternal = true;
    else if (arg === '--range') options.range = argv[++i] ?? '';
    else if (arg === '--version') options.version = argv[++i] ?? '';
    else if (arg === '--date') options.date = argv[++i] ?? '';
    else if (arg === '--note') options.note = argv[++i] ?? '';
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

/** `git@github.com:owner/repo.git` and `https://…/repo.git` both -> a browsable URL. */
function repoUrl() {
  let remote = '';
  try {
    remote = git(['config', '--get', 'remote.origin.url']);
  } catch {
    /* no remote configured */
  }
  if (!remote) return `https://github.com/${REPO_SLUG_FALLBACK}`;
  const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(remote);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  return remote.replace(/\.git$/, '');
}

function lastTag() {
  try {
    return git(['describe', '--tags', '--abbrev=0']);
  } catch {
    return null;
  }
}

function readCommits(range) {
  const args = ['log', '--date=short', '--format=%H%x1f%h%x1f%ad%x1f%B%x1e'];
  if (range) args.push(range);
  const raw = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });

  return raw
    .split('\x1e')
    .map(record => record.trim())
    .filter(Boolean)
    .map(record => {
      const [sha, short, date, ...body] = record.split('\x1f');
      return { sha, short, date, message: body.join('\x1f') };
    });
}

function isSkipped(subject) {
  // Release commits are bookkeeping, not changes worth listing.
  return /^chore(\(.+\))?: release\b/i.test(subject);
}

function buildEntries(commits) {
  const groups = new Map();
  let skipped = 0;

  for (const commit of commits) {
    const parsed = parseCommitMessage(commit.message);
    if (parsed.kind !== 'normal' || isSkipped(parsed.subject)) {
      skipped += 1;
      continue;
    }
    const section = sectionForType(parsed.type);
    if (!groups.has(section)) groups.set(section, []);
    groups.get(section).push({ ...commit, parsed });
  }

  return { groups, skipped };
}

function renderSection(section, entries, url) {
  const lines = [`### ${section}`, ''];
  const sorted = [...entries].sort((a, b) => a.parsed.subject.localeCompare(b.parsed.subject));
  for (const entry of sorted) {
    const { parsed, short } = entry;
    const scope = parsed.scope ? `**${parsed.scope}:** ` : '';
    const breaking = parsed.breaking ? '**BREAKING** ' : '';
    lines.push(`- ${breaking}${scope}${parsed.subject} ([\`${short}\`](${url}/commit/${entry.sha}))`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderRelease({ version, date, note, commits, url, includeInternal, rangeLabel }) {
  const { groups, skipped } = buildEntries(commits);
  const wanted = SECTION_ORDER.filter(section =>
    includeInternal ? true : groups.has(section) && section !== 'Other Changes'
  );
  const internalOnly = new Set(['Documentation', 'Code Refactoring', 'Tests', 'Build System', 'Continuous Integration', 'Miscellaneous Chores', 'Styles']);

  const body = [];
  const first = commits.length ? commits[commits.length - 1] : null;
  const last = commits[0];

  body.push(`## [${version}] - ${date}`, '');
  if (note) body.push(note, '');
  if (first && last) {
    body.push(
      `_${commits.length} commit(s), ${first.date} → ${last.date}` +
        (rangeLabel ? ` · range \`${rangeLabel}\`_` : '_'),
      ''
    );
  }

  let rendered = 0;
  for (const section of wanted) {
    const entries = groups.get(section);
    if (!entries?.length) continue;
    if (internalOnly.has(section) && !includeInternal) continue;
    body.push(renderSection(section, entries, url));
    rendered += entries.length;
  }
  if (rendered === 0) body.push('_No user-facing changes._', '');

  body.push(
    `<!-- ${commits.length} commit(s) scanned, ${skipped} merge/revert/release skipped, ` +
      `${commits.length - skipped - rendered} hidden behind --include-internal. -->`,
    ''
  );

  return body.join('\n');
}

/** Replaces an existing section for the same version, otherwise inserts it after `[Unreleased]`. */
function upsertRelease(existing, version, sectionText) {
  const heading = `## [${version}]`;
  const start = existing.indexOf(heading);

  if (start !== -1) {
    const next = existing.indexOf('\n## ', start + heading.length);
    return next === -1
      ? `${existing.slice(0, start)}${sectionText}`
      : `${existing.slice(0, start)}${sectionText}${existing.slice(next + 1)}`;
  }

  const anchor = existing.indexOf('## [Unreleased]');
  if (anchor !== -1) {
    const next = existing.indexOf('\n## ', anchor + 1);
    const insertAt = next === -1 ? existing.length : next + 1;
    return `${existing.slice(0, insertAt)}${sectionText}\n${existing.slice(insertAt)}`;
  }

  const separator = existing.endsWith('\n') ? '' : '\n';
  return `${existing}${separator}${sectionText}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 30).join('\n'));
    return 0;
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const version = options.version || pkg.version;
  const date = options.date || new Date().toISOString().slice(0, 10);

  let range = options.range;
  if (!range && !options.all) {
    const tag = lastTag();
    if (tag) range = `${tag}..HEAD`;
  }

  const commits = readCommits(range);
  if (commits.length === 0) {
    console.error('No commits in range — nothing to write.');
    return 1;
  }

  const url = repoUrl();
  const sectionText = renderRelease({
    version,
    date,
    note: options.note,
    commits,
    url,
    includeInternal: options.includeInternal,
    rangeLabel: range,
  });

  if (!options.write) {
    process.stdout.write(sectionText);
    return 0;
  }

  const existing = fs.existsSync(CHANGELOG_PATH)
    ? fs.readFileSync(CHANGELOG_PATH, 'utf8')
    : SCAFFOLD;

  fs.writeFileSync(CHANGELOG_PATH, upsertRelease(existing, version, sectionText), 'utf8');
  console.log(`Wrote ${path.relative(root, CHANGELOG_PATH).replace(/\\/g, '/')} — ${version} (${commits.length} commits scanned).`);
  return 0;
}

process.exit(main());
