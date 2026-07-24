import { useState, useEffect } from "react";
import { pingSupabase } from "../utils/supabaseSync";

// A loud, impossible-to-miss banner whenever the app cannot reach the cloud —
// either because WiFi is off, OR because WiFi is on but the database server is
// unreachable (the exact case that silently lost the booking). Staff KNOW their
// saves are only local and not backed up yet, so nothing fails silently.
export default function ConnectionBanner() {
  const [reachable, setReachable] = useState(true);

  useEffect(() => {
    let alive = true;

    async function check() {
      // If the browser itself reports offline, we're definitely offline.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        if (alive) setReachable(false);
        return;
      }
      // Otherwise actually contact the database.
      const ok = await pingSupabase();
      if (alive) setReachable(ok);
    }

    check();
    const interval = setInterval(check, 12000); // check every 12s
    const onOnline = () => check();
    const onOffline = () => setReachable(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });

    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  if (reachable) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      background: "#c0392b", color: "#fff", textAlign: "center",
      padding: "9px 14px", fontSize: 13, fontWeight: 800,
      fontFamily: "inherit", boxShadow: "0 2px 10px rgba(0,0,0,.35)",
      letterSpacing: .3,
    }}>
      ⚠ NO CONNECTION TO CLOUD — new bookings are saved on this computer only and are NOT backed up yet. Do not rely on them until this red bar disappears. It will upload automatically when the connection returns.
    </div>
  );
}
