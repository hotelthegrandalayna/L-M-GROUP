// Auto-update: guarantees no computer keeps running an old, unsafe version of
// the app. The running tab knows its own build stamp (baked in at build time)
// and polls /version.json. When the deployed version is newer, it reloads
// itself so every device always runs the latest, data-safe code.

const BUILD = typeof __BUILD_VERSION__ !== "undefined" ? String(__BUILD_VERSION__) : "dev";

async function checkNow() {
  try {
    const res = await fetch("/version.json?t=" + Date.now(), { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const latest = data && data.v ? String(data.v) : "";
    if (!latest || latest === BUILD) return;

    // A newer version is live. Don't interrupt someone mid-typing (e.g. filling
    // a booking form) — wait for the next check when the field isn't focused.
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;

    // Guard against reload loops if the browser fails to pick up the new build.
    const guard = "ga_updated_to_" + latest;
    if (sessionStorage.getItem(guard)) return;
    sessionStorage.setItem(guard, "1");
    window.location.reload();
  } catch {
    /* offline or version.json missing — ignore, try again later */
  }
}

export function startAutoUpdate() {
  // First check 15s after load (let initial sync settle), then every 2 minutes,
  // plus whenever the tab regains focus or the network comes back online.
  setTimeout(checkNow, 15000);
  setInterval(checkNow, 120000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkNow();
  });
  window.addEventListener("online", checkNow);
}
