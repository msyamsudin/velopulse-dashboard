#!/usr/bin/env node
/**
 * Bundles `supabase/migrations/*.sql` into `supabase/schema.sql`.
 *
 * The two-file setup is deliberate. Migrations are the versioned source of
 * truth, but this project is deployed by pasting SQL into the Supabase SQL
 * Editor, which needs one file. Rather than keep two hand-maintained copies —
 * the exact dual-truth problem this repo is fixing — `schema.sql` is generated
 * and CI verifies it is up to date.
 *
 * Usage:
 *   node scripts/build-schema.mjs          # regenerate supabase/schema.sql
 *   node scripts/build-schema.mjs --check  # exit 1 if it is out of date (CI)
 *   node scripts/build-schema.mjs --stdout
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS_DIR = path.join(root, 'supabase', 'migrations');
const SCHEMA_PATH = path.join(root, 'supabase', 'schema.sql');

/** BOM and CRLF would otherwise make `--check` fail on a Windows checkout. */
function normalize(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/, '\n');
}

function migrationNames() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort();
}

function build() {
  const names = migrationNames();
  if (names.length === 0) {
    throw new Error(`no migrations found in ${path.relative(root, MIGRATIONS_DIR)}`);
  }

  const header = [
    '-- ============================================================================',
    '-- GENERATED FILE — do not edit by hand.',
    '--',
    '-- Built from supabase/migrations/*.sql by scripts/build-schema.mjs.',
    '-- Change a migration, then run:  pnpm run schema:build',
    '--',
    '-- Paste this whole file into Supabase Dashboard > SQL Editor to bring a',
    '-- project up to date. Every statement is idempotent, so re-running is safe.',
    '--',
    '-- Migrations bundled, in order:',
    ...names.map(name => `--   ${name}`),
    '-- ============================================================================',
    '',
  ].join('\n');

  const parts = names.map(name => {
    const body = normalize(fs.readFileSync(path.join(MIGRATIONS_DIR, name), 'utf8'));
    const rule = '='.repeat(Math.max(4, 72 - name.length));
    return `-- ===== ${name} ${rule}\n\n${body}`;
  });

  return `${header}\n${parts.join('\n')}`;
}

function main() {
  const args = process.argv.slice(2);
  const expected = build();

  if (args.includes('--stdout')) {
    process.stdout.write(expected);
    return 0;
  }

  const exists = fs.existsSync(SCHEMA_PATH);
  const actual = exists ? normalize(fs.readFileSync(SCHEMA_PATH, 'utf8')) : '';

  if (args.includes('--check')) {
    if (actual === expected) {
      console.log(
        `supabase/schema.sql is up to date (${migrationNames().length} migration(s) bundled).`
      );
      return 0;
    }
    console.error(
      'supabase/schema.sql is out of date with supabase/migrations/.\n' +
        'Run `pnpm run schema:build` and commit the result.'
    );
    return 1;
  }

  if (actual === expected) {
    console.log('supabase/schema.sql already up to date — nothing to write.');
    return 0;
  }

  fs.writeFileSync(SCHEMA_PATH, expected, 'utf8');
  console.log(
    `Wrote supabase/schema.sql from ${migrationNames().length} migration(s).`
  );
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`build-schema: ${error.message}`);
  process.exit(2);
}
