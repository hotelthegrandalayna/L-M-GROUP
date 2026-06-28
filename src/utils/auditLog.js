import { hasSupabase, upsertRow } from "./supabaseSync";

const LOG_KEY = "app_audit_log";
const MAX_ENTRIES = 3000;

export function logEvent(scope, action, details = {}, actor = "") {
  try {
    const id = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const entry = {
      id,
      ts: new Date().toISOString(),
      scope,
      action,
      actor,
      ...details,
    };
    // Save locally
    const log = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    log.push(entry);
    if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
    // Sync to Supabase
    if (hasSupabase()) {
      upsertRow("audit_log", {
        id,
        ts: entry.ts,
        scope,
        action,
        actor: actor || "",
        details: details || {},
      }).catch(() => {});
    }
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
