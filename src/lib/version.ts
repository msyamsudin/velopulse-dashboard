/**
 * Build identity of the running deployment.
 *
 * The values are inlined at build time by `next.config.mjs`. A version number
 * on its own cannot answer "which commit is live?", so every bug report and
 * rollback decision is anchored on the commit SHA instead.
 *
 * The formatting helpers are pure and take their inputs explicitly, so they
 * stay testable without rebuilding the app.
 */

/** Shown when a build had no git metadata (tarball build, shallow clone). */
export const UNKNOWN = 'unknown';

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0-dev';
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA || UNKNOWN;
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE || '';

/** Truncates a SHA to the usual 7 characters for display. */
export function shortSha(sha: string = COMMIT_SHA, length = 7): string {
  if (!sha || sha === UNKNOWN) return UNKNOWN;
  return sha.slice(0, length);
}

/**
 * `0.1.0+a1b2c3d` — SemVer build metadata. This is the identity to quote when
 * reporting a problem: the version alone would match several deployments.
 */
export function formatBuildId(version: string = APP_VERSION, sha: string = COMMIT_SHA): string {
  const short = shortSha(sha);
  return short === UNKNOWN ? version : `${version}+${short}`;
}

/** ISO instant -> `YYYY-MM-DD`, or `''` when there is nothing usable. */
export function formatBuildDate(iso: string = BUILD_DATE): string {
  if (!iso) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match ? match[1] : '';
}

/** `v0.1.0 · a1b2c3d · 2026-09-11` — the one-line label rendered in the UI. */
export function versionLabel(
  version: string = APP_VERSION,
  sha: string = COMMIT_SHA,
  buildDate: string = BUILD_DATE
): string {
  const parts = [`v${version}`];
  const short = shortSha(sha);
  if (short !== UNKNOWN) parts.push(short);
  const date = formatBuildDate(buildDate);
  if (date) parts.push(date);
  return parts.join(' · ');
}

/**
 * `VeloPulse 0.1.0+a1b2c3d (2026-09-11)` — the provenance sentence stamped on
 * everything that leaves the app (TCX notes, JSON/CSV metadata, report footer).
 *
 * An exported file outlives the tab that produced it: without this, a report
 * that someone emails around cannot be traced back to a commit, and a bug in
 * the exporter becomes impossible to confirm against a specific build.
 */
export function buildProvenance(
  version: string = APP_VERSION,
  sha: string = COMMIT_SHA,
  buildDate: string = BUILD_DATE
): string {
  const id = formatBuildId(version, sha);
  const date = formatBuildDate(buildDate);
  return date ? `VeloPulse ${id} (${date})` : `VeloPulse ${id}`;
}

/**
 * `[build 0.1.0+a1b2c3d]` — appended to cloud-failure logs.
 *
 * Deliberately not shown in the UI: a commit SHA in a toast is noise to the
 * rider. It belongs in the console, where it is the first thing needed when
 * someone reports that sync broke.
 */
export function buildLogTag(
  version: string = APP_VERSION,
  sha: string = COMMIT_SHA
): string {
  return `[build ${formatBuildId(version, sha)}]`;
}
