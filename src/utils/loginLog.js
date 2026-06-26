const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim() || "";

function headers() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
}

function base() {
  return SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";
}

// Fetch past logins for a user to determine their normal pattern
async function getPastLogins(username) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await fetch(
      `${base()}/login_logs?username=eq.${encodeURIComponent(username)}&success=eq.true&order=created_at.desc&limit=50`,
      { headers: headers() }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// Save a login entry to Supabase
async function saveLoginEntry(entry) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  await fetch(`${base()}/login_logs`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(entry),
  });
}

// Fetch unusual logins for the admin panel
export async function getUnusualLogins() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return [];
  try {
    const res = await fetch(
      `${base()}/login_logs?is_unusual=eq.true&order=created_at.desc&limit=200`,
      { headers: headers() }
    );
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function recordLogin(username, success) {
  try {
    // Respect the admin on/off toggle
    const monitorEnabled = JSON.parse(localStorage.getItem("ga_login_monitor") ?? "true");
    if (!monitorEnabled) return;
    // Detect device/browser/OS
    const ua = navigator.userAgent;
    const device  = /mobile|android|iphone|ipad/i.test(ua) ? "Mobile" : "Desktop/Laptop";
    const browser =
      /edg\//i.test(ua)     ? "Edge"    :
      /chrome/i.test(ua)    ? "Chrome"  :
      /firefox/i.test(ua)   ? "Firefox" :
      /safari/i.test(ua)    ? "Safari"  :
      /opera|opr/i.test(ua) ? "Opera"   : "Unknown";
    const os =
      /windows/i.test(ua)     ? "Windows"    :
      /android/i.test(ua)     ? "Android"    :
      /iphone|ipad/i.test(ua) ? "iPhone/iPad":
      /mac/i.test(ua)         ? "Mac"        :
      /linux/i.test(ua)       ? "Linux"      : "Unknown";

    // Get IP geolocation
    let city = "Unknown", isp = "Unknown", country = "Unknown";
    try {
      const geo = await fetch("http://ip-api.com/json/?fields=city,isp,country,status", {
        signal: AbortSignal.timeout(4000),
      });
      const data = await geo.json();
      if (data.status === "success") {
        city    = data.city    || "Unknown";
        isp     = data.isp     || "Unknown";
        country = data.country || "Unknown";
      }
    } catch { /* geo failed — still log */ }

    // Check if this is unusual (only for successful logins)
    let is_unusual = false;
    if (success) {
      const past = await getPastLogins(username);
      if (past.length === 0) {
        // First ever login — record as baseline, not unusual
        is_unusual = false;
      } else {
        const knownCities = new Set(past.map(l => l.city));
        const knownIsps   = new Set(past.map(l => l.isp));
        // Unusual if BOTH city AND ISP are new (avoids false alerts from ISP changes alone)
        const newCity = !knownCities.has(city);
        const newIsp  = !knownIsps.has(isp);
        is_unusual = newCity || newIsp;
      }
    } else {
      // Failed login attempts are always flagged
      is_unusual = true;
    }

    const entry = { username, success, city, isp, country, device, browser, os, is_unusual };
    await saveLoginEntry(entry);

    // Send ntfy alert for unusual logins
    if (is_unusual) {
      const { sendNtfyAlert } = await import("./ntfy.js");
      const title = success
        ? `Unusual Login — ${username}`
        : `Failed Login Attempt — ${username}`;
      const msg = `User: ${username}\nStatus: ${success ? "Logged in" : "FAILED attempt"}\nCity: ${city}, ${country}\nNetwork: ${isp}\nDevice: ${device} · ${browser} · ${os}`;
      sendNtfyAlert(title, msg).catch(() => {});
    }
  } catch { /* never break the app */ }
}
