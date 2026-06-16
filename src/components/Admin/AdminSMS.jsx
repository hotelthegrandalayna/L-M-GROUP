import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { loadWaConfig, saveWaConfig } from "../../utils/whatsapp";

const TEMPLATE_DEFS = [
  {
    key: "booking",
    label: "Reservation Confirmation",
    icon: "ti-calendar-check",
    desc: "Sent when a booking is saved as a Reservation (not yet checked in)",
    color: "#2d1b69",
    vars: ["{guest}","{room}","{checkin}","{checkout}","{nights}","{total}","{advance}"],
  },
  {
    key: "checkin",
    label: "Check-in Welcome",
    icon: "ti-login",
    desc: "Sent when a guest is checked in directly (Check In Now button)",
    color: "#1a7040",
    vars: ["{guest}","{room}","{checkout}"],
  },
  {
    key: "checkout",
    label: "Check-out Thank You",
    icon: "ti-logout",
    desc: "Shown when a guest checks out (send manually or via API)",
    color: "#7a4500",
    vars: ["{guest}","{room}"],
  },
  {
    key: "referrer",
    label: "Referrer Thank You",
    icon: "ti-heart-handshake",
    desc: "Sent to the person who referred the guest (if referral is filled in)",
    color: "#6b0060",
    vars: ["{referrer}","{guest}"],
  },
];

