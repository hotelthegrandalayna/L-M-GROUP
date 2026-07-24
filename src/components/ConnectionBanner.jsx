import { useState, useEffect } from "react";

// A loud, impossible-to-miss banner whenever the computer loses internet, so
// staff KNOW their saves are only local and not yet backed up to the cloud.
// Removes the "silent failure" trap entirely.
export default function ConnectionBanner() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  if (online) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      background: "#c0392b", color: "#fff", textAlign: "center",
      padding: "8px 14px", fontSize: 13, fontWeight: 800,
      fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,0,0,.3)",
      letterSpacing: .3,
    }}>
      ⚠ NO INTERNET — you are OFFLINE. Bookings are saved on this computer only and are NOT backed up yet. Keep the app open; they will upload automatically when internet returns.
    </div>
  );
}
