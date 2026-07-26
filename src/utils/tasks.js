// Task / cleaning-schedule logic and cloud photo storage.
// Task definitions live in Supabase app_config ("hotel_tasks"); completion
// records in "hotel_task_done"; each proof photo is its own app_config row
// "taskphoto_<id>_<date>" (loaded on demand, auto-deleted after 7 days).

import { saveConfig, loadConfig, deleteConfig, listConfigKeys, hasSupabase } from "./supabaseSync";

export const PHOTO_TTL_DAYS = 7;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LABELS = DAY_NAMES;

// Local-date formatter (matches todayStr()). Must NOT use toISOString(), which
// converts to UTC and can shift the date by a day in +offset timezones (BD/DK).
function iso(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Is a task scheduled to occur on a given YYYY-MM-DD?
export function scheduledOn(task, dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  switch (task.freq) {
    case "daily":   return true;
    case "weekly":  return (task.days || []).includes(d.getDay());
    case "monthly": return d.getDate() === Number(task.date || 1);
    case "every15": {
      // Every 15 days, counted from the day the task was created.
      const anchor = (task.createdAt ? task.createdAt.slice(0, 10) : dateStr);
      const diff = Math.round((d - new Date(anchor + "T00:00:00")) / 86400000);
      return diff >= 0 && diff % 15 === 0;
    }
    case "once":    return dateStr === task.onceDate;
    default:        return false;
  }
}

// The earliest scheduled date on/before today that is NOT yet completed —
// i.e. the currently-pending occurrence. null if nothing is pending.
export function pendingDate(task, taskDone, todayStr, lookbackDays = 90) {
  const today = new Date(todayStr + "T00:00:00");
  const start = task.createdAt ? task.createdAt.slice(0, 10) : todayStr;
  for (let i = lookbackDays; i >= 0; i--) {
    const dStr = iso(addDays(today, -i));
    if (dStr < start) continue;
    if (scheduledOn(task, dStr) && !taskDone[`${task.id}_${dStr}`]) return dStr;
  }
  return null;
}

// All active tasks that are due today or overdue, with their pending date.
export function pendingTasks(tasks, taskDone, todayStr) {
  return (tasks || [])
    .filter(t => t && t.active !== false)
    .map(t => {
      const due = pendingDate(t, taskDone, todayStr);
      return due ? { task: t, due, overdue: due < todayStr } : null;
    })
    .filter(Boolean)
    .sort((a, b) => (a.due > b.due ? 1 : -1)); // oldest/most overdue first
}

export function freqLabel(task) {
  if (task.freq === "daily")   return "Daily";
  if (task.freq === "weekly")  return "Weekly · " + (task.days || []).map(d => DAY_NAMES[d]).join(", ");
  if (task.freq === "every15") return "Every 15 days";
  if (task.freq === "monthly") return "Monthly · day " + (task.date || 1);
  if (task.freq === "once")    return "One-time · " + (task.onceDate || "");
  return "";
}

// ── Proof photos (cloud, on-demand, auto-expiring) ──────────────────────────
export function photoKey(taskId, dateStr) { return `taskphoto_${taskId}_${dateStr}`; }

export async function saveTaskPhoto(taskId, dateStr, dataUrl) {
  if (!hasSupabase() || !dataUrl) return;
  await saveConfig(photoKey(taskId, dateStr), dataUrl);
}

export async function loadTaskPhoto(taskId, dateStr) {
  if (!hasSupabase()) return null;
  const v = await loadConfig(photoKey(taskId, dateStr));
  return typeof v === "string" ? v : null;
}

// Delete any proof photo older than PHOTO_TTL_DAYS. Runs on app open; since the
// app is opened daily, photos never pile up in storage.
export async function cleanupOldTaskPhotos() {
  if (!hasSupabase()) return;
  try {
    const keys = await listConfigKeys("taskphoto_");
    const cutoff = iso(addDays(new Date(), -PHOTO_TTL_DAYS));
    for (const key of keys) {
      const m = key.match(/_(\d{4}-\d{2}-\d{2})$/);
      if (m && m[1] < cutoff) await deleteConfig(key).catch(() => {});
    }
  } catch { /* ignore */ }
}