export default function AdminSMS() {
  const { smsTemplates, setSmsTemplates, notify } = useApp();
  const [editing, setEditing] = useState(null); // key of template being edited
  const [draft,   setDraft]   = useState("");
  const [waCfg, setWaCfg] = useState(loadWaConfig);

  function togglePrintAlert() {
    const next = { ...waCfg, hotelPrintAlert: !waCfg.hotelPrintAlert };
    setWaCfg(next);
    saveWaConfig(next);
    notify(next.hotelPrintAlert ? "Owner WhatsApp alert on invoice print: ON ✅" : "Owner WhatsApp alert on invoice print: OFF", "success");
  }

  function openEdit(key) {
    setEditing(key);
    setDraft(smsTemplates[key] || "");
  }

  function save() {
    setSmsTemplates(prev => ({ ...prev, [editing]: draft }));
    notify("Template saved", "success");
    setEditing(null);
  }

  function reset(key) {
    if (!window.confirm("Reset this template to default?")) return;
    const DEFAULT = {
      booking: `Dear {guest}, your booking at Hotel The Grand Alayna is confirmed! 🏨\nRoom: {room} | Check-in: {checkin} | Check-out: {checkout} ({nights} night(s))\nTotal: {total} | Advance: {advance}\nWe look forward to welcoming you!\n📞 +8801883352526`,
      checkin: `Dear {guest}, welcome to Hotel The Grand Alayna! 🌟\nYou are now checked in to Room {room}.\nCheck-out: {checkout}\nWishing you a pleasant stay! For any assistance, please contact reception.\n📞 +8801883352526`,
      checkout: `Dear {guest}, thank you for staying at Hotel The Grand Alayna! 🙏\nWe hope you enjoyed your stay in Room {room}.\nPlease share your experience on Google & Facebook — your feedback means the world to us!\nHope to see you again soon! 💛`,
      referrer: `Dear {referrer}, thank you for referring {guest} to Hotel The Grand Alayna! 🙏\nYour referral has been recorded and we truly appreciate your support.\n📞 +8801883352526`,
    };
    setSmsTemplates(prev => ({ ...prev, [key]: DEFAULT[key] }));
    if (editing === key) setDraft(DEFAULT[key]);
    notify("Template reset to default", "success");
  }

  return (
    <div>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:15, fontWeight:800, color:"var(--navy)", marginBottom:4 }}>
          <i className="ti ti-message-circle" style={{ color:"var(--gold)", marginRight:8 }} />
          SMS / WhatsApp Message Templates
        </div>
        <div style={{ fontSize:12, color:"var(--text3)", lineHeight:1.6 }}>
          Edit the messages that are shown to staff when sending booking confirmations, check-in welcomes, and check-out thank-you messages.
          Use the <strong style={{ color:"var(--navy)" }}>{"{variable}"}</strong> placeholders — they will be auto-filled with real booking data.
          <br />
          <span style={{ color:"var(--gold2)", fontWeight:700 }}>API integration coming soon</span> — for now messages can be copied and sent via WhatsApp.
        </div>
      </div>

      {/* Owner alert on invoice print — anti-fraud safeguard */}
      <div style={{ marginBottom:18, padding:"14px 16px", border:"1.5px solid var(--gold)", borderRadius:10, background:"#fffbee", display:"flex", alignItems:"center", justifyContent:"space-between", gap:14 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:800, color:"var(--navy)" }}>
            <i className="ti ti-shield-check" style={{ color:"var(--gold2)", marginRight:6 }} />
            Notify me on WhatsApp when a Complete Invoice is printed
          </div>
          <div style={{ fontSize:11, color:"var(--text3)", marginTop:3, lineHeight:1.6 }}>
            Sends you (the owner's configured WhatsApp number, set up under the Hall side's SMS panel) a copy of the guest, room, and final total
            every time staff prints a Complete Invoice or Complete + T&amp;C — an independent record they can't suppress. Sent once per booking, not on every reprint.
          </div>
        </div>
        <button onClick={togglePrintAlert} style={{
          flexShrink:0, padding:"8px 16px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:800,
          background: waCfg.hotelPrintAlert ? "var(--green)" : "#ddd", color: waCfg.hotelPrintAlert ? "#fff" : "#666",
        }}>
          {waCfg.hotelPrintAlert ? "ON ✓" : "OFF"}
        </button>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {TEMPLATE_DEFS.map(t => (
          <div key={t.key} className="panel" style={{ padding:0, overflow:"hidden" }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px",
              background: t.color, borderRadius:"10px 10px 0 0" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <i className={"ti "+t.icon} style={{ fontSize:18, color:"#E8C96A" }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{t.label}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.65)", marginTop:1 }}>{t.desc}</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => reset(t.key)} style={{ padding:"5px 10px", borderRadius:6, border:"1px solid rgba(255,255,255,.3)",
                  background:"rgba(255,255,255,.1)", color:"rgba(255,255,255,.8)", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                  <i className="ti ti-refresh" /> Reset
                </button>
                <button onClick={() => editing === t.key ? setEditing(null) : openEdit(t.key)} style={{ padding:"5px 12px", borderRadius:6, border:"none",
                  background: editing===t.key ? "#fff" : "rgba(255,255,255,.9)", color: t.color, fontSize:11, fontWeight:800, cursor:"pointer" }}>
                  <i className={"ti "+(editing===t.key?"ti-x":"ti-pencil")} /> {editing===t.key ? "Close" : "Edit"}
                </button>
              </div>
            </div>

            {/* Variables row */}
            <div style={{ padding:"8px 16px", background:"var(--bg4)", borderBottom:"1px solid var(--border)", display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
              <span style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.5, marginRight:4 }}>Variables:</span>
              {t.vars.map(v => (
                <span key={v} style={{ padding:"2px 8px", borderRadius:6, background:"var(--navy2)", color:"var(--gold)", fontSize:11, fontWeight:700, fontFamily:"monospace" }}>{v}</span>
              ))}
            </div>

            {/* Template body */}
            <div style={{ padding:"12px 16px" }}>
              {editing === t.key ? (
                <div>
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    rows={6}
                    style={{ width:"100%", boxSizing:"border-box", fontFamily:"inherit", fontSize:13, lineHeight:1.7,
                      padding:"10px 12px", borderRadius:8, border:"2px solid var(--navy)", resize:"vertical",
                      background:"var(--bg)", color:"var(--text)" }}
                  />
                  <div style={{ display:"flex", gap:8, marginTop:8, justifyContent:"flex-end" }}>
                    <button className="btn" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn primary" onClick={save}><i className="ti ti-device-floppy" /> Save Template</button>
                  </div>
                </div>
              ) : (
                <pre style={{ margin:0, fontFamily:"inherit", fontSize:13, lineHeight:1.7, color:"var(--text2)",
                  whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                  {smsTemplates[t.key] || "No template set."}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info box */}
      <div style={{ marginTop:18, padding:"12px 16px", background:"#fffbee", border:"1.5px solid var(--gold)", borderRadius:10, fontSize:12, color:"#6b4a00", lineHeight:1.7 }}>
        <i className="ti ti-info-circle" style={{ marginRight:6, color:"var(--gold2)" }} />
        <strong>How it works:</strong> After saving a booking, a message preview popup will appear with the filled-in message.
        Staff can click <strong>Send via WhatsApp</strong> to open WhatsApp Web / app with the message pre-filled,
        or <strong>Copy</strong> to copy the text and send through any channel.
        When you connect an SMS API later, messages will be sent automatically.
      </div>
    </div>
  );
}
