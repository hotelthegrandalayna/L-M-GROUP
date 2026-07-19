// Instant cross-device sync via Supabase Realtime broadcast.
// After any device writes to the cloud it sends a tiny "changed" ping;
// every other device receives it within ~a second and pulls fresh data,
// instead of waiting for the 60s polling interval.
import { supabase } from "../lib/supabaseClient";

let channel = null;
const listeners = new Set();

function ensureChannel() {
  if (!supabase) return null;
  if (channel) return channel;
  channel = supabase.channel("live-sync", {
    config: { broadcast: { self: false } },
  });
  channel.on("broadcast", { event: "changed" }, () => {
    listeners.forEach((fn) => {
      try { fn(); } catch { /* one bad listener shouldn't stop others */ }
    });
  });
  channel.subscribe();
  return channel;
}

// Subscribe to "another device changed something" events.
// Returns an unsubscribe function.
export function onRemoteChange(fn) {
  listeners.add(fn);
  ensureChannel();
  return () => listeners.delete(fn);
}

// Tell all other devices to pull fresh data now.
export function pingRemoteChange() {
  try {
    const ch = ensureChannel();
    if (!ch) return;
    const p = ch.send({
      type: "broadcast",
      event: "changed",
      payload: { at: Date.now() },
    });
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch { /* realtime unavailable — polling still covers us */ }
}
