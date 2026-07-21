import { hasSupabase, saveConfig, loadConfig } from "./supabaseSync";

const NTFY_KEY = "ga_ntfy_config";
const NTFY_DEFAULTS = { enabled: false, topic: "" };

export function loadNtfyConfig() {
  try { return { ...NTFY_DEFAULTS, ...(JSON.parse(localStorage.getItem(NTFY_KEY) || "null") || {}) }; }
  catch { return { ...NTFY_DEFAULTS }; }
}

export function saveNtfyConfig(cfg) {
  localStorage.setItem(NTFY_KEY, JSON.stringify(cfg));
  if (hasSupabase()) saveConfig("ntfy_config", cfg).catch(() => {});
}

export async function syncNtfyConfigFromSupabase() {
  if (!hasSupabase()) return;
  try {
    const val = await loadConfig("ntfy_config");
    if (val) localStorage.setItem(NTFY_KEY, JSON.stringify(val));
  } catch {}
}

// opts: { tags, priority }
//   tags — comma-separated ntfy emoji shortcodes (e.g. "green_circle") that
//          render as the notification icon; used here as a color code per event.
//   priority — ntfy priority (max/high/default/low/min).
export async function sendNtfyAlert(title, message, topicOverride, opts = {}) {
  const cfg = loadNtfyConfig();
  const topic = topicOverride || cfg.topic;
  if (!topic) return;
  if (!topicOverride && !cfg.enabled) return;
  // Strip non-ASCII from title for header safety, replace Bengali taka sign
  const safeTitle = title.replace(/৳/g, "BDT").replace(/[^\x00-\x7F]/g, "").replace(/\s+/g, " ").trim();
  const safeBody  = message.replace(/৳/g, "BDT");
  await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Title": safeTitle,
      "Priority": opts.priority || "high",
      "Tags": opts.tags || "bell",
    },
    body: safeBody,
  });
}
