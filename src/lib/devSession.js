// ─────────────────────────────────────────────────────────────────────────────
// LOOKING AT THE APP WITHOUT SIGNING IN — and without touching a single row.
//
// The owner asked for a way to see the running app during development, on the
// condition that nothing in the live data changes. Two things are needed for
// that, and BOTH are in this file so neither can be enabled without the other:
//
//   1. a local session, so the staff sign-in is skipped, and
//   2. a hard read-only lock on every cloud write.
//
// The lock is not optional politeness. Opening the app fires runDailyBackup()
// after 90s and cleanupOldTaskPhotos() after 120s — a write and a DELETE against
// production, with nobody touching the keyboard.
//
// THIS CANNOT REACH THE LIVE SITE. Vite replaces `import.meta.env.DEV` with the
// literal `false` during `npm run build`, so every branch below folds to a
// constant and is dropped from the bundle. Netlify runs `npm run build`. The
// hostname check is a second, independent lock in case a dev build is ever
// served from somewhere other than a developer's own machine.
// ─────────────────────────────────────────────────────────────────────────────

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

/**
 * The stand-in session, or null when this is not a local dev machine.
 * Pure — takes its inputs so the guard itself can be tested.
 */
export function devSession(isDev, hostname) {
  if (isDev !== true) return null;
  if (!LOCAL_HOSTS.includes(String(hostname))) return null;
  return { user: "dev (read-only)", role: "admin" };
}

/** True when the app is running under the local dev session. */
export function isDevSession() {
  const host = typeof location !== "undefined" ? location.hostname : "";
  return devSession(import.meta.env.DEV, host) !== null;
}

/**
 * Every cloud write asks this first. Under the dev session it returns true and
 * the write is skipped — the screen still renders from data loaded READ-ONLY, so
 * the app is fully usable to look at while being unable to alter anything.
 */
export function blockCloudWrite(what) {
  if (!isDevSession()) return false;
  // eslint-disable-next-line no-console
  console.info(`[dev read-only] blocked cloud write: ${what}`);
  return true;
}
