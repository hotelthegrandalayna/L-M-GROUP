const NTFY_KEY = "ga_ntfy_config";
const NTFY_DEFAULTS = { enabled: false, topic: "" };

export function loadNtfyConfig() {
  try { return { ...NTFY_DEFAULTS, ...(JSON.parse(localStorage.getItem(NTFY_KEY) || "null") || {}) }; }
  catch { return { ...NTFY_DEFAULTS }; }
}

export function saveNtfyConfig(cfg) { localStorage.setItem(NTFY_KEY, JSON.stringify(cfg)); }

export async function sendNtfyAlert(title, message, topicOverride) {
  const cfg = loadNtfyConfig();
  const topic = topicOverride || cfg.topic;
  if (!topic) return;
  if (!topicOverride && !cfg.enabled) return;
  await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Title": encodeURIComponent(title),
      "Priority": "high",
      "Tags": "bell",
    },
    body: message,
  });
}
