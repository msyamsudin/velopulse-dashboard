import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/**
 * Build identity.
 *
 * The commit SHA is the real identity of a web deployment — a version number
 * alone cannot tell you which commit is live. Both are inlined into the bundle
 * so the running app can report exactly what it was built from, which is what
 * makes a bug report or a rollback decision possible.
 */
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** Hosts expose the SHA directly; otherwise ask git; otherwise stay honest. */
const resolveCommitSha = () => {
  const fromHost = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (fromHost) return fromHost.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
};

export default nextConfig;
