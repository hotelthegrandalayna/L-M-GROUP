// Shared Supabase sync utility — used by all modules
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_KEY =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() || "";

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

// Upsert a single row (insert or update by primary key)
export async function upsertRow(table, row, conflictCol = "id") {
  if (!hasSupabase()) return;
  await fetch(base(table), {
    method: "POST",
    headers: headers({ Prefer: `resolution=merge-duplicates,return=minimal` }),
    body: JSON.stringify(row),
  });
}

// Upsert many rows in one request
export async function upsertRows(table, rows) {
  if (!hasSupabase() || !rows.length) return;
  await fetch(base(table), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(rows),
  });
}

// Delete a row by id
export async function deleteRow(table, id) {
  if (!hasSupabase()) return;
  await fetch(`${base(table)}?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(),
  });
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

// Upsert a config value (key-value store)
export async function saveConfig(key, value) {
  if (!hasSupabase()) return;
  await fetch(base("app_config"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
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
