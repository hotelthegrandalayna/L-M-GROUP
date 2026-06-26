const NTFY_KEY = "ga_ntfy_config";
const NTFY_DEFAULTS = { enabled: false, topic: "" };

export function loadNtfyConfig() {
  try { return { ...NTFY_DEFAULTS, ...(JSON.parse(localStorage.getItem(NTFY_KEY) || "null") || {}) }; }
  catch { return { ...NTFY_DEFAULTS }; }
}

export function saveNtfyConfig(cfg) { localStorage.setItem(NTFY_KEY, JSON.stringify(cfg)); }

export async function sendNtfyAlert(title, message) {
  const cfg = loadNtfyConfig();
  if (!cfg.enabled || !cfg.topic) return;
  try {
    await fetch(`https://ntfy.sh/${encodeURIComponent(cfg.topic)}`, {
      method: "POST",
      headers: { "Title": title, "Priority": "high", "Tags": "bell" },
      body: message,
    });
  } catch { /* silent fail — never block the main flow */ }
}
