// Cross-device password sync.
// Password overrides live in localStorage as a_pass_<user> (unchanged),
// and are mirrored to the Supabase app_config key "user_passwords" so a
// password changed on one device is accepted on every other device.
import { hasSupabase, saveConfig, loadConfig } from "./supabaseSync";

const CONFIG_KEY = "user_passwords";
const LOCAL_MAP = "ga_pass_map";

// Saves locally first (so this device always works), then pushes to the
// cloud. Throws if the cloud push fails so the UI can warn the user that
// other devices have NOT received the change yet.
export async function setUserPass(user, pw) {
  localStorage.setItem("a_pass_" + user, pw);
  const map = collectLocalPasswords();
  map[user] = pw;
  localStorage.setItem(LOCAL_MAP, JSON.stringify(map));
  await saveConfig(CONFIG_KEY, map);
}

// Gather every password override this device knows about — both the
// synced map and any pre-sync a_pass_* keys left from older versions.
export function collectLocalPasswords() {
  let map = {};
  try { map = JSON.parse(localStorage.getItem(LOCAL_MAP) || "{}"); } catch { /* ignore */ }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("a_pass_")) {
      const user = k.slice("a_pass_".length);
      const v = localStorage.getItem(k);
      if (user && v) map[user] = v;
    }
  }
  return map;
}

// Pull the shared password map on app start so this device accepts
// passwords changed elsewhere.
export async function restoreUserPasswords() {
  if (!hasSupabase()) return;
  try {
    const v = await loadConfig(CONFIG_KEY);
    if (v && typeof v === "object") {
      Object.keys(v).forEach((u) => {
        if (typeof v[u] === "string" && v[u]) {
          localStorage.setItem("a_pass_" + u, v[u]);
        }
      });
      localStorage.setItem(LOCAL_MAP, JSON.stringify(v));
    }
  } catch { /* offline — local passwords still work */ }
}
