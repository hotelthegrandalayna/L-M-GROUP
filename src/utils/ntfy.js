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

// Priority names → ntfy numeric levels (used in the JSON publish body).
const PRIORITY_NUM = { max: 5, high: 4, default: 3, low: 2, min: 1 };
// Color code: the first tag maps to an emoji that goes INTO the title text, so
// it renders on every device — the old code sent tags via an HTTP header with
// mode:"no-cors", which the browser silently strips, so colors never arrived.
const TAG_EMOJI = {
  red_circle: "🔴", green_circle: "🟢", orange_circle: "🟠",
  blue_circle: "🔵", large_blue_circle: "🔵", purple_circle: "🟣",
  printer: "🖨️", bell: "🔔",
};

// opts: { tags, priority }
export async function sendNtfyAlert(title, message, topicOverride, opts = {}) {
  const cfg = loadNtfyConfig();
  const topic = topicOverride || cfg.topic;
  if (!topic) return;
  if (!topicOverride && !cfg.enabled) return;

  const firstTag = (opts.tags || "bell").split(",")[0].trim();
  const emoji = TAG_EMOJI[firstTag] || "";
  const titleTxt = (emoji ? emoji + " " : "") + title.replace(/৳/g, "BDT");
  const bodyTxt  = message.replace(/৳/g, "BDT");

  try {
    // Primary: JSON publish (emoji in title renders reliably; real CORS request)
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        title: titleTxt,
        message: bodyTxt,
        priority: PRIORITY_NUM[opts.priority || "high"] || 4,
        tags: opts.tags ? opts.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      }),
    });
    if (!res.ok) throw new Error("ntfy " + res.status);
  } catch {
    // Fallback: plain POST to the topic (simple request, no preflight). The
    // emoji is carried inside the body text so the color still shows.
    try {
      await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
        method: "POST",
        body: titleTxt + "\n\n" + bodyTxt,
      });
    } catch {}
  }
}
