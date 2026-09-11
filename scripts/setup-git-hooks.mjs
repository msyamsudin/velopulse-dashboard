#!/usr/bin/env node
/**
 * Points git at the hooks committed in `.githooks/`.
 *
 * `.git/hooks` is not versioned, so the Conventional Commits guard would
 * disappear on every fresh clone. `core.hooksPath` fixes that: the hooks live
 * in the repo and git reads them from there.
 *
 * Wired to the `prepare` lifecycle script, so `pnpm install` sets it up.
 * Never clobbers an existing, different `core.hooksPath` — it warns instead.
 *
 * Usage:
 *   node scripts/setup-git-hooks.mjs            # install
 *   node scripts/setup-git-hooks.mjs --uninstall
 *   node scripts/setup-git-hooks.mjs --quiet
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HOOKS_PATH = '.githooks';
const HOOKS = ['commit-msg', 'prepare-commit-msg'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const quiet = process.argv.includes('--quiet');
const uninstall = process.argv.includes('--uninstall');

function say(message) {
  if (!quiet) console.log(`[git-hooks] ${message}`);
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function main() {
  if (!fs.existsSync(path.join(root, '.git'))) {
    say('no .git directory here — skipping (archive/Docker install).');
    return 0;
  }

  try {
    git(['rev-parse', '--git-dir']);
  } catch {
    say('not a git work tree — skipping.');
    return 0;
  }

  if (uninstall) {
    try {
      git(['config', '--unset', 'core.hooksPath']);
      say(`removed core.hooksPath (was ${HOOKS_PATH}).`);
    } catch {
      say('core.hooksPath was not set — nothing to remove.');
    }
    return 0;
  }

  let current = '';
  try {
    current = git(['config', '--get', 'core.hooksPath']);
  } catch {
    current = '';
  }

  if (current && current !== HOOKS_PATH) {
    console.warn(
      `[git-hooks] core.hooksPath already points at "${current}" — leaving it alone.\n` +
        `[git-hooks] Run \`git config core.hooksPath ${HOOKS_PATH}\` to use the repo hooks instead.`
    );
    return 0;
  }

  if (current === HOOKS_PATH) {
    say(`core.hooksPath already ${HOOKS_PATH}.`);
  } else {
    git(['config', 'core.hooksPath', HOOKS_PATH]);
    say(`set core.hooksPath=${HOOKS_PATH}.`);
  }

  // Best effort: Windows has no executable bit, and that is fine — git for
  // Windows runs the hook through its bundled sh either way.
  for (const hook of HOOKS) {
    const file = path.join(root, HOOKS_PATH, hook);
    if (!fs.existsSync(file)) continue;
    try {
      fs.chmodSync(file, 0o755);
    } catch {
      /* not fatal */
    }
  }

  say(`commit messages are validated by ${HOOKS.join(' + ')}.`);
  return 0;
}

process.exit(main());
