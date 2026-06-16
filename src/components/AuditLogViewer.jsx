import { useState, useMemo } from "react";
import { getAuditLog, clearAuditLog } from "../utils/auditLog";

const ACTION_LABELS = {
  invoice_created:        "📝 Invoice/Booking Created",
  invoice_updated:        "✏️ Invoice/Booking Updated",
  invoice_confirmed:      "✅ Invoice Confirmed & Printed",
  hall_payment_collected: "💳 Hall Payment Collected",
  room_payment_collected: "💳 Room Payment Collected",
  waiter_payment_collected:"🍽️ Waiter Cost Collected",
  invoice_deleted:        "🗑 Invoice Deleted",
  booking_created:        "📝 Booking Created",
  booking_checked_in:     "🛎 Guest Checked In",
  booking_cancelled:      "🚫 Booking Cancelled",
  invoice_printed:        "🖨 Invoice Printed",
};

function fmtTs(iso) {
  try { return new Date(iso).toLocaleString("en-GB", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }); }
  catch { return iso; }
}

export default function AuditLogViewer({ scope, title, checkPassword, notify }) {
  const [refreshTick, setRefreshTick] = useState(0);
  const [search, setSearch] = useState("");
  const [clearModal, setClearModal] = useState(false);
  const [pw, setPw] = useState("");

  const entries = useMemo(() => {
    const log = getAuditLog(scope).slice().reverse();
    if (!search) return log;
    const s = search.toLowerCase();
    return log.filter(e =>
      (e.action||"").toLowerCase().includes(s) ||
      (e.actor||"").toLowerCase().includes(s) ||
      (e.num||"").toLowerCase().includes(s) ||
      (e.client||e.guest||"").toLowerCase().includes(s)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, search, refreshTick]);

  function doClear() {
    if (!checkPassword(pw)) { notify && notify("Incorrect admin password", "error"); return; }
    clearAuditLog();
    setClearModal(false);
    setPw("");
    setRefreshTick(t => t+1);
    notify && notify("Audit log cleared", "success");
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800 }}>{title || "Audit Log"}</div>
          <div style={{ fontSize:11, color:"#888" }}>Read-only record of every booking/invoice action — who did what, and when. Staff cannot edit or delete individual entries.</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={()=>setRefreshTick(t=>t+1)} style={{ padding:"7px 14px", borderRadius:7, border:"1.5px solid #ddd", background:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>↻ Refresh</button>
          <button onClick={()=>setClearModal(true)} style={{ padding:"7px 14px", borderRadius:7, border:"1.5px solid #fca5a5", background:"#fee2e2", color:"#991b1b", fontSize:12, fontWeight:700, cursor:"pointer" }}>🗑 Clear Log</button>
        </div>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by action, staff name, client, or number..."
        style={{ width:"100%", padding:"9px 12px", border:"1.5px solid #ddd", borderRadius:8, fontSize:13, marginBottom:14, boxSizing:"border-box", fontFamily:"inherit" }} />

      <div style={{ border:"1px solid #e5e3de", borderRadius:10, overflow:"hidden" }}>
        <div style={{ background:"#2D1B69", color:"#f0e8ff", fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, padding:"9px 12px" }}>
          Activity ({entries.length})
        </div>
        <div style={{ maxHeight:480, overflowY:"auto" }}>
          {entries.length === 0 && <div style={{ padding:24, textAlign:"center", color:"#999", fontSize:13 }}>No activity recorded yet.</div>}
          {entries.map(e => (
            <div key={e.id} style={{ display:"flex", flexWrap:"wrap", gap:"4px 14px", justifyContent:"space-between", alignItems:"flex-start", padding:"10px 12px", borderBottom:"1px solid #f0eee8", fontSize:12 }}>
              <div style={{ flex:"1 1 220px", minWidth:0 }}>
                <div style={{ fontWeight:700 }}>{ACTION_LABELS[e.action] || e.action}</div>
                <div style={{ color:"#888", fontSize:11, wordBreak:"break-word" }}>
                  {e.num ? `#${e.num} · ` : ""}{e.client || e.guest || ""}
                  {e.note ? ` — ${e.note}` : ""}
                </div>
                <div style={{ color:"#aaa", fontSize:10.5, marginTop:2 }}>{fmtTs(e.ts)} · {e.actor || "—"}</div>
              </div>
              {e.amount != null && (
                <div style={{ fontWeight:700, color:"#7B1212", flexShrink:0 }}>৳{Number(e.amount).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {clearModal && (
        <div className="modal-overlay open" onClick={ev=>ev.target===ev.currentTarget&&setClearModal(false)}>
          <div className="modal-box" style={{ maxWidth:360 }}>
            <div className="modal-header">
              <div className="modal-title">🗑 Clear Audit Log</div>
              <button className="modal-close" onClick={()=>setClearModal(false)}>✕</button>
            </div>
            <p style={{ fontSize:13, color:"#555", margin:"4px 0 14px" }}>This permanently erases the entire activity history. Enter the admin password to confirm.</p>
            <div className="form-group"><label>Admin Password</label>
              <input type="password" value={pw} onChange={e=>setPw(e.target.value)} autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setClearModal(false)}>Cancel</button>
              <button className="btn primary" onClick={doClear} style={{ background:"#c0392b", borderColor:"#c0392b" }}>Yes, Clear Everything</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
