import { useState, useEffect, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { money } from "../../utils/helpers";
import { hotelBusinessOnly } from "../../utils/expenseType";
import { hasHotelSupabaseConfig, loadHotelBookingsForMonth } from "../../lib/hotelSupabase";
import { monthMoney, loadMonthLocks, saveMonthLock, unlockMonth } from "../../lib/hotelMoney";
import { checkAdminPassword } from "../../utils/auth";

const C = { navy:"var(--navy)", gold:"var(--gold2)", green:"#1a7040", red:"#b5322a", dim:"var(--text3)" };

function monthLabel(m) {
  return new Date(m + "-01").toLocaleString("en-GB", { month: "long", year: "numeric" });
}

// Last N months as "YYYY-MM", newest first
function recentMonths(n) {
  const out = [];
  const d = new Date(); d.setDate(1);
  for (let i = 0; i < n; i++) { out.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
  return out;
}

export default function AdminReports() {
  const { bookings, revenues, expenses, expTypes, curRole, curUser, notify } = useApp();
  const isAdmin = curRole === "admin";
  const bizExpenses = useMemo(() => hotelBusinessOnly(expenses, expTypes || {}), [expenses, expTypes]);

  const months = useMemo(() => recentMonths(12), []);
  const thisMonth = months[0];

  const [monthData, setMonthData] = useState({}); // { 'YYYY-MM': bookings[] } complete sets
  const [locks, setLocks] = useState({});
  const [busy, setBusy] = useState(false);
  const [pwFor, setPwFor] = useState(null); // month awaiting password to lock/unlock
  const [pw, setPw] = useState("");

  // Load locks once
  useEffect(() => { loadMonthLocks().then(setLocks).catch(() => {}); }, []);

  // Load complete bookings for each past month (current month is already live)
  useEffect(() => {
    if (!hasHotelSupabaseConfig()) return;
    let alive = true;
    (async () => {
      for (const m of months) {
        if (m >= thisMonth) continue;
        if (monthData[m]) continue;
        const rows = await loadHotelBookingsForMonth(m).catch(() => null);
        if (alive && rows) setMonthData(p => ({ ...p, [m]: rows }));
      }
    })();
    return () => { alive = false; };
  }, [months, thisMonth]); // eslint-disable-line

  const deletedSet = useMemo(() => {
    try {
      const legacy = JSON.parse(localStorage.getItem("ga_deleted_booking_ids") || "[]");
      const v1 = (JSON.parse(localStorage.getItem("ga_deleted_ids_v1") || "{}").bkg) || [];
      return new Set([...legacy, ...v1].map(String));
    } catch { return new Set(); }
  }, []);

  // Complete, de-duplicated bookings for a given month
  function bookingsFor(m) {
    if (m >= thisMonth) return bookings.filter(b => !deletedSet.has(String(b.id)) && !deletedSet.has(String(b.supabaseBookingId ?? "")));
    const extra = monthData[m] || [];
    const live = bookings.filter(b => !deletedSet.has(String(b.id)) && !deletedSet.has(String(b.supabaseBookingId ?? "")));
    const have = new Set(live.map(b => String(b.supabaseBookingId ?? b.id)));
    const add = extra.filter(b =>
      !have.has(String(b.supabaseBookingId ?? b.id)) &&
      !deletedSet.has(String(b.id)) && !deletedSet.has(String(b.supabaseBookingId ?? "")));
    return [...live, ...add];
  }

  // Figures per month: locked snapshot if present, else live computation
  const rows = useMemo(() => months.map(m => {
    if (locks[m]) return { month: m, locked: true, ...locks[m] };
    const mm = monthMoney({ bookings: bookingsFor(m), revenues, expenses: bizExpenses, month: m });
    return { month: m, locked: false, billed: mm.billed, collected: mm.collected, outstanding: mm.outstanding, expenses: mm.expenses, netProfit: mm.netProfit };
  }), [months, locks, monthData, bookings, revenues, bizExpenses]); // eslint-disable-line

  async function doLock(m) {
    const row = rows.find(r => r.month === m);
    if (!row) return;
    setBusy(true);
    try {
      const next = await saveMonthLock(m, row, curUser);
      setLocks(next);
      notify(`${monthLabel(m)} locked — figures are now frozen`, "success");
    } catch { notify("Could not lock (cloud not reachable)", "error"); }
    setBusy(false);
    setPwFor(null); setPw("");
  }
  async function doUnlock(m) {
    setBusy(true);
    try { const next = await unlockMonth(m); setLocks(next); notify(`${monthLabel(m)} unlocked`, "info"); }
    catch { notify("Could not unlock (cloud not reachable)", "error"); }
    setBusy(false);
    setPwFor(null); setPw("");
  }

  function confirmPw() {
    if (!checkAdminPassword(pw)) { notify("Incorrect admin password", "error"); return; }
    const { month, mode } = pwFor;
    if (mode === "lock") doLock(month); else doUnlock(month);
  }

  function downloadCSV() {
    const head = ["Month", "Billed", "Collected", "Outstanding", "Business Expenses", "Net Profit", "Status"];
    const body = rows.map(r => [monthLabel(r.month), r.billed, r.collected, r.outstanding, r.expenses, r.netProfit, r.locked ? "LOCKED" : "live"]);
    const csv = [head, ...body].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `hotel-monthly-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    notify("Report downloaded", "success");
  }

  function printReport() {
    const w = window.open("", "_blank");
    const trs = rows.map(r => `<tr>
      <td>${monthLabel(r.month)}</td>
      <td style="text-align:right">৳${(r.billed||0).toLocaleString()}</td>
      <td style="text-align:right;color:#1a7040">৳${(r.collected||0).toLocaleString()}</td>
      <td style="text-align:right;color:#b5322a">৳${(r.outstanding||0).toLocaleString()}</td>
      <td style="text-align:right;color:#b5322a">৳${(r.expenses||0).toLocaleString()}</td>
      <td style="text-align:right;font-weight:700;color:${(r.netProfit||0)>=0?'#1a7040':'#b5322a'}">৳${(r.netProfit||0).toLocaleString()}</td>
      <td style="text-align:center">${r.locked ? "🔒 Locked" : "live"}</td></tr>`).join("");
    w.document.write(`<html><head><title>Hotel Monthly Report</title></head><body style="font-family:Arial,sans-serif;padding:24px;">
      <h2 style="margin:0 0 4px">Hotel The Grand Alayna — Monthly Revenue Report</h2>
      <div style="color:#666;font-size:12px;margin-bottom:16px">Generated ${new Date().toLocaleString("en-GB")}. Revenue attributed by stay month (extensions by their extra-night month).</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px" border="1" cellpadding="8">
        <thead><tr style="background:#1a1a2e;color:#C9A84C">
          <th style="text-align:left">Month</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Business Exp.</th><th>Net Profit</th><th>Status</th>
        </tr></thead><tbody>${trs}</tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:14 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800, color:C.navy }}><i className="ti ti-report-money" style={{ color:C.gold, marginRight:8 }} />Monthly Revenue Report</div>
          <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>Revenue by stay month (extensions land in their extra-night month). Lock a month to freeze it as the official record.</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={printReport} style={{ padding:"8px 14px", borderRadius:8, border:"1.5px solid var(--border)", background:"transparent", fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:C.navy }}><i className="ti ti-printer" style={{ marginRight:6 }} />Print / PDF</button>
          <button onClick={downloadCSV} style={{ padding:"8px 14px", borderRadius:8, border:"none", background:"#1a7040", color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}><i className="ti ti-download" style={{ marginRight:6 }} />CSV</button>
        </div>
      </div>

      <div style={{ overflowX:"auto", border:"1px solid var(--border)", borderRadius:12 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, minWidth:640 }}>
          <thead>
            <tr style={{ background:"var(--bg3)", color:C.dim }}>
              {["Month","Billed","Collected","Outstanding","Business Exp.","Net Profit","",""].map((h,i)=>(
                <th key={i} style={{ padding:"10px 12px", textAlign: i===0?"left":i>=6?"center":"right", fontSize:10, textTransform:"uppercase", letterSpacing:.6, fontWeight:700, whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.month} style={{ borderTop:"1px solid var(--border)", background: r.locked ? "#fbf8ef" : "transparent" }}>
                <td style={{ padding:"10px 12px", fontWeight:700 }}>
                  {monthLabel(r.month)} {r.locked && <i className="ti ti-lock" style={{ color:C.gold, fontSize:13, marginLeft:4 }} />}
                </td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontVariantNumeric:"tabular-nums" }}>{money(r.billed)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:C.green, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>{money(r.collected)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:r.outstanding>0?C.red:C.dim, fontVariantNumeric:"tabular-nums" }}>{money(r.outstanding)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", color:C.red, fontVariantNumeric:"tabular-nums" }}>{money(r.expenses)}</td>
                <td style={{ padding:"10px 12px", textAlign:"right", fontWeight:800, color:r.netProfit>=0?C.green:C.red, fontVariantNumeric:"tabular-nums" }}>{money(r.netProfit)}</td>
                <td style={{ padding:"10px 12px", textAlign:"center" }}>
                  {r.locked
                    ? <span style={{ fontSize:11, fontWeight:700, color:C.gold }}>Locked</span>
                    : <span style={{ fontSize:11, color:C.dim }}>live</span>}
                </td>
                <td style={{ padding:"10px 12px", textAlign:"center", whiteSpace:"nowrap" }}>
                  {isAdmin && (r.locked
                    ? <button onClick={()=>setPwFor({ month:r.month, mode:"unlock" })} disabled={busy} style={{ fontSize:11, padding:"5px 10px", borderRadius:7, border:"1px solid var(--border)", background:"transparent", cursor:"pointer", fontFamily:"inherit", color:C.navy }}>Unlock</button>
                    : <button onClick={()=>setPwFor({ month:r.month, mode:"lock" })} disabled={busy} style={{ fontSize:11, padding:"5px 12px", borderRadius:7, border:"none", background:C.navy, color:"#fff", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}><i className="ti ti-lock" style={{ marginRight:4 }} />Lock</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isAdmin && <div style={{ fontSize:11.5, color:C.dim, marginTop:10 }}>Only administrators can lock or unlock a month.</div>}

      {pwFor && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget && setPwFor(null)} style={{ zIndex:10001 }}>
          <div className="modal-box" style={{ maxWidth:400 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginBottom:8 }}>
              {pwFor.mode==="lock" ? "🔒 Lock" : "🔓 Unlock"} {monthLabel(pwFor.month)}
            </div>
            <div style={{ fontSize:12.5, color:C.dim, marginBottom:12 }}>
              {pwFor.mode==="lock"
                ? "This freezes the month's figures as the official record. Enter admin password to confirm."
                : "This lets the month's figures move again. Enter admin password to confirm."}
            </div>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Admin password" autoFocus
              onKeyDown={e=>e.key==="Enter"&&confirmPw()}
              style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:14, boxSizing:"border-box", marginBottom:12 }} />
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={()=>{ setPwFor(null); setPw(""); }} style={{ padding:"8px 16px", borderRadius:8, border:"1.5px solid var(--border)", background:"transparent", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
              <button onClick={confirmPw} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:C.navy, color:"#fff", fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
