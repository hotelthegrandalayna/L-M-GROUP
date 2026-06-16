// Append-only activity log shared by the Hotel and Hall apps.
// Every money-relevant action (booking/invoice created, confirmed, payment
// collected, edited, cancelled) gets recorded here with who did it and when,
// so mismatches between what staff tell a guest and what's in the system are
// traceable after the fact — staff cannot delete individual entries, only an
// admin (password-gated by the caller) can wipe the whole log.

const LOG_KEY = "app_audit_log";
const MAX_ENTRIES = 3000;

export function logEvent(scope, action, details = {}, actor = "") {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    log.push({
      id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      ts: new Date().toISOString(),
      scope,   // "hall" | "hotel"
      action,  // e.g. "invoice_created", "invoice_confirmed", "payment_collected"
      actor,   // logged-in username at the time of the action
      ...details,
    });
    if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch { /* never let logging break the app */ }
}

export function getAuditLog(scope) {
  try {
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    return scope ? log.filter(e => e.scope === scope) : log;
  } catch { return []; }
}

export function clearAuditLog() {
  try { localStorage.removeItem(LOG_KEY); } catch {}
}
