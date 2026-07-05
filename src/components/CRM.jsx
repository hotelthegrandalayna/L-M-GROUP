import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { money, todayStr } from "../utils/helpers";

const PREFS = ["Non-smoking","Quiet room","High floor","Ground floor","Extra pillows",
               "Late check-out","Early check-in","Halal food","Extra towels","Room service"];

const WA_TEMPLATES = [
  { label:"Welcome Back",  icon:"👋", msg:"Assalamu Alaikum [NAME],\nWe miss you at Hotel The Grand Alayna! 🏨\nPlease come visit us again soon.\n📞 +8801883352526" },
  { label:"Special Offer", icon:"🎁", msg:"Dear [NAME],\nSpecial offer for our valued guests! 🌟\nBook this week for an exclusive discount.\n📞 +8801883352526\nhotelthegrandalayna.com" },
  { label:"Birthday Wish", icon:"🎂", msg:"Assalamu Alaikum [NAME],\n🎂 Wishing you a very Happy Birthday!\nCelebrate your special day with us!\n📞 +8801883352526" },
  { label:"Eid Greeting",  icon:"🌙", msg:"Eid Mubarak [NAME]! 🌙\nWishing you and your family a blessed Eid.\nSpecial Eid packages available!\n📞 +8801883352526" },
  { label:"Feedback",      icon:"⭐", msg:"Dear [NAME],\nThank you for staying with us 🙏\nWe'd love your feedback!\nYour review means a lot to us.\n📞 +8801883352526" },
];

const SEG = {
  vip:      { pill:"★ VIP",   bg:"rgba(201,168,76,.15)", border:"rgba(201,168,76,.5)",  color:"#8a6200", avatar:"linear-gradient(135deg,#c9a84c,#f0d060)" },
  regular:  { pill:"Regular", bg:"rgba(37,99,235,.1)",   border:"rgba(37,99,235,.3)",   color:"#1e40af", avatar:"linear-gradient(135deg,#2563eb,#60a5fa)" },
  new:      { pill:"New",     bg:"rgba(22,163,74,.1)",   border:"rgba(22,163,74,.3)",   color:"#166534", avatar:"linear-gradient(135deg,#16a34a,#4ade80)" },
  inactive: { pill:"Inactive",bg:"rgba(100,116,139,.1)", border:"rgba(100,116,139,.3)", color:"#475569", avatar:"linear-gradient(135deg,#64748b,#94a3b8)" } };

function waNum(phone) {
  const c = (phone || "").replace(/\D/g, "");
  return c.startsWith("88") ? c : "88" + (c.startsWith("0") ? c.slice(1) : c);
}
function initials(n) { return (n || "?").split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase(); }

function getSegment(g) {
  const done = g.stays.filter(s => s.status === "checked-out");
  const last  = done.sort((a, b) => b.checkin > a.checkin ? 1 : -1)[0];
  const days  = last ? Math.round((Date.now() - new Date(last.checkin)) / 86400000) : 9999;
  if (g.totalSpent >= 20000 || done.length >= 3) return "vip";
  if (done.length >= 2 && days < 90)             return "regular";
  if (done.length === 0 || days > 180)            return "inactive";
  return "new";
}
function birthdayMonth(g) {
  if (!g.savedProfile?.birthday) return false;
  return new Date(g.savedProfile.birthday).getMonth() === new Date().getMonth();
}

