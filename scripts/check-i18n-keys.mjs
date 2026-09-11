#!/usr/bin/env node
/**
 * i18n key checker.
 *
 * Scans every non-test `.ts`/`.tsx` file under `src/` for literal `t('...')`
 * keys and reports the ones missing from the Indonesian dictionary in
 * `src/i18n/index.tsx`. Dynamic calls (`t(someVariable)`) cannot be checked and
 * are skipped — the values they pass are covered by the dictionaries they come
 * from (recommendations, milestone titles, metric/period names).
 *
 * Usage:
 *   node scripts/check-i18n-keys.mjs           # report only, always exit 0
 *   node scripts/check-i18n-keys.mjs --strict   # exit 1 when keys are missing
 *
 * `--strict` is meant to be wired into CI once the known backlog is zero.
 */
import fs from 'node:fs';
import path from 'node:path';

const strict = process.argv.includes('--strict');
const root = process.cwd();
const srcDir = path.join(root, 'src');

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) files.push(full);
  }
})(srcDir);

const i18nSource = fs.readFileSync(path.join(srcDir, 'i18n/index.tsx'), 'utf8');
const idStart = i18nSource.indexOf('const id: Record<string, string> = {');
const idEnd = i18nSource.indexOf('\n};', idStart);
if (idStart === -1 || idEnd === -1) {
  console.error('Could not locate the "id" dictionary in src/i18n/index.tsx');
  process.exit(2);
}

const dictionaryKeys = new Set();
const keyPattern = /^\s*'((?:[^'\\]|\\.)*)':/gm;
let match;
while ((match = keyPattern.exec(i18nSource.slice(idStart, idEnd)))) {
  dictionaryKeys.add(match[1]);
}

/** @type {Map<string, Set<string>>} */
const missing = new Map();
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const callPattern = /\bt\(\s*'((?:[^'\\]|\\.)*)'/g;
  let call;
  while ((call = callPattern.exec(source))) {
    const key = call[1];
    if (dictionaryKeys.has(key)) continue;
    if (!missing.has(key)) missing.set(key, new Set());
    missing.get(key).add(path.relative(root, file).replace(/\\/g, '/'));
  }
}

console.log(`Dictionary keys: ${dictionaryKeys.size}`);
if (missing.size === 0) {
  console.log('i18n keys: OK — every literal t() key exists in the Indonesian dictionary.');
  process.exit(0);
}

console.log(`Missing Indonesian translations: ${missing.size}\n`);
for (const [key, locations] of [...missing].sort()) {
  console.log(`  ${JSON.stringify(key)}`);
  console.log(`      ${[...locations].sort().join('\n      ')}`);
}
console.log('\nAdd these keys to the `id` map in src/i18n/index.tsx.');
process.exit(strict ? 1 : 0);
