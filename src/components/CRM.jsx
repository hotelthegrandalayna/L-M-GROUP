import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { money, todayStr } from "../utils/helpers";
import GuestFeedback from "./GuestFeedback";
import {
  buildGuests, guestStage, guestFacts, crmMetrics, stageBreakdown,
  actionQueue, logContact, sourceBreakdown, STAGES, STAGE_ORDER,
} from "../lib/crm";

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
  const seg = guestStage(g, todayStr());
  const ss  = { pill: STAGES[seg].label, bg: STAGES[seg].bg, border: STAGES[seg].bg, color: STAGES[seg].color,
                avatar: "linear-gradient(135deg,#4a2ea8,#7c5fd6)" };
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
  const [audience,  setAudience]  = useState("fresh");
  const [tplIdx,    setTplIdx]    = useState(0);
  const [customMsg, setCustomMsg] = useState("");

  // Audiences follow the same stages as the rest of the screen, so "send to the
  // 28 first-time guests" is one choice rather than a guess at who "all" means.
  const today = todayStr();
  const AUDIENCES = [
    { key: "fresh",     label: "First stay — recent",   fn: g => guestStage(g, today) === "fresh" },
    { key: "cooling",   label: "Cooling — 1–3 months",  fn: g => guestStage(g, today) === "cooling" },
    { key: "champion",  label: "Champions",             fn: g => guestStage(g, today) === "champion" },
    { key: "returning", label: "Returning",             fn: g => guestStage(g, today) === "returning" },
    { key: "lapsed",    label: "Lapsed",                fn: g => guestStage(g, today) === "lapsed" },
    { key: "birthday",  label: "Birthdays this month",  fn: g => birthdayMonth(g) },
    { key: "followup",  label: "Marked for follow-up",  fn: g => g.savedProfile?.followUp },
    { key: "all",       label: "Everyone",              fn: () => true },
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

// ─── Small pieces of the new screen ──────────────────────────────────────────
const StagePill = ({ stage }) => {
  const s = STAGES[stage] || STAGES.lapsed;
  return <span style={{ fontSize:10.5, fontWeight:800, padding:"3px 10px", borderRadius:20,
    background:s.bg, color:s.color, whiteSpace:"nowrap" }}>{s.label}</span>;
};

/** One row of the daily action list: who, why, and the message ready to send. */
function ActionRow({ a, n, onSend, onSnooze }) {
  const g = a.guest;
  const tone = a.priority === 1 ? "#DC2626" : a.priority === 2 ? "#C9983A" : "#4a2ea8";
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:13, padding:"13px 16px", borderBottom:"1px solid var(--border)" }}>
      <span style={{ width:24, height:24, borderRadius:7, background:tone, color:"#fff", flexShrink:0,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, marginTop:2 }}>{n}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:14, fontWeight:700 }}>{g.name}</span>
          <StagePill stage={a.stage} />
        </div>
        <div style={{ fontSize:12.5, color:"var(--text2)", marginTop:3 }}>{a.reason}</div>
        <div style={{ fontSize:11.5, color:"var(--text3)", background:"var(--bg4)", border:"1px dashed var(--border)",
          borderRadius:8, padding:"8px 11px", marginTop:8, lineHeight:1.5, fontStyle:"italic" }}>{a.message}</div>
      </div>
      <div style={{ display:"flex", gap:7, flexShrink:0, alignItems:"center" }}>
        <button onClick={() => onSnooze(a)} title="Not now — hide for two weeks"
          style={{ background:"#fff", border:"1.5px solid var(--border)", color:"var(--text3)", borderRadius:8,
            padding:"7px 11px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Later</button>
        <a href={"https://wa.me/" + waNum(g.phone) + "?text=" + encodeURIComponent(a.message)}
          target="_blank" rel="noreferrer" onClick={() => onSend(a)} style={{ textDecoration:"none" }}>
          <button style={{ background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:"8px 15px",
            fontSize:12.5, fontWeight:800, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>WhatsApp</button>
        </a>
      </div>
    </div>
  );
}

// ─── Main CRM ─────────────────────────────────────────────────────────────────
export default function CRM() {
  const { bookings, guestProfiles, updateGuests, curUser } = useApp();
  const [seg,     setSeg]     = useState("all");
  const [search,  setSearch]  = useState("");
  const [selKey,  setSelKey]  = useState(null);
  const [showMkt, setShowMkt] = useState(false);
  const [showAllGuests, setShowAllGuests] = useState(false);
  const today = todayStr();

  const guestMap = useMemo(() => buildGuests(bookings, guestProfiles), [bookings, guestProfiles]);
  const gList    = useMemo(() => Object.values(guestMap), [guestMap]);
  const metrics  = useMemo(() => crmMetrics(gList, today), [gList, today]);
  const stages   = useMemo(() => stageBreakdown(gList, today), [gList, today]);
  const queue    = useMemo(() => actionQueue(gList, today, 6), [gList, today]);
  const channels = useMemo(() => sourceBreakdown(bookings), [bookings]);

  // Contacting a guest records it, so the same person is not messaged twice by
  // two different people on the same morning.
  function markContacted(a) {
    const key = a.guest.key;
    const next = { ...(guestProfiles || {}),
      [key]: logContact((guestProfiles || {})[key] || {}, a.kind, today, curUser || "") };
    updateGuests(next);
  }

  const SEGS = [
    { key:"all", label:"All" },
    ...STAGE_ORDER.map(k => ({ key:k, label:STAGES[k].short })),
    { key:"owed", label:"Owes money" },
    { key:"birthday", label:"🎂 Birthday" },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return gList.filter(g => {
      if (q && !g.name.toLowerCase().includes(q) && !g.phone.includes(q)) return false;
      if (seg === "all")      return true;
      if (seg === "birthday") return birthdayMonth(g);
      if (seg === "owed")     return (g.due || 0) > 0;
      return guestStage(g, today) === seg;
    }).sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
  }, [gList, seg, search, today]);

  const shownGuests = showAllGuests ? filtered : filtered.slice(0, 12);

  function saveProfile(key, data) {
    const next = { ...(guestProfiles || {}), [key]: { ...((guestProfiles || {})[key] || {}), ...data } };
    updateGuests(next);
  }

  function exportCSV() {
    const rows = [["Name","Phone","Stage","Nationality","Stays","Nights","Total Spent","Owed","Last Stay","Birthday","Anniversary","Preferences","Notes","Marketing OK","Follow-up"]];
    gList.forEach(g => {
      const sp   = g.savedProfile || {};
      const last = g.stays.filter(x => x.status === "checked-out").sort((a, b) => b.checkin > a.checkin ? 1 : -1)[0];
      rows.push([
        g.name, g.phone, STAGES[guestStage(g, today)].short, g.nationality,
        g.stays.length, g.totalNights, g.totalSpent, g.due || 0,
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
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Playfair Display',serif", color: "var(--navy)" }}>Guests</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            {metrics.guests} guests · {money(metrics.revenue)} lifetime
            {metrics.owed > 0 && <> · <span style={{ color:"var(--red2)", fontWeight:600 }}>{money(metrics.owed)} owed</span></>}
          </div>
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

      {/* ── Three numbers that decide a small hotel ────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:12, marginBottom:16 }}>
        {[
          { l:"Repeat rate", v:metrics.repeatRate + "%",
            d:`${metrics.repeat} of ${metrics.guestsWithStay} guests came back`,
            note:"independent hotels run 20–30%",
            bar:Math.min(100, metrics.repeatRate * 3.3), tone: metrics.repeatRate >= 20 ? "#166534" : "#DC2626" },
          { l:"Guest value", v:money(metrics.avgValue),
            d:`average across ${metrics.guests} guests`,
            note:`top ${metrics.topN} bring ${metrics.topShare}% of revenue`,
            bar:metrics.topShare, tone:"#C9983A" },
          // Deliberately the SHORT list, not everyone who could be messaged.
          // "47 to contact" is not something a person can act on this morning;
          // six is. The rest are offered as one campaign, further down.
          { l:"To contact today", v:queue.actions.length,
            d: queue.actions.length ? "ranked below, each message written" : "nothing needs you right now",
            note: queue.remaining.length
              ? `${queue.remaining.length} more can go as one campaign`
              : (metrics.owed > 0 ? money(metrics.owed) + " outstanding" : "no money outstanding"),
            bar: Math.min(100, queue.actions.length * 16), tone:"#4a2ea8" },
        ].map(m => (
          <div key={m.l} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12,
            padding:"15px 17px", position:"relative", overflow:"hidden" }}>
            <span style={{ position:"absolute", left:0, top:0, bottom:0, width:4, background:m.tone }} />
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:1, textTransform:"uppercase", color:"var(--text3)" }}>{m.l}</div>
            <div style={{ fontSize:30, fontWeight:600, lineHeight:1, margin:"8px 0 5px", color:m.tone, fontVariantNumeric:"tabular-nums" }}>{m.v}</div>
            <div style={{ fontSize:11.5, color:"var(--text2)" }}>{m.d}</div>
            <div style={{ height:5, borderRadius:3, background:"var(--bg3)", margin:"9px 0 5px", overflow:"hidden" }}>
              <div style={{ width:m.bar + "%", height:"100%", background:m.tone, borderRadius:3 }} />
            </div>
            <div style={{ fontSize:10.5, color:"var(--text3)" }}>{m.note}</div>
          </div>
        ))}
      </div>

      {/* ── Today's actions — the reason to open this tab ──────────────────── */}
      <div className="panel" style={{ margin:"0 0 16px", border:"1px solid var(--border)", borderRadius:12 }}>
        <div className="panel-header" style={{ padding:"13px 16px", display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:1, textTransform:"uppercase", color:"var(--text2)" }}>Today's guest actions</span>
          {queue.actions.length > 0 &&
            <span style={{ fontSize:11.5, color:"var(--text3)" }}>{queue.actions.length} worth doing</span>}
          <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text3)" }}>each opens WhatsApp with the message written</span>
        </div>
        {queue.actions.length === 0 ? (
          <div style={{ padding:"30px 16px", textAlign:"center", color:"var(--text3)", fontSize:13 }}>
            Nothing needs chasing today. Guests appear here when they arrive, check out, owe money or go quiet.
          </div>
        ) : queue.actions.map((a, i) => (
          <ActionRow key={a.key} a={a} n={i + 1} onSend={markContacted} onSnooze={markContacted} />
        ))}
        {queue.remaining.length > 0 && (
          <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:11, background:"var(--bg4)", flexWrap:"wrap" }}>
            <span style={{ fontSize:12.5, color:"var(--text2)" }}>
              <strong>{queue.remaining.length} more</strong> guests are worth a message — send to them as one group
            </span>
            <button className="btn sm gold" style={{ marginLeft:"auto" }} onClick={() => setShowMkt(true)}>
              <i className="ti ti-speakerphone" /> Open campaign
            </button>
          </div>
        )}
      </div>

      {/* ── Where the guests are ───────────────────────────────────────────── */}
      <div className="panel" style={{ margin:"0 0 16px", border:"1px solid var(--border)", borderRadius:12 }}>
        <div className="panel-header" style={{ padding:"13px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:1, textTransform:"uppercase", color:"var(--text2)" }}>Guest lifecycle</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text3)" }}>click a band to filter the list below</span>
        </div>
        <div style={{ padding:"10px 16px 14px" }}>
          {stages.map(s => {
            const pct = metrics.guests ? Math.round(s.count / metrics.guests * 100) : 0;
            return (
              <div key={s.key} onClick={() => setSeg(seg === s.key ? "all" : s.key)}
                style={{ display:"flex", alignItems:"center", gap:11, padding:"6px 0", cursor:"pointer",
                  opacity: seg === "all" || seg === s.key ? 1 : .45 }}>
                <span style={{ width:104, fontSize:12.5, fontWeight:700, flexShrink:0 }}>{s.label}</span>
                <span style={{ flex:1, height:24, borderRadius:6, background:"var(--bg3)", overflow:"hidden", position:"relative" }}>
                  <span style={{ position:"absolute", left:0, top:0, bottom:0, borderRadius:6,
                    width: Math.max(s.count ? 6 : 0, pct) + "%", background:s.color, opacity:.9,
                    display:"flex", alignItems:"center", paddingLeft:9, color:"#fff", fontSize:11.5, fontWeight:800 }}>
                    {s.count || ""}
                  </span>
                </span>
                <span style={{ width:110, textAlign:"right", fontSize:11.5, color:"var(--text3)", flexShrink:0 }}>
                  {s.value ? money(s.value) : "—"}
                </span>
              </div>
            );
          })}
          {stages.find(s => s.key === "fresh")?.count > 0 && (
            <div style={{ marginTop:11, paddingTop:11, borderTop:"1px solid var(--border)", fontSize:12.5, color:"var(--text2)", lineHeight:1.6 }}>
              <strong style={{ color:"var(--navy)" }}>{stages.find(s => s.key === "fresh").count} guests stayed in the last 30 days.</strong>{" "}
              That is where second stays come from, and the window closes a little every week.
            </div>
          )}
        </div>
      </div>

      {/* ── Where guests come from ─────────────────────────────────────────── */}
      <div className="panel" style={{ margin:"0 0 16px", border:"1px solid var(--border)", borderRadius:12 }}>
        <div className="panel-header" style={{ padding:"13px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:11, fontWeight:800, letterSpacing:1, textTransform:"uppercase", color:"var(--text2)" }}>Where guests come from</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text3)" }}>{channels.recorded} of {channels.total} bookings recorded</span>
        </div>
        {channels.rows.length === 0 ? (
          <div style={{ padding:"16px", fontSize:12.5, color:"#5c4500", background:"#FFFBEB",
            borderTop:"1px solid #FCD34D", lineHeight:1.65 }}>
            <strong>None of your {channels.total} bookings has a source recorded</strong>, so there is no way to tell
            whether a guest came from Google, a walk-in, an agent or a referral — which makes every marketing
            decision a guess. The booking form has a Source field; filling it in takes one tap, and within a
            month this panel will show which channel actually pays.
          </div>
        ) : (
          <div style={{ padding:"10px 16px 14px" }}>
            {channels.rows.map(r => {
              const pct = channels.rows[0].value ? Math.round(r.value / channels.rows[0].value * 100) : 0;
              return (
                <div key={r.source} style={{ display:"flex", alignItems:"center", gap:11, padding:"5px 0" }}>
                  <span style={{ width:104, fontSize:12.5, fontWeight:700, flexShrink:0 }}>{r.source}</span>
                  <span style={{ flex:1, height:20, borderRadius:6, background:"var(--bg3)", overflow:"hidden" }}>
                    <span style={{ display:"block", width:pct + "%", height:"100%", background:"var(--navy3)", borderRadius:6 }} />
                  </span>
                  <span style={{ width:130, textAlign:"right", fontSize:11.5, color:"var(--text3)", flexShrink:0 }}>
                    {r.count} booking{r.count === 1 ? "" : "s"} · {money(r.value)}
                  </span>
                </div>
              );
            })}
            {channels.recorded < channels.total && (
              <div style={{ marginTop:9, fontSize:11.5, color:"var(--text3)" }}>
                {channels.total - channels.recorded} booking{channels.total - channels.recorded === 1 ? "" : "s"} still have no source recorded.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── The guest book ─────────────────────────────────────────────────── */}
      <div className="panel" style={{ margin:"0 0 16px", border:"1px solid var(--border)", borderRadius:12 }}>
        <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", display:"flex", gap:7, flexWrap:"wrap", alignItems:"center" }}>
          {SEGS.map(s => {
            const n = s.key === "all" ? gList.length
              : s.key === "owed" ? gList.filter(g => (g.due || 0) > 0).length
              : s.key === "birthday" ? gList.filter(birthdayMonth).length
              : (stages.find(x => x.key === s.key)?.count ?? 0);
            if (n === 0 && s.key !== "all" && seg !== s.key) return null;
            return (
              <button key={s.key} onClick={() => setSeg(s.key)}
                style={{ padding:"6px 13px", borderRadius:20, cursor:"pointer", fontFamily:"inherit",
                  fontSize:12, fontWeight:700, border:"1.5px solid " + (seg === s.key ? "var(--navy)" : "var(--border)"),
                  background: seg === s.key ? "var(--navy)" : "#fff", color: seg === s.key ? "#fff" : "var(--text3)" }}>
                {s.label} <span style={{ opacity:.65, fontWeight:600 }}>{n}</span>
              </button>
            );
          })}
          <div style={{ position:"relative", marginLeft:"auto", minWidth:190 }}>
            <i className="ti ti-search" style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", fontSize:13 }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or phone…"
              style={{ paddingLeft:30, width:"100%", boxSizing:"border-box", borderRadius:20, fontSize:12.5 }} />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", color:"var(--text3)", padding:40, fontSize:13.5 }}>
            {gList.length === 0 ? "No guests yet — bookings will appear here." : "No guests match this filter."}
          </div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse", width:"100%", minWidth:760, fontSize:13.5 }}>
              <thead><tr>
                {["Guest","Stage","Stays","Nights","Lifetime value","Owed","Last seen",""].map((h, i) => (
                  <th key={h + i} style={{ padding:"10px 14px", textAlign: i >= 2 && i <= 5 ? "right" : "left",
                    fontSize:10, textTransform:"uppercase", letterSpacing:.9, color:"var(--text3)", fontWeight:800,
                    background:"var(--bg4)", borderBottom:"1px solid var(--border)", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {shownGuests.map(g => {
                  const f = guestFacts(g, today);
                  const stage = guestStage(g, today);
                  const sp = g.savedProfile || {};
                  const tdS = { padding:"11px 14px", borderBottom:"1px solid var(--border)" };
                  const tdN = { ...tdS, textAlign:"right", fontVariantNumeric:"tabular-nums" };
                  return (
                    <tr key={g.key} onClick={() => setSelKey(g.key)} style={{ cursor:"pointer",
                      background: f.due > 0 || f.inHouse ? "#fffdf5" : undefined }}>
                      <td style={tdS}>
                        <div style={{ fontWeight:700, display:"flex", alignItems:"center", gap:6 }}>
                          {g.name}
                          {birthdayMonth(g) && <span title="Birthday this month">🎂</span>}
                          {sp.followUp && <span title="Marked for follow-up" style={{ color:"#92400e" }}>●</span>}
                        </div>
                        <div style={{ fontSize:11.5, color:"var(--text3)" }}>{g.phone}</div>
                      </td>
                      <td style={tdS}><StagePill stage={stage} /></td>
                      <td style={tdN}>{f.completed || "—"}</td>
                      <td style={tdN}>{g.totalNights || "—"}</td>
                      <td style={{ ...tdN, fontWeight:700 }}>{money(g.totalSpent)}</td>
                      <td style={{ ...tdN, color: f.due > 0 ? "var(--red2)" : "var(--text3)", fontWeight: f.due > 0 ? 700 : 400 }}>
                        {f.due > 0 ? money(f.due) : "—"}
                      </td>
                      <td style={{ ...tdS, fontSize:12.5, color:"var(--text2)", whiteSpace:"nowrap" }}>
                        {f.inHouse ? "Staying now"
                          : f.arriving !== null ? "Arrives in " + f.arriving + "d"
                          : f.daysSince !== null ? f.daysSince + "d ago" : "—"}
                      </td>
                      <td style={{ ...tdS, textAlign:"right" }}>
                        <a href={"https://wa.me/" + waNum(g.phone)} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()} style={{ textDecoration:"none" }}>
                          <button style={{ padding:"5px 11px", borderRadius:7, border:"none", background:"#25D366",
                            color:"#fff", fontSize:11.5, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>WhatsApp</button>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > shownGuests.length && (
              <div style={{ padding:"12px 16px", textAlign:"center", borderTop:"1px solid var(--border)" }}>
                <button className="btn sm" onClick={() => setShowAllGuests(true)}>
                  Show all {filtered.length} guests
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Guest feedback — kept, but below the work rather than above it */}
      <GuestFeedback />

      {selGuest && (
        <GuestModal gkey={selGuest.key} g={selGuest} onClose={() => setSelKey(null)} onSave={saveProfile} />
      )}
      {showMkt && <MarketingModal guests={gList} onClose={() => setShowMkt(false)} />}
    </div>
  );
}
