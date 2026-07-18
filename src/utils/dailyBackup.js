import { hasSupabase, saveConfig } from "./supabaseSync";

// Rolling 7-day cloud backup: once per day, a full snapshot of all business
// data is written to Supabase app_config under daily_backup_<weekday>.
// Even a catastrophic mistake (bad delete, corrupted cache) is recoverable
// from the last 7 days. Heavy image fields are stripped to keep size sane.

const KEYS = [
  "ga_bookings", "ga_revenues", "ga_expenses", "ga_exp_types", "ga_companions", "ga_guests",
  "a_inv", "a_exp", "a_hall_rev", "a_crm_leads", "a_exp_types_v2",
];
const STRIP = new Set(["idFront", "idBack", "idDocs", "fileData", "image_front", "image_back"]);

function stripHeavy(value) {
  if (Array.isArray(value)) return value.map(stripHeavy);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => { if (!STRIP.has(k)) out[k] = stripHeavy(v); });
    return out;
  }
  return value;
}

export function runDailyBackup() {
  try {
    if (!hasSupabase()) return;
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("ga_last_backup") === today) return;
    const snapshot = { at: new Date().toISOString() };
    KEYS.forEach(k => {
      try {
        const v = JSON.parse(localStorage.getItem(k) || "null");
        if (v) snapshot[k] = stripHeavy(v);
      } catch {}
    });
    const day = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date().getDay()];
    saveConfig("daily_backup_" + day, snapshot)
      .then(() => localStorage.setItem("ga_last_backup", today))
      .catch(() => {});
  } catch {}
}