// ─── Guest Profile Modal ──────────────────────────────────────────────────────
function GuestModal({ gkey, g, onClose, onSave }) {
  const seg = getSegment(g);
  const ss  = SEG[seg] || SEG.new;
  const done = g.stays.filter(x => x.status === "checked-out").sort((a, b) => b.checkin > a.checkin ? 1 : -1);
  const avg  = done.length ? Math.round(g.totalSpent / done.length) : 0;
  const sp   = g.savedProfile || {};

  const [birthday,     setBirthday]     = useState(sp.birthday     || "");
  const [anniversary,  setAnniversary]  = useState(sp.anniversary  || "");
  const [notes,        setNotes]        = useState(sp.notes        || "");
  const [followUp,     setFollowUp]     = useState(sp.followUp     || false);
  const [followUpNote, setFollowUpNote] = useState(sp.followUpNote || "");
  const [marketingOk,  setMarketingOk]  = useState(sp.marketingOk !== false);
  const [selPrefs,     setSelPrefs]     = useState(() => new Set(sp.preferences || []));

  function togglePref(p) {
    setSelPrefs(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; });
  }

  function handleSave() {
    onSave(gkey, { birthday, anniversary, notes, preferences: [...selPrefs], followUp, followUpNote, marketingOk });
    onClose();
  }

  const waMsg = encodeURIComponent("Assalamu Alaikum " + g.name + ",\nThank you for staying at Hotel The Grand Alayna!\nWe hope to see you again soon.\n\n📞 +8801883352526");

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 580, maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: ss.avatar, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 19, flexShrink: 0 }}>
              {initials(g.name)}
            </div>
            <div>
              <div className="modal-title">{g.name}</div>
              <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: ss.bg, border: "1px solid " + ss.border, color: ss.color }}>{ss.pill}</span>
                {birthdayMonth(g) && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#fdf2f8", border: "1px solid #f9a8d4", color: "#be185d" }}>🎂 Birthday</span>}
                {followUp && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.4)", color: "#92400e" }}>Follow-up</span>}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 7, marginBottom: 14 }}>
          {[["Stays", g.stays.length], ["Nights", g.totalNights], ["Total", money(g.totalSpent)], ["Avg/Stay", money(avg)]].map(([l, v]) => (
            <div key={l} style={{ background: "var(--panel)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>{v}</div>
              <div style={{ fontSize: 10, color: "var(--text3)" }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Contact + Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div className="form-section" style={{ margin: 0 }}>
            <div className="form-sec-title">Contact</div>
            <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>Phone</span><strong>{g.phone || "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>Nationality</span><strong>{g.nationality || "—"}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)" }}>ID</span><strong>{g.idType || "—"}{g.idNum ? " · " + g.idNum : ""}</strong></div>
            </div>
          </div>
          <div className="form-section" style={{ margin: 0 }}>
            <div className="form-sec-title">Dates</div>
            <div className="form-group" style={{ marginBottom: 7 }}>
              <label>Birthday</label>
              <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Anniversary</label>
              <input type="date" value={anniversary} onChange={e => setAnniversary(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Room Preferences */}
        <div className="form-section" style={{ marginBottom: 12 }}>
          <div className="form-sec-title">Room Preferences</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {PREFS.map(p => (
              <button key={p} type="button" onClick={() => togglePref(p)} style={{
                padding: "5px 11px", borderRadius: 20, border: "1.5px solid", fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: selPrefs.has(p) ? "var(--navy)" : "transparent",
                borderColor: selPrefs.has(p) ? "var(--navy)" : "var(--border)",
                color: selPrefs.has(p) ? "var(--gold)" : "var(--text3)" }}>{p}</button>
            ))}
          </div>
        </div>

        {/* Notes + Flags */}
        <div className="form-section" style={{ marginBottom: 12 }}>
          <div className="form-sec-title">Staff Notes</div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Notes visible to staff only..." style={{ width: "100%", resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={followUp} onChange={e => setFollowUp(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "var(--gold)" }} />
              Mark for Follow-up
            </label>
            {followUp && (
              <input value={followUpNote} onChange={e => setFollowUpNote(e.target.value)}
                placeholder="Follow-up reason..." style={{ fontSize: 12 }} />
            )}
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={marketingOk} onChange={e => setMarketingOk(e.target.checked)}
                style={{ width: 15, height: 15, accentColor: "var(--gold)" }} />
              OK to send marketing messages
            </label>
          </div>
        </div>

        {/* Stay History */}
        <div className="form-section" style={{ marginBottom: 0 }}>
          <div className="form-sec-title">Stay History</div>
          {done.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13 }}>No completed stays yet</div>}
          {done.map((x, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", marginTop: 5, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600 }}>Room {x.room} · {x.checkin} → {x.checkout}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>{x.nights}n · {money(x.amount)} · {x.source || "Walk-in"}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <a href={"https://wa.me/" + waNum(g.phone) + "?text=" + waMsg} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <button className="btn" style={{ background: "#25d366", borderColor: "#25d366", color: "#fff" }}>
              <i className="ti ti-brand-whatsapp" /> WhatsApp
            </button>
          </a>
          <button className="btn primary" onClick={handleSave}>
            <i className="ti ti-device-floppy" /> Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Marketing Hub Modal ──────────────────────────────────────────────────────
function MarketingModal({ guests, onClose }) {
  const [audience,  setAudience]  = useState("all");
  const [tplIdx,    setTplIdx]    = useState(0);
  const [customMsg, setCustomMsg] = useState("");

  const AUDIENCES = [
    { key: "all",      label: "All Guests",   fn: () => true },
    { key: "vip",      label: "VIP Only",     fn: g => getSegment(g) === "vip" },
    { key: "inactive", label: "Inactive",     fn: g => getSegment(g) === "inactive" },
    { key: "birthday", label: "Birthdays",    fn: g => birthdayMonth(g) },
    { key: "followup", label: "Follow-up",    fn: g => g.savedProfile?.followUp },
  ];

  const af       = AUDIENCES.find(a => a.key === audience);
  const filtered = guests.filter(g => g.savedProfile?.marketingOk !== false && af.fn(g));
  const tpl      = WA_TEMPLATES[tplIdx];
  const msgToUse = customMsg.trim() || tpl.msg;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 560, maxHeight: "92vh", overflowY: "auto" }}>
        <div className="modal-header">
          <div className="modal-title">📣 Marketing Hub</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div className="form-group">
          <label>Audience</label>
          <select value={audience} onChange={e => setAudience(e.target.value)}>
            {AUDIENCES.map(a => (
              <option key={a.key} value={a.key}>
                {a.label} ({guests.filter(g => g.savedProfile?.marketingOk !== false && a.fn(g)).length})
              </option>
            ))}
          </select>
        </div>
        <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>
          {filtered.length} guest{filtered.length !== 1 ? "s" : ""} will receive this message
        </div>

        <div className="form-group">
          <label>Template</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {WA_TEMPLATES.map((t, i) => (
              <button key={i} type="button" onClick={() => { setTplIdx(i); setCustomMsg(""); }} style={{
                padding: "5px 11px", borderRadius: 20, border: "1.5px solid", fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: tplIdx === i && !customMsg ? "var(--navy)" : "transparent",
                borderColor: tplIdx === i && !customMsg ? "var(--navy)" : "var(--border)",
                color: tplIdx === i && !customMsg ? "var(--gold)" : "var(--text3)" }}>{t.icon} {t.label}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Message (use [NAME] as placeholder)</label>
          <textarea value={customMsg || tpl.msg} onChange={e => setCustomMsg(e.target.value)} rows={5} style={{ resize: "vertical" }} />
        </div>

        <div style={{ background: "var(--bg4)", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", marginBottom: 8 }}>
            Open WhatsApp for each recipient
          </div>
          {filtered.length === 0 && <div style={{ fontSize: 12, color: "var(--text3)" }}>No guests match this audience</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
            {filtered.map(g => {
              const msg = encodeURIComponent(msgToUse.replace(/\[NAME\]/g, g.name));
              return (
                <a key={g.phone} href={"https://wa.me/" + waNum(g.phone) + "?text=" + msg}
                  target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--panel)", cursor: "pointer" }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {g.name} <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>{g.phone}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#25d366" }}>Open WhatsApp →</span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CRM ─────────────────────────────────────────────────────────────────
export default function CRM() {
  const { bookings, guestProfiles, updateGuests } = useApp();
  const [seg,     setSeg]     = useState("all");
  const [search,  setSearch]  = useState("");
  const [selKey,  setSelKey]  = useState(null);
  const [showMkt, setShowMkt] = useState(false);

  // Build guest map from bookings
  const guestMap = useMemo(() => {
    const map = {};
    bookings.filter(b => b.status !== "cancelled" && b.phone).forEach(b => {
      const key = b.phone.replace(/\D/g, "");
      if (!map[key]) map[key] = {
        key, phone: b.phone, name: b.guest, nationality: b.nationality || "",
        idType: b.idType || "", idNum: b.idNum || "",
        stays: [], totalSpent: 0, totalNights: 0,
        savedProfile: (guestProfiles || {})[key] || {} };
      map[key].stays.push({
        id: b.id, checkin: b.checkin, checkout: b.checkout,
        room: b.room, amount: b.invoiceTotal ?? b.amount,
        nights: b.nights || 0, status: b.status, source: b.source || "" });
      map[key].totalSpent  += (b.invoiceTotal ?? b.amount) || 0;
      map[key].totalNights += b.nights || 0;
      map[key].name = b.guest; // keep latest name
    });
    return map;
  }, [bookings, guestProfiles]);

  const gList = useMemo(() => Object.values(guestMap), [guestMap]);

  // Counts
  const vipCount      = gList.filter(g => getSegment(g) === "vip").length;
  const returningCount = gList.filter(g => getSegment(g) === "regular").length;
  const inactiveCount = gList.filter(g => getSegment(g) === "inactive").length;

  const SEGS = [
    { key: "all",      label: "All Guests" },
    { key: "vip",      label: "★ VIP" },
    { key: "regular",  label: "Regular" },
    { key: "new",      label: "New" },
    { key: "inactive", label: "Inactive" },
    { key: "birthday", label: "🎂 Birthday" },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gList.filter(g => {
      if (q && !g.name.toLowerCase().includes(q) && !g.phone.includes(q)) return false;
      if (seg === "all")      return true;
      if (seg === "birthday") return birthdayMonth(g);
      return getSegment(g) === seg;
    }).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [gList, seg, search]);

  function saveProfile(key, data) {
    const next = { ...(guestProfiles || {}), [key]: { ...((guestProfiles || {})[key] || {}), ...data } };
    updateGuests(next);
  }

  function exportCSV() {
    const rows = [["Name","Phone","Segment","Nationality","Stays","Nights","Total Spent","Last Stay","Birthday","Anniversary","Preferences","Notes","Marketing OK","Follow-up"]];
    gList.forEach(g => {
      const sp   = g.savedProfile || {};
      const last = g.stays.filter(x => x.status === "checked-out").sort((a, b) => b.checkin > a.checkin ? 1 : -1)[0];
      rows.push([
        g.name, g.phone, getSegment(g), g.nationality,
        g.stays.length, g.totalNights, g.totalSpent,
        last?.checkout || "", sp.birthday || "", sp.anniversary || "",
        (sp.preferences || []).join("|"),
        (sp.notes || "").replace(/,/g, " "),
        sp.marketingOk !== false ? "Yes" : "No",
        sp.followUp ? "Yes" : "No",
      ]);
    });
    const csv = rows.map(r => r.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "guests_" + todayStr() + ".csv";
    a.click();
  }

  const selGuest = selKey ? guestMap[selKey] : null;

  return (
    <div style={{ padding: "22px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display',serif", color: "var(--navy)" }}>Guest CRM</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>{gList.length} unique guests</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn sm gold" onClick={() => setShowMkt(true)}>
            <i className="ti ti-speakerphone" /> Marketing Hub
          </button>
          <button className="btn sm" onClick={exportCSV}>
            <i className="ti ti-download" /> Export CSV
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        {[
          { label: "Total Guests",  value: gList.length,    sub: "Unique guests",         icon: "ti-users",   cls: "metric gold" },
          { label: "VIP Guests",    value: vipCount,        sub: "৳20k+ or 3+ stays",     icon: "ti-crown",   cls: "metric" },
          { label: "Returning",     value: returningCount,  sub: "Stayed 2+ times",        icon: "ti-repeat",  cls: "metric blue" },
          { label: "Inactive",      value: inactiveCount,   sub: "No visit in 6+ months",  icon: "ti-clock",   cls: "metric amber" },
        ].map(m => (
          <div key={m.label} className={m.cls}>
            <div className="metric-icon"><i className={"ti " + m.icon} /></div>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className="metric-sub">{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {SEGS.map(s => (
          <button key={s.key} onClick={() => setSeg(s.key)}
            className={"seg-btn" + (seg === s.key ? " active" : "")}>{s.label}</button>
        ))}
        <div style={{ position: "relative", flex: 1, maxWidth: 220 }}>
          <i className="ti ti-search" style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 13 }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search guest..." style={{ paddingLeft: 28, width: "100%", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Guest cards */}
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text3)", padding: 48, fontSize: 14 }}>
          {gList.length === 0 ? "No guests yet — bookings will appear here." : "No guests match this filter."}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {filtered.map(g => {
          const s    = getSegment(g);
          const ss   = SEG[s] || SEG.new;
          const sp   = g.savedProfile || {};
          const done = g.stays.filter(x => x.status === "checked-out").sort((a, b) => b.checkin > a.checkin ? 1 : -1);
          const last = done[0];
          const current = g.stays.find(x => x.status === "checked-in");
          const days = last ? Math.round((Date.now() - new Date(last.checkin)) / 86400000) : null;
          const waMsg = encodeURIComponent("Assalamu Alaikum " + g.name + ",\nThank you for staying at Hotel The Grand Alayna!\nWe hope to welcome you back soon.\n\n📞 +8801883352526");

          return (
            <div key={g.key} className="guest-card" onClick={() => setSelKey(g.key)} style={{ cursor: "pointer" }}>
              {/* Avatar + name + badges */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 11, marginBottom: 11 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: ss.avatar, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>
                  {initials(g.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{g.phone}</div>
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: ss.bg, border: "1px solid " + ss.border, color: ss.color }}>{ss.pill}</span>
                    {birthdayMonth(g) && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 20, background: "#fdf2f8", color: "#be185d", border: "1px solid #f9a8d4" }}>🎂</span>}
                    {current && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "rgba(22,163,74,.1)", color: "var(--green)", border: "1px solid rgba(22,163,74,.3)" }}>In-house</span>}
                    {sp.followUp && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: "rgba(245,158,11,.1)", color: "#92400e", border: "1px solid rgba(245,158,11,.3)" }}>Follow-up</span>}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                {[["Stays", g.stays.length], ["Nights", g.totalNights], ["Spent", "৳" + (g.totalSpent / 1000).toFixed(0) + "k"]].map(([l, v]) => (
                  <div key={l} style={{ background: "var(--bg4)", borderRadius: 6, padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "var(--navy)" }}>{v}</div>
                    <div style={{ fontSize: 9, color: "var(--text3)", textTransform: "uppercase", fontWeight: 600 }}>{l}</div>
                  </div>
                ))}
              </div>

              {/* Notes snippet */}
              {sp.notes && (
                <div style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg3)", borderRadius: 5, padding: "5px 7px", marginBottom: 9, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                  {sp.notes}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>
                  {current ? "Staying now" : last ? days + "d ago" : "No stays yet"}
                </div>
                <a href={"https://wa.me/" + waNum(g.phone) + "?text=" + waMsg}
                  target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ textDecoration: "none" }}>
                  <button style={{ padding: "5px 10px", borderRadius: 8, border: "none", background: "#25d366", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    WhatsApp
                  </button>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: "var(--text3)" }}>
        <i className="ti ti-list" /> {filtered.length} of {gList.length} guests
      </div>

      {selGuest && (
        <GuestModal gkey={selGuest.key} g={selGuest} onClose={() => setSelKey(null)} onSave={saveProfile} />
      )}
      {showMkt && <MarketingModal guests={gList} onClose={() => setShowMkt(false)} />}
    </div>
  );
}
