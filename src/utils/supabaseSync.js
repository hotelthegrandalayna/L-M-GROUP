// Shared Supabase sync utility — used by all modules
import { pingRemoteChange } from "./realtimeSync";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_KEY =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() || "";

import { blockCloudWrite } from "../lib/devSession";

export function hasSupabase() {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY,
    "Content-Type": "application/json",
    ...extra,
  };
}

function base(table) {
  return SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + table;
}

// Real reachability check: is the cloud database actually reachable RIGHT NOW?
// navigator.onLine only knows if WiFi is connected — not whether the database
// can be reached. This actually contacts Supabase, so it catches "WiFi is on
// but the server can't be reached" (the exact case that lost the booking).
export async function pingSupabase() {
  if (!hasSupabase()) return true; // no cloud configured — don't false-alarm
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(base("bookings") + "?select=id&limit=1", {
      headers: headers(),
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// Upsert a single row (insert or update by primary key)
export async function upsertRow(table, row, conflictCol = "id") {
  if (!hasSupabase() || blockCloudWrite(`upsertRow ${table}`)) return;
  await fetch(base(table), {
    method: "POST",
    headers: headers({ Prefer: `resolution=merge-duplicates,return=minimal` }),
    body: JSON.stringify(row),
  });
  pingRemoteChange();
}

// Upsert many rows in one request
export async function upsertRows(table, rows) {
  if (!hasSupabase() || !rows.length || blockCloudWrite(`upsertRows ${table}`)) return;
  await fetch(base(table), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
  });
  pingRemoteChange();
}

// Delete a row by id
export async function deleteRow(table, id) {
  if (!hasSupabase() || blockCloudWrite(`deleteRow ${table}`)) return;
  await fetch(`${base(table)}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
  });
  pingRemoteChange();
}

// Load all rows from a table
export async function loadRows(table, query = "") {
  if (!hasSupabase()) return null;
  try {
    const res = await fetch(`${base(table)}?order=created_at.asc${query}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Upsert a config value (key-value store). Throws if the write did not
// reach Supabase so callers can distinguish "synced" from "local only".
export async function saveConfig(key, value) {
  // Returns quietly rather than throwing: callers treat a throw as "sync failed"
  // and warn the user, which would be a lie — nothing was meant to be written.
  if (blockCloudWrite(`saveConfig ${key}`)) return;
  if (!hasSupabase()) throw new Error("Supabase not configured");
  const res = await fetch(base("app_config"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error("saveConfig failed: " + res.status);
  pingRemoteChange();
}

// Load a config value
export async function loadConfig(key) {
  if (!hasSupabase()) return null;
  try {
    const res = await fetch(`${base("app_config")}?key=eq.${encodeURIComponent(key)}`, {
      headers: headers(),
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.value ?? null;
  } catch { return null; }
}

// Delete a config row by key
export async function deleteConfig(key) {
  if (!hasSupabase() || blockCloudWrite(`deleteConfig ${key}`)) return;
  await fetch(`${base("app_config")}?key=eq.${encodeURIComponent(key)}`, {
    method: "DELETE",
    headers: headers(),
  });
}

// List config keys matching a prefix (used to find/expire task photos)
export async function listConfigKeys(prefix) {
  if (!hasSupabase()) return [];
  try {
    const res = await fetch(`${base("app_config")}?key=like.${encodeURIComponent(prefix + "*")}&select=key`, {
      headers: headers(),
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows.map(r => r.key) : [];
  } catch { return []; }
}
