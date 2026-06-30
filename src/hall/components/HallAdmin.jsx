
import { useState, useMemo, useEffect } from "react";
import { useHall, EV_TYPES, checkHallAdminPass } from "../HallContext";
import useIsMobile from "../useIsMobile";
import { loadWaConfig, saveWaConfig, sendWhatsAppAlert } from "../../utils/whatsapp";
import { loadNtfyConfig, saveNtfyConfig, sendNtfyAlert } from "../../utils/ntfy";
import AuditLogViewer from "../../components/AuditLogViewer";
import { getUnusualLogins } from "../../utils/loginLog";
import { deleteHallInvoiceFromSupabase, deleteHallInvoicesFromSupabase } from "../lib/hallSupabase";
import { loadPricingRules, savePricingRules, syncPricingRulesFromSupabase } from "../lib/pricingRules";
import { hasSupabase, upsertRows, saveConfig } from "../../utils/supabaseSync";

const DEFAULT_RECOVERY_EMAILS = ["mainulhasan86@gmail.com","mainulhasan86@yahoo.com"];
function loadRecoveryEmails() {
  try { const s=localStorage.getItem("ga_recovery_emails"); return s?JSON.parse(s):DEFAULT_RECOVERY_EMAILS.slice(); } catch { return DEFAULT_RECOVERY_EMAILS.slice(); }
}
function saveRecoveryEmails(list) { localStorage.setItem("ga_recovery_emails", JSON.stringify(list)); }

const BASE_STAFF = { staff:"staff123", staff2:"staff456" };
function getStaffPass(user) { return localStorage.getItem("a_pass_"+user) || BASE_STAFF[user] || ""; }
function setStaffPass(user, pw) { localStorage.setItem("a_pass_"+user, pw); }
function getStaffRenames() { try { return JSON.parse(localStorage.getItem("a_renames")||"{}"); } catch { return {}; } }

const C = { maroon:"#7B1212", gold:"#c9a84c", dim:"#666", border:"#e0d0b0", green:"#1a7040", red:"#c0392b", navy:"#1e3a5f", blue:"#1a56cb" };
const EXP_CATS = {
  'Salary':        { i:'👤', bg:'rgba(52,152,219,.15)',  c:'#1a5276' },
  'Electricity':   { i:'⚡', bg:'rgba(241,196,15,.18)',  c:'#7d6608' },
  'Generator Oil': { i:'🛢️', bg:'rgba(230,126,34,.18)',  c:'#784212' },
  'Internet':      { i:'🌐', bg:'rgba(142,68,173,.12)',  c:'#6c3483' },
  'Food & Kitchen':{ i:'🍳', bg:'rgba(231,76,60,.12)',   c:'#922b21' },
  'Cleaning':      { i:'🧹', bg:'rgba(39,174,96,.12)',   c:'#1e8449' },
  'Maintenance':   { i:'🔧', bg:'rgba(149,165,166,.15)', c:'#566573' },
  'Equipment':     { i:'📦', bg:'rgba(201,168,76,.15)',  c:'#7d6608' },
  'Security':      { i:'🔐', bg:'rgba(52,73,94,.15)',    c:'#2c3e50' },
  'Marketing':     { i:'📣', bg:'rgba(155,89,182,.12)',  c:'#6c3483' },
  'Tax':           { i:'📋', bg:'rgba(192,57,43,.12)',   c:'#922b21' },
  'Donation':      { i:'🤲', bg:'rgba(39,174,96,.15)',   c:'#1e8449' },
  'Personal Salary':{ i:'💼',bg:'rgba(155,89,182,.18)', c:'#6c3483' },
  'Personal Other':{ i:'👤', bg:'rgba(155,89,182,.12)', c:'#6c3483' },
  'Other':         { i:'📌', bg:'rgba(0,0,0,.06)',       c:'#566573' },
};
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmt(n) { return Number(n||0).toLocaleString(); }
function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${MONTHS_S[parseInt(m)-1]} ${y}`;
}

const inp = (s={}) => ({ padding:"9px 12px", border:"1.5px solid #e5e3de", borderRadius:8, fontSize:13, fontFamily:"inherit", background:"#fafaf9", width:"100%", boxSizing:"border-box", outline:"none", ...s });
const lbl = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };

const subTabStyle = (active) => ({
  padding:"10px 20px", border:"none", background: active ? C.maroon : "transparent",
  color: active ? "#fff" : C.dim, cursor:"pointer", fontFamily:"inherit",
  fontWeight:700, fontSize:13, borderRadius:"8px 8px 0 0", transition:".15s",
  borderBottom: active ? `3px solid ${C.gold}` : "3px solid transparent",
});

export default function HallAdmin() {
  const { curRole, invoices, setInvoices, expenses, setExpenses, revenues, setRevenues, leads, setLeads, notify } = useHall();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("overview");
  const isAdmin = curRole === "admin";

  // ── Overview state ──
  const now = new Date();
  const [chartYear, setChartYear] = useState(now.getFullYear());

  // ── Invoices sub-tab state ──
  const [invSearch, setInvSearch] = useState("");
  const [invSearchBy, setInvSearchBy] = useState("all");
  const [invFStatus, setInvFStatus] = useState("");
  const [invFEvent, setInvFEvent] = useState("");
  const [selMonths, setSelMonths] = useState([]);
  const [invYear, setInvYear] = useState(now.getFullYear());

  // ── Password state ──
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwErr, setPwErr] = useState("");

  // ── Recovery emails state ──
  const [recoveryEmails, setRecoveryEmailsState] = useState(loadRecoveryEmails);
  const [newEmail, setNewEmail] = useState("");
  const [emailErr, setEmailErr] = useState("");

  // ── Staff password state ──
  const STAFF_USERS = ["staff","staff2"];
  const [staffRenames, setStaffRenamesState] = useState(getStaffRenames);
  const [staffRenameInput, setStaffRenameInput] = useState({ staff: staffRenames["staff"]||"Staff", staff2: staffRenames["staff2"]||"Staff 2" });
  const [staffPwNew, setStaffPwNew] = useState({ staff:"", staff2:"" });
  const [staffPwConfirm, setStaffPwConfirm] = useState({ staff:"", staff2:"" });
  const [staffMsg, setStaffMsg] = useState({ staff:"", staff2:"" });
  const [staffMsgType, setStaffMsgType] = useState({ staff:"", staff2:"" });

  // ── P&L state ──
  const [pnlMonth, setPnlMonth] = useState("all");

  // ── Danger state ──
  const [dangerPass, setDangerPass] = useState("");
  const [dangerErr, setDangerErr] = useState("");

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalInvoices = invoices.length;
  const totalBilled   = invoices.reduce((s,i)=>s+(i.grand||0),0);
  const totalReceived = invoices.reduce((s,i)=>s+(parseFloat(i.adv)||0),0);
  const totalExpenses = expenses.reduce((s,e)=>s+(e.amount||0),0);

  // ── Chart data ───────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    return MONTHS_S.map((mo, mi) => {
      const prefix = `${chartYear}-${String(mi+1).padStart(2,"0")}`;
      const monthInv = invoices.filter(i=>(i.evDate||i.invDate||"").startsWith(prefix));
      const billed   = monthInv.reduce((s,i)=>s+(i.grand||0),0);
      const received = monthInv.reduce((s,i)=>s+(parseFloat(i.adv)||0),0);
      return { mo, billed, received };
    });
  }, [invoices, chartYear]);

  const maxVal = Math.max(...chartData.map(d=>Math.max(d.billed,d.received)),1);

  // ── Monthly breakdown table ───────────────────────────────────────────────────
  const monthBreakdown = useMemo(() => {
    return MONTHS_S.map((mo, mi) => {
      const prefix = `${chartYear}-${String(mi+1).padStart(2,"0")}`;
      const monthInv = invoices.filter(i=>(i.evDate||i.invDate||"").startsWith(prefix));
      const billed   = monthInv.reduce((s,i)=>s+(i.grand||0),0);
      const received = monthInv.reduce((s,i)=>s+(parseFloat(i.adv)||0),0);
      const guests   = monthInv.reduce((s,i)=>s+(parseInt(i.wGuests||i.hGuests||i.guests)||0),0);
      return { mo, count:monthInv.length, guests, billed, received, pending:Math.max(0,billed-received) };
    });
  }, [invoices, chartYear]);

  const yearTotals = useMemo(() => monthBreakdown.reduce((acc,m)=>({
    count:acc.count+m.count, guests:acc.guests+m.guests,
    billed:acc.billed+m.billed, received:acc.received+m.received,
    pending:acc.pending+m.pending,
  }),{ count:0,guests:0,billed:0,received:0,pending:0 }), [monthBreakdown]);

  const allYears = useMemo(()=>[...new Set(invoices.map(i=>(i.evDate||i.invDate||"").slice(0,4)).filter(Boolean))].sort().reverse(),[invoices]);

  // ── Invoice detail modal & multi-select ──────────────────────────────────────
  const [viewInv, setViewInv] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev,id]);
  }
  function toggleSelectAll() {
    setSelectedIds(prev => prev.length === filteredInv.length ? [] : filteredInv.map(i=>i.id));
  }
  function bulkDelete() {
    if (!selectedIds.length) return;
    if (!window.confirm(`Delete ${selectedIds.length} invoice(s)? This cannot be undone.`)) return;
    void deleteHallInvoicesFromSupabase(selectedIds).catch(err => console.error(err));
    setInvoices(prev => prev.filter(i => !selectedIds.includes(i.id)));
    setSelectedIds([]);
    notify(`${selectedIds.length} invoice(s) deleted`, "success");
  }

  // ── Invoice table filter ──────────────────────────────────────────────────────
  const filteredInv = useMemo(() => {
    const s = invSearch.toLowerCase();
    return invoices.filter(i => {
      if (selMonths.length) {
        const prefix = `${invYear}-`;
        const ok = selMonths.some(m => (i.evDate||i.invDate||"").startsWith(prefix+String(m).padStart(2,"0")));
        if (!ok) return false;
      }
      if (invFStatus && (i.payStatus||"").toLowerCase() !== invFStatus.toLowerCase()) return false;
      if (invFEvent  && i.evType !== invFEvent) return false;
      if (!s) return true;
      if (invSearchBy==="all") return (i.client||"").toLowerCase().includes(s)||(i.phone||"").includes(s)||(i.num||"").includes(s)||(i.evType||"").toLowerCase().includes(s);
      if (invSearchBy==="num")    return (i.num||"").toLowerCase().includes(s);
      if (invSearchBy==="client") return (i.client||"").toLowerCase().includes(s);
      if (invSearchBy==="phone")  return (i.phone||"").includes(s);
      if (invSearchBy==="event")  return (i.evType||"").toLowerCase().includes(s);
      if (invSearchBy==="date")   return (i.evDate||"").includes(s);
      return true;
    }).sort((a,b)=>((b.invDate||b.evDate||"")>(a.invDate||a.evDate||""))?1:-1);
  }, [invoices, invSearch, invSearchBy, invFStatus, invFEvent, selMonths, invYear]);

  function toggleMonth(m) {
    setSelMonths(prev => prev.includes(m) ? prev.filter(x=>x!==m) : [...prev,m]);
  }
  function selectAllYear() { setSelMonths([1,2,3,4,5,6,7,8,9,10,11,12]); }
  function clearMonths()   { setSelMonths([]); }

  function exportInvCSV() {
    function esc(v) {
      return String(v ?? "")
        .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;").replace(/\r?\n/g," ");
    }
    function numCell(v) { return `<Cell><Data ss:Type="Number">${Number(v)||0}</Data></Cell>`; }
    function strCell(v) { return `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`; }
    function hdrCell(v) { return `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(v)}</Data></Cell>`; }

    const headers = [
      "Invoice #","Client Name","Phone","Event Type","Event Date",
      "Wedding Guests","Holud Guests","Hall Total (BDT)","Waiter Cost (BDT)",
      "Advance (BDT)","Balance (BDT)","Discount (BDT)","Payment Status",
      "Address","Notes",
    ];

    const dataRows = filteredInv.map(inv => {
      const waiterTotal = inv.waiterTotal || 0;
      const balance = inv.balance ?? Math.max(0,(inv.grand||0)-(parseFloat(inv.adv)||0));
      return `<Row>
        ${strCell(inv.num)}${strCell(inv.client)}${strCell(inv.phone)}
        ${strCell(inv.evType)}${strCell(inv.evDate)}
        ${numCell(inv.wGuests||0)}${numCell(inv.hGuests||0)}
        ${numCell(inv.grand||0)}${numCell(waiterTotal)}
        ${numCell(parseFloat(inv.adv)||0)}${numCell(balance)}
        ${numCell(parseFloat(inv.discount)||0)}${strCell(inv.payStatus||"")}
        ${strCell(inv.address||"")}${strCell(inv.notes||"")}
      </Row>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="h">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2D1B69" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Hall Invoices">
    <Table>
      <Row>${headers.map(hdrCell).join("")}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type:"application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="hall-invoices.xls"; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Analytics ────────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    function tally(fn) {
      const m={};
      invoices.forEach(i=>{ const k=fn(i); if(k){m[k]=(m[k]||0)+1;} });
      return Object.entries(m).sort((a,b)=>b[1]-a[1]);
    }
    return {
      evTypes: tally(i=>i.evType),
      sources: tally(i=>i.hearAbout),
      areas:   tally(i=>{ if(!i.address) return null; const p=i.address.split(","); return (p[p.length-1]||p[0]).trim(); }),
    };
  }, [invoices]);

  // ── Password change ───────────────────────────────────────────────────────────
  function changePass() {
    setPwErr("");
    if (!checkHallAdminPass(pwCurrent)) { setPwErr("Current password is incorrect."); return; }
    if (pwNew.length < 6) { setPwErr("New password must be at least 6 characters."); return; }
    if (pwNew !== pwConfirm) { setPwErr("Passwords do not match."); return; }
    localStorage.setItem("a_pass_admin", pwNew);
    notify("Password changed successfully ✅", "success");
    setPwCurrent(""); setPwNew(""); setPwConfirm("");
  }

  // ── Recovery email actions ────────────────────────────────────────────────────
  function addRecoveryEmail() {
    setEmailErr("");
    const em = newEmail.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setEmailErr("Enter a valid email address."); return; }
    if (recoveryEmails.includes(em)) { setEmailErr("Email already in list."); return; }
    const updated = [...recoveryEmails, em];
    setRecoveryEmailsState(updated);
    saveRecoveryEmails(updated);
    setNewEmail("");
    notify("Recovery email added ✅", "success");
  }
  function removeRecoveryEmail(em) {
    if (recoveryEmails.length <= 1) { notify("At least one recovery email is required.", "error"); return; }
    const updated = recoveryEmails.filter(e=>e!==em);
    setRecoveryEmailsState(updated);
    saveRecoveryEmails(updated);
  }

  // ── Staff password / rename actions ──────────────────────────────────────────
  function renameStaff(user) {
    const name = (staffRenameInput[user]||"").trim();
    if (!name) { setStaffMsg(m=>({...m,[user]:"Name cannot be empty."})); setStaffMsgType(m=>({...m,[user]:"error"})); return; }
    const renames = getStaffRenames();
    renames[user] = name;
    localStorage.setItem("a_renames", JSON.stringify(renames));
    setStaffRenamesState({...renames});
    setStaffMsg(m=>({...m,[user]:`Renamed to "${name}" ✅`}));
    setStaffMsgType(m=>({...m,[user]:"success"}));
  }
  function changeStaffPass(user) {
    const np = staffPwNew[user]; const cp = staffPwConfirm[user];
    if (!np || np.length < 4) { setStaffMsg(m=>({...m,[user]:"Password must be at least 4 characters."})); setStaffMsgType(m=>({...m,[user]:"error"})); return; }
    if (np !== cp) { setStaffMsg(m=>({...m,[user]:"Passwords do not match."})); setStaffMsgType(m=>({...m,[user]:"error"})); return; }
    setStaffPass(user, np);
    setStaffPwNew(m=>({...m,[user]:""}));
    setStaffPwConfirm(m=>({...m,[user]:""}));
    setStaffMsg(m=>({...m,[user]:"Password updated ✅"}));
    setStaffMsgType(m=>({...m,[user]:"success"}));
  }

  // ── Danger zone ───────────────────────────────────────────────────────────────
  function clearAllInvoices() {
    setDangerErr("");
    if (!checkHallAdminPass(dangerPass)) { setDangerErr("Incorrect password."); return; }
    if (!window.confirm("Permanently delete ALL invoices? This cannot be undone.")) return;
    const backup = { invoices, at: new Date().toISOString() };
    localStorage.setItem("a_inv_backup", JSON.stringify(backup));
    void deleteHallInvoicesFromSupabase(invoices.map(i => i.id)).catch(err => {
      console.error("Failed to clear hall invoices from Supabase:", err);
    });
    setInvoices([]);
    setDangerPass("");
    notify("All invoices cleared. Backup saved.", "success");
  }
  function clearAllLeads() {
    setDangerErr("");
    if (!checkHallAdminPass(dangerPass)) { setDangerErr("Incorrect password."); return; }
    if (!window.confirm("Permanently delete ALL CRM leads?")) return;
    setLeads([]);
    setDangerPass("");
    notify("All leads cleared.", "success");
  }

  const psColor = (ps) => ps==="Paid"?C.green:ps==="Partial"?C.gold:C.red;

  const TABS = [
    { id:"overview", label:"📊 Overview" },
    { id:"invoices", label:"🗓 Invoices" },
    { id:"reports",  label:"📈 Reports"  },
    { id:"insights", label:"💡 Insights" },
    ...(isAdmin ? [
      { id:"pricing",  label:"💰 Pricing Rules" },
      { id:"sms",      label:"📱 SMS"      },
      { id:"audit",    label:"🕵 Audit Log" },
      { id:"loginlog", label:"🔍 Login Activity" },
      { id:"sync",     label:"☁️ Sync to Cloud" },
      { id:"password", label:"🔐 Password" },
      { id:"danger",   label:"⚠️ Danger Zone", danger:true },
    ] : []),
  ];

  return (
    <div className="hall-page" style={{ padding: isMobile?"10px 8px":"22px 28px", maxWidth:1100, margin:"0 auto", width:"100%" }}>

      {/* ── Page title ── */}
      <div style={{ marginBottom:4 }}>
        <div style={{ fontSize:26, fontWeight:700, fontFamily:"'Playfair Display',serif", color:C.maroon }}>Admin Panel</div>
        <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>
          {isAdmin ? "Full access — P&L, revenue, invoices, delete." : "🔒 Staff view — revenue, P&L and delete restricted to Admin."}
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div style={{ display:"flex", gap:2, borderBottom:`2px solid ${C.border}`, marginBottom:20, marginTop:16, flexWrap:"wrap" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ ...subTabStyle(tab===t.id), ...(t.danger?{color:tab===t.id?"#fff":C.red,background:tab===t.id?C.red:"transparent"}:{}) }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════ OVERVIEW ════════ */}
      {tab==="overview" && (
        <div>
          {/* ── Unpaid Past Events Alert ── */}
          {(() => {
            const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().split("T")[0]; })();
            const overdue = invoices.filter(inv => {
              if (inv.isLead || !inv.confirmed) return false;
              if (inv.payStatus === "Paid") return false;
              const evDate = inv.evDate || inv.hDate || "";
              return evDate && evDate <= yesterday;
            });
            if (!overdue.length) return null;
            return (
              <div style={{ background:"#c0392b", borderRadius:12, padding:"14px 18px", marginBottom:16, border:"3px solid #922b21", boxShadow:"0 4px 20px rgba(192,57,43,.4)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:22 }}>🚨</span>
                  <div>
                    <div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>PAYMENT OVERDUE — {overdue.length} event{overdue.length>1?"s":""} with unpaid balance!</div>
                    <div style={{ color:"rgba(255,255,255,.85)", fontSize:12, marginTop:2 }}>These events are over but full payment has not been collected yet.</div>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {overdue.map(inv => {
                    const bal = inv.balance ?? Math.max(0, (inv.grand||0) - (parseFloat(inv.adv)||0));
                    return (
                      <div key={inv.id} style={{ background:"rgba(0,0,0,.25)", borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                        <div style={{ flex:1, minWidth:160 }}>
                          <div style={{ color:"#fff", fontWeight:700, fontSize:13 }}>{inv.client} — {inv.evType}</div>
                          <div style={{ color:"rgba(255,255,255,.75)", fontSize:11, marginTop:2 }}>📅 {inv.evDate || inv.hDate} &nbsp;·&nbsp; {inv.num} &nbsp;·&nbsp; {inv.phone}</div>
                        </div>
                        <div style={{ color:"#ffd700", fontWeight:900, fontSize:16, flexShrink:0 }}>৳{bal.toLocaleString()} due</div>
                        <div style={{ color:"rgba(255,255,255,.65)", fontSize:10, flexShrink:0 }}>{inv.payStatus === "Partial" ? "Partially paid" : "Not paid"}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Stats grid */}
          <div className="hall-stat-grid" style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap:12, marginBottom:20 }}>
            {[
              ["Total Invoices", totalInvoices, "#1a1a2e"],
              ["Revenue",        "৳"+fmt(totalBilled),   C.gold],
              ["Received",       "৳"+fmt(totalReceived), C.green],
              ["Expenses",       "৳"+fmt(totalExpenses), C.red],
            ].map(([l,v,c])=>(
              <div key={l} style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"15px 18px" }}>
                <div style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:.8, color:C.dim, marginBottom:8 }}>{l}</div>
                <div style={{ fontSize:22, fontWeight:800, fontFamily:"'Playfair Display',serif", color:c }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Monthly Revenue bar chart */}
          <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"18px 20px", marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"#fff", fontWeight:700, background:C.gold, padding:"5px 12px", borderRadius:7 }}>📈 Monthly Revenue</div>
              </div>
              <select value={chartYear} onChange={e=>setChartYear(parseInt(e.target.value))}
                style={{ ...inp(), width:"auto", minWidth:80 }}>
                {(allYears.length?allYears:[now.getFullYear()]).map(y=><option key={y}>{y}</option>)}
              </select>
            </div>

            {/* Bar chart */}
            <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:140, paddingBottom:24, position:"relative" }}>
              {chartData.map((d,i) => (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, height:"100%", justifyContent:"flex-end" }}>
                  <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:2, flex:1, justifyContent:"flex-end" }}>
                    <div title={`Billed: ৳${fmt(d.billed)}`} style={{ width:"100%", height:maxVal>0?`${Math.round(d.billed/maxVal*100)}%`:"2px", background:C.gold, borderRadius:"3px 3px 0 0", minHeight:d.billed?2:0, transition:".3s" }} />
                    <div title={`Received: ৳${fmt(d.received)}`} style={{ width:"100%", height:maxVal>0?`${Math.round(d.received/maxVal*100)}%`:"2px", background:C.green, borderRadius:"3px 3px 0 0", minHeight:d.received?2:0, transition:".3s" }} />
                  </div>
                  <div style={{ fontSize:9, color:C.dim, marginTop:4, position:"absolute", bottom:2 }}>{d.mo}</div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div style={{ display:"flex", gap:16, fontSize:11, color:C.dim, marginTop:8 }}>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:10,height:10,borderRadius:2,background:C.gold,display:"inline-block" }}/> Billed</span>
              <span style={{ display:"flex", alignItems:"center", gap:5 }}><span style={{ width:10,height:10,borderRadius:2,background:C.green,display:"inline-block" }}/> Received</span>
            </div>
          </div>

          {/* Monthly breakdown table */}
          <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:`1.5px solid ${C.border}`, flexWrap:"wrap", gap:8 }}>
              <div style={{ fontSize:11, fontWeight:800, textTransform:"uppercase", letterSpacing:1.5, color:C.gold }}>Monthly Breakdown — {chartYear}</div>
              <select value={chartYear} onChange={e=>setChartYear(parseInt(e.target.value))} style={{ ...inp(), width:"auto", minWidth:80 }}>
                {(allYears.length?allYears:[now.getFullYear()]).map(y=><option key={y}>{y}</option>)}
              </select>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#fafaf8" }}>
                  {["Month","Invoices","Guests","Billed","Received","Pending"].map(h=>(
                    <th key={h} style={{ padding:"9px 14px", fontSize:10, color:C.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C.border}`, textAlign:"left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthBreakdown.every(m=>m.count===0) ? (
                  <tr><td colSpan={6} style={{ textAlign:"center", padding:24, color:C.dim, fontSize:13 }}>No invoices for {chartYear}.</td></tr>
                ) : monthBreakdown.map((m,i)=>(
                  m.count > 0 ? (
                    <tr key={i} style={{ borderBottom:"1px solid #f0ede8" }}>
                      <td style={{ padding:"10px 14px", fontWeight:700, fontSize:13 }}>{MONTHS[i]}</td>
                      <td style={{ padding:"10px 14px", fontSize:12 }}>{m.count}</td>
                      <td style={{ padding:"10px 14px", fontSize:12 }}>{m.guests||"—"}</td>
                      <td style={{ padding:"10px 14px", fontWeight:700, color:C.gold }}>৳{fmt(m.billed)}</td>
                      <td style={{ padding:"10px 14px", fontWeight:700, color:C.green }}>৳{fmt(m.received)}</td>
                      <td style={{ padding:"10px 14px", fontWeight:700, color:C.red }}>৳{fmt(m.pending)}</td>
                    </tr>
                  ) : null
                ))}
              </tbody>
              {yearTotals.count > 0 && (
                <tfoot>
                  <tr style={{ background:"#fafaf8", fontWeight:800 }}>
                    <td style={{ padding:"10px 14px", fontSize:12 }}>Total</td>
                    <td style={{ padding:"10px 14px", fontSize:12 }}>{yearTotals.count}</td>
                    <td style={{ padding:"10px 14px", fontSize:12 }}>{yearTotals.guests||"—"}</td>
                    <td style={{ padding:"10px 14px", color:C.gold }}>৳{fmt(yearTotals.billed)}</td>
                    <td style={{ padding:"10px 14px", color:C.green }}>৳{fmt(yearTotals.received)}</td>
                    <td style={{ padding:"10px 14px", color:C.red }}>৳{fmt(yearTotals.pending)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ════════ INVOICES ════════ */}
      {tab==="invoices" && (
        <div>
          {/* Month picker card */}
          <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.gold}`, borderRadius:12, padding:"16px 20px", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10, marginBottom:14 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:800, color:C.maroon }}>🗓 Browse Invoices by Month</h3>
              <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <button onClick={()=>setInvYear(y=>y-1)} style={{ padding:"5px 11px", border:`1.5px solid ${C.border}`, borderRadius:7, background:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>‹</button>
                <span style={{ fontSize:15, fontWeight:700, color:C.red, minWidth:44, textAlign:"center" }}>{invYear}</span>
                <button onClick={()=>setInvYear(y=>y+1)} style={{ padding:"5px 11px", border:`1.5px solid ${C.border}`, borderRadius:7, background:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>›</button>
                <button onClick={clearMonths} style={{ padding:"5px 12px", border:`1.5px solid ${C.gold}`, borderRadius:7, background:"#fffbe8", color:"#7a5000", cursor:"pointer", fontSize:11, fontWeight:700 }}>Clear</button>
                <button onClick={selectAllYear} style={{ padding:"5px 12px", border:`1.5px solid ${C.maroon}`, borderRadius:7, background:"#fff0f0", color:C.maroon, cursor:"pointer", fontSize:11, fontWeight:700 }}>All Year</button>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:7, marginBottom:12 }}>
              {MONTHS_S.map((mo,i) => {
                const m = i+1;
                const prefix = `${invYear}-${String(m).padStart(2,"0")}`;
                const cnt = invoices.filter(inv=>(inv.invDate||inv.evDate||"").startsWith(prefix)).length;
                const sel = selMonths.includes(m);
                return (
                  <button key={m} onClick={()=>toggleMonth(m)} style={{
                    padding:"8px 4px", borderRadius:8, border:`2px solid ${sel?C.maroon:C.border}`,
                    background: sel?"#fff0f0":"#fafaf8", cursor:"pointer", fontFamily:"inherit",
                    fontWeight:700, fontSize:12, color:sel?C.maroon:C.dim, textAlign:"center", transition:".15s"
                  }}>
                    <div>{mo}</div>
                    {cnt > 0 && <div style={{ fontSize:9, color:sel?C.maroon:C.gold, marginTop:2 }}>{cnt} inv</div>}
                  </button>
                );
              })}
            </div>
            {selMonths.length > 0 && (
              <div style={{ padding:"10px 14px", background:"#f8f5ee", border:`1px solid ${C.border}`, borderRadius:9, fontSize:12, display:"flex", gap:20, flexWrap:"wrap" }}>
                <span><strong>{filteredInv.length}</strong> invoices selected</span>
                <span>Billed: <strong>৳{fmt(filteredInv.reduce((s,i)=>s+(i.grand||0),0))}</strong></span>
                <span>Received: <strong>৳{fmt(filteredInv.reduce((s,i)=>s+(parseFloat(i.adv)||0),0))}</strong></span>
              </div>
            )}
          </div>

          {/* Filter bar */}
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <div style={{ display:"flex", flex:1, minWidth:220, border:`1.5px solid #d0c8b8`, borderRadius:8, overflow:"hidden", background:"#fafaf8" }}>
              <select value={invSearchBy} onChange={e=>setInvSearchBy(e.target.value)}
                style={{ padding:"9px 10px", fontSize:12, fontWeight:700, color:C.maroon, background:"#fdf5ec", border:"none", borderRight:`1.5px solid #d0c8b8`, outline:"none", cursor:"pointer", minWidth:120, fontFamily:"inherit" }}>
                <option value="all">🔍 All Fields</option>
                <option value="num">Invoice #</option>
                <option value="client">Client Name</option>
                <option value="phone">Phone</option>
                <option value="event">Event Type</option>
                <option value="date">Event Date</option>
              </select>
              <input value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="Search..."
                style={{ border:"none", background:"transparent", flex:1, padding:"9px 12px", outline:"none", fontSize:13, fontFamily:"inherit" }} />
            </div>
            <select value={invFStatus} onChange={e=>setInvFStatus(e.target.value)} style={{ ...inp(), maxWidth:140 }}>
              <option value="">All Status</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial</option>
              <option value="Unpaid">Unpaid</option>
            </select>
            <select value={invFEvent} onChange={e=>setInvFEvent(e.target.value)} style={{ ...inp(), maxWidth:180 }}>
              <option value="">All Events</option>
              {EV_TYPES.map(t=><option key={t.v} value={t.v}>{t.v}</option>)}
            </select>
            <button onClick={exportInvCSV} style={{ padding:"9px 14px", borderRadius:8, border:`1.5px solid ${C.border}`, background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>⬇ Excel</button>
          </div>

          {/* Bulk action bar */}
          {selectedIds.length > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:"#fff8e1", border:`1.5px solid ${C.gold}`, borderRadius:10, marginBottom:10 }}>
              <span style={{ fontSize:13, fontWeight:700, color:"#7a5000" }}>{selectedIds.length} selected</span>
              <button onClick={()=>setSelectedIds([])} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:`1px solid ${C.gold}`, background:"#fff", cursor:"pointer", fontWeight:600 }}>Deselect All</button>
              {isAdmin && (
                <button onClick={bulkDelete} style={{ fontSize:12, padding:"6px 14px", borderRadius:7, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontWeight:700, marginLeft:"auto" }}>🗑 Delete {selectedIds.length} Invoice{selectedIds.length>1?"s":""}</button>
              )}
            </div>
          )}

          {/* Invoice table */}
          <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:720 }}>
              <thead>
                <tr style={{ background:"#fafaf8" }}>
                  <th style={{ padding:"10px 12px", borderBottom:`1.5px solid ${C.border}`, width:36 }}>
                    <input type="checkbox"
                      checked={filteredInv.length > 0 && selectedIds.length === filteredInv.length}
                      onChange={toggleSelectAll}
                      style={{ cursor:"pointer", accentColor:C.maroon, width:15, height:15 }} />
                  </th>
                  {["Invoice #","Client","Event","Date","Guests","Total","Balance","Status","Actions"].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", fontSize:10, color:C.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C.border}`, textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredInv.length===0 ? (
                  <tr><td colSpan={10} style={{ textAlign:"center", padding:24, color:C.dim, fontSize:13 }}>No invoices found.</td></tr>
                ) : filteredInv.map(inv => {
                  const isSel = selectedIds.includes(inv.id);
                  return (
                    <tr key={inv.id} onClick={()=>setViewInv(inv)}
                      style={{ borderBottom:"1px solid #f0ede8", cursor:"pointer", background: isSel?"#fff8e1":"transparent", transition:"background .12s" }}
                      onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background="#fdf8f0"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background=isSel?"#fff8e1":"transparent"; }}>
                      <td style={{ padding:"10px 12px" }} onClick={e=>toggleSelect(inv.id,e)}>
                        <input type="checkbox" checked={isSel} onChange={()=>{}} style={{ cursor:"pointer", accentColor:C.maroon, width:15, height:15 }} />
                      </td>
                      <td style={{ padding:"10px 12px", fontWeight:700, color:C.maroon, fontSize:12 }}>{inv.num}</td>
                      <td style={{ padding:"10px 12px" }}>
                        <div style={{ fontWeight:700, fontSize:13 }}>{inv.client}</div>
                        <div style={{ fontSize:10, color:C.dim }}>{inv.phone}</div>
                      </td>
                      <td style={{ padding:"10px 12px", fontSize:12 }}>{inv.evType}</td>
                      <td style={{ padding:"10px 12px", fontSize:12 }}>{fmtDate(inv.evDate)}</td>
                      <td style={{ padding:"10px 12px", fontSize:12 }}>{inv.wGuests||inv.hGuests||"—"}</td>
                      <td style={{ padding:"10px 12px", fontWeight:700, color:C.gold }}>৳{fmt(inv.grand)}</td>
                      <td style={{ padding:"10px 12px", fontWeight:700, color:C.red }}>৳{fmt(inv.balance)}</td>
                      <td style={{ padding:"10px 12px" }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:`${psColor(inv.payStatus)}18`, color:psColor(inv.payStatus), border:`1px solid ${psColor(inv.payStatus)}40` }}>{inv.payStatus}</span>
                      </td>
                      <td style={{ padding:"10px 12px" }} onClick={e=>e.stopPropagation()}>
                        {isAdmin && (
                          <button onClick={()=>{ if(window.confirm("Delete invoice "+inv.num+"?")){ setInvoices(prev=>prev.filter(i=>i.id!==inv.id)); void deleteHallInvoiceFromSupabase(inv.id).catch(err => { console.error("Failed to delete hall invoice from Supabase:", err); }); notify("Invoice deleted","success"); } }}
                            style={{ padding:"4px 8px", borderRadius:7, border:`1.5px solid ${C.red}40`, background:"#fff0f0", cursor:"pointer", fontSize:12 }}>🗑</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Invoice detail modal */}
          {viewInv && <InvoiceDetailModal inv={viewInv} onClose={()=>setViewInv(null)} isAdmin={isAdmin} onDelete={id=>{ setInvoices(prev=>prev.filter(i=>i.id!==id)); void deleteHallInvoiceFromSupabase(id).catch(()=>{}); notify("Invoice deleted","success"); setViewInv(null); }} />}
        </div>
      )}

      {/* ════════ REPORTS ════════ */}
      {tab==="reports" && (
        <div>
          {/* ── P&L ── */}
          {isAdmin && (() => {
            const pnlInv = pnlMonth==="all" ? invoices : invoices.filter(i=>(i.evDate||i.invDate||"").startsWith(pnlMonth));
            const pnlExp = pnlMonth==="all" ? expenses : expenses.filter(e=>(e.date||"").startsWith(pnlMonth));
            const inc = pnlInv.reduce((s,i)=>s+(parseFloat(i.adv)||0),0);
            const bil = pnlInv.reduce((s,i)=>s+(i.grand||0),0);
            const exp = pnlExp.reduce((s,e)=>s+(e.amount||0),0);
            const net = inc - exp;
            const mx  = Math.max(inc, exp, 1);
            const catTotals = {};
            pnlExp.forEach(e=>{ catTotals[e.cat]=(catTotals[e.cat]||0)+(e.amount||0); });
            const catSorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
            const mxC = catSorted.length ? catSorted[0][1] : 1;
            // build unique months for selector
            const allMonths = [...new Set([...invoices.map(i=>(i.evDate||i.invDate||"").slice(0,7)), ...expenses.map(e=>(e.date||"").slice(0,7))].filter(Boolean))].sort().reverse();
            return (
              <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.maroon}`, borderRadius:12, padding:"20px 22px", marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                  <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:C.maroon }}>📊 Profit &amp; Loss</h3>
                  <select value={pnlMonth} onChange={e=>setPnlMonth(e.target.value)} style={{ padding:"5px 10px", fontSize:12, border:`1px solid ${C.border}`, borderRadius:6, background:"#fafaf9", color:"#333", cursor:"pointer" }}>
                    <option value="all">All Time</option>
                    {allMonths.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                  <span style={{ fontSize:11, color:C.dim }}>Filter by month</span>
                </div>
                {/* Boxes */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:16 }}>
                  <div style={{ borderRadius:10, padding:"13px 15px", textAlign:"center", background:"rgba(74,170,128,.08)", border:"1px solid rgba(74,170,128,.2)" }}>
                    <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>💰 Received</div>
                    <div style={{ fontSize:18, fontWeight:800, color:C.green }}>৳ {fmt(inc)}</div>
                    <div style={{ fontSize:10, color:C.dim, marginTop:3 }}>Billed: ৳ {fmt(bil)}</div>
                  </div>
                  <div style={{ borderRadius:10, padding:"13px 15px", textAlign:"center", background:"rgba(217,95,95,.07)", border:"1px solid rgba(217,95,95,.18)" }}>
                    <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>💸 Expenses</div>
                    <div style={{ fontSize:18, fontWeight:800, color:C.red }}>৳ {fmt(exp)}</div>
                  </div>
                  <div style={{ borderRadius:10, padding:"13px 15px", textAlign:"center", background: net>=0?"rgba(200,168,75,.07)":"rgba(217,95,95,.1)", border: net>=0?"1px solid rgba(200,168,75,.2)":"1px solid rgba(217,95,95,.25)" }}>
                    <div style={{ fontSize:11, color:C.dim, marginBottom:4 }}>{net>=0?"📈 Net Profit":"📉 Net Loss"}</div>
                    <div style={{ fontSize:18, fontWeight:800, color: net>=0?C.gold:C.red }}>৳ {fmt(Math.abs(net))}</div>
                  </div>
                </div>
                {/* Bars */}
                <div style={{ marginBottom:14 }}>
                  {[{label:"💰 Received", val:inc, color:C.green},{label:"💸 Expenses", val:exp, color:C.red}].map(({label,val,color})=>(
                    <div key={label} style={{ marginBottom:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}><span>{label}</span><span style={{ fontWeight:700 }}>৳ {fmt(val)}</span></div>
                      <div style={{ height:10, background:"#f0ece4", borderRadius:5, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:Math.round(val/mx*100)+"%", background:color, borderRadius:5, transition:".5s" }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Category breakdown */}
                {catSorted.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:C.gold, marginBottom:9, fontWeight:700 }}>Category Breakdown</div>
                    {catSorted.map(([cat,amt])=>{
                      const ci = EXP_CATS[cat] || EXP_CATS['Other'];
                      const pct = Math.round(amt/mxC*100);
                      const share = exp>0 ? Math.round(amt/exp*100) : 0;
                      return (
                        <div key={cat} style={{ marginBottom:7 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                            <span><span style={{ background:ci.bg, color:ci.c, padding:"1px 6px", borderRadius:10, fontSize:9, fontWeight:700 }}>{ci.i} {cat}</span></span>
                            <span style={{ color:"#333", fontWeight:700 }}>৳ {fmt(amt)} <span style={{ color:C.dim, fontWeight:400 }}>({share}%)</span></span>
                          </div>
                          <div style={{ height:6, background:"#f0ece4", borderRadius:3, overflow:"hidden" }}>
                            <div style={{ height:"100%", width:pct+"%", background:ci.c, borderRadius:3, transition:".5s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Client Analytics ── */}
          <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.maroon}`, borderRadius:12, padding:"20px 22px", marginBottom:18 }}>
            <h3 style={{ margin:"0 0 16px", fontSize:15, fontWeight:800, color:C.maroon }}>📊 Client Analytics Report</h3>
            {invoices.length===0 ? (
              <div style={{ color:C.dim, fontSize:13, textAlign:"center", padding:20 }}>No invoices yet.</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:16 }}>
                {[
                  { title:"Event Popularity", data:analytics.evTypes, color:C.maroon },
                  { title:"How Clients Find Us", data:analytics.sources, color:C.blue },
                  { title:"Client Locations", data:analytics.areas, color:C.green },
                ].map(({ title, data, color }) => (
                  <div key={title} style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color, marginBottom:14 }}>{title}</div>
                    {!data.length ? <div style={{ color:C.dim, fontSize:12 }}>No data yet.</div> :
                      data.slice(0,8).map(([k,v]) => {
                        const pct = Math.round(v/data[0][1]*100);
                        return (
                          <div key={k} style={{ marginBottom:12 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                              <span style={{ fontWeight:600, color:"#333" }}>{k||"—"}</span>
                              <span style={{ fontSize:11, color:C.dim }}>{Math.round(v/invoices.length*100)}%</span>
                            </div>
                            <div style={{ height:8, background:"#f0ece4", borderRadius:4, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:pct+"%", background:color, borderRadius:4, transition:".4s" }} />
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ PASSWORD ════════ */}
      {tab==="password" && isAdmin && (
        <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.maroon}`, borderRadius:12, padding:"20px 22px" }}>
          <h3 style={{ margin:"0 0 18px", fontSize:15, fontWeight:800, color:C.maroon }}>🔐 Password Settings</h3>

          {/* Top row: Change Admin Password + Recovery Emails */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:24, marginBottom:28 }}>
            {/* Change Admin Password */}
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:C.maroon, marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>Change Admin Password</div>
              <div style={{ marginBottom:10 }}><label style={lbl}>Current Password</label><input type="password" value={pwCurrent} onChange={e=>setPwCurrent(e.target.value)} placeholder="Enter current password" style={inp()} /></div>
              <div style={{ marginBottom:10 }}><label style={lbl}>New Password</label><input type="password" value={pwNew} onChange={e=>setPwNew(e.target.value)} placeholder="Min 6 characters" style={inp()} /></div>
              <div style={{ marginBottom:10 }}><label style={lbl}>Confirm New Password</label><input type="password" value={pwConfirm} onChange={e=>setPwConfirm(e.target.value)} placeholder="Repeat new password" style={inp()} /></div>
              {pwErr && <div style={{ fontSize:11, color:C.red, fontWeight:600, marginBottom:10 }}>{pwErr}</div>}
              <button onClick={changePass} style={{ padding:"9px 20px", borderRadius:9, border:"none", background:C.maroon, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:12 }}>💾 Save New Password</button>
            </div>

            {/* Recovery Emails */}
            <div style={{ borderLeft:`1.5px solid ${C.border}`, paddingLeft:24 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.gold, marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>📧 Recovery Emails</div>
              <div style={{ background:"#fdf8ee", border:`1.5px solid #e0c878`, borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
                {recoveryEmails.map(em => (
                  <div key={em} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f0e8cc" }}>
                    <span style={{ fontSize:13, color:"#333" }}>📧 {em}</span>
                    <button onClick={()=>removeRecoveryEmail(em)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:16, lineHeight:1, padding:"0 4px" }} title="Remove">×</button>
                  </div>
                ))}
                <div style={{ display:"flex", gap:8, marginTop:12 }}>
                  <input value={newEmail} onChange={e=>{setNewEmail(e.target.value);setEmailErr("");}} placeholder="Add email address" style={inp({ flex:1 })} onKeyDown={e=>e.key==="Enter"&&addRecoveryEmail()} />
                  <button onClick={addRecoveryEmail} style={{ padding:"8px 14px", background:C.navy, border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>+ Add</button>
                </div>
                {emailErr && <div style={{ fontSize:11, color:C.red, marginTop:6, fontWeight:600 }}>{emailErr}</div>}
              </div>
              <div style={{ fontSize:11, color:"#888", lineHeight:1.5 }}>These emails can be used to recover access to the system.</div>
            </div>
          </div>

          {/* Staff Password Management */}
          <div style={{ borderTop:`1.5px solid ${C.border}`, paddingTop:22 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.navy, marginBottom:16, textTransform:"uppercase", letterSpacing:1 }}>👤 Staff Password Management</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              {STAFF_USERS.map(user => {
                const displayName = staffRenames[user] || (user==="staff" ? "Staff" : "Staff 2");
                const currentPw = getStaffPass(user);
                return (
                  <div key={user} style={{ background:"#f9f7ff", border:`1.5px solid #d0c0f0`, borderRadius:10, padding:"16px 18px" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:14 }}>👤 {displayName}</div>

                    {/* Rename */}
                    <div style={{ marginBottom:14, paddingBottom:14, borderBottom:`1px solid #e0d0f0` }}>
                      <label style={lbl}>Rename Username</label>
                      <div style={{ display:"flex", gap:8 }}>
                        <input value={staffRenameInput[user]||""} onChange={e=>setStaffRenameInput(m=>({...m,[user]:e.target.value}))} placeholder="Display name" style={inp({ flex:1 })} />
                        <button onClick={()=>renameStaff(user)} style={{ padding:"8px 12px", background:C.navy, border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>↩ Rename</button>
                      </div>
                    </div>

                    {/* Change password */}
                    <div>
                      <label style={lbl}>Current Password</label>
                      <div style={{ background:"#eef", border:"1px solid #ccc", borderRadius:6, padding:"7px 10px", fontSize:13, marginBottom:8, letterSpacing:2, color:"#555" }}>{currentPw ? "•".repeat(currentPw.length) : "—"}</div>
                      <div style={{ marginBottom:8 }}><label style={lbl}>New Password</label><input type="password" value={staffPwNew[user]||""} onChange={e=>setStaffPwNew(m=>({...m,[user]:e.target.value}))} placeholder="Min 4 characters" style={inp()} /></div>
                      <div style={{ marginBottom:8 }}><label style={lbl}>Confirm Password</label><input type="password" value={staffPwConfirm[user]||""} onChange={e=>setStaffPwConfirm(m=>({...m,[user]:e.target.value}))} placeholder="Repeat password" style={inp()} /></div>
                      {staffMsg[user] && <div style={{ fontSize:11, fontWeight:600, marginBottom:8, color: staffMsgType[user]==="success" ? C.green : C.red }}>{staffMsg[user]}</div>}
                      <button onClick={()=>changeStaffPass(user)} style={{ padding:"8px 18px", background:C.maroon, border:"none", borderRadius:7, color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer" }}>💾 Update Password</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ════════ DANGER ZONE ════════ */}
      {tab==="danger" && isAdmin && (
        <div style={{ background:"#fffafa", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.red}`, borderRadius:12, padding:"20px 22px" }}>
          <h3 style={{ margin:"0 0 18px", fontSize:15, fontWeight:800, color:C.red }}>⚠️ Danger Zone</h3>

          {/* Password field for all actions */}
          <div style={{ marginBottom:16, maxWidth:320 }}>
            <label style={lbl}>Admin Password (required for all actions)</label>
            <input type="password" value={dangerPass} onChange={e=>{setDangerPass(e.target.value);setDangerErr("");}} placeholder="Enter admin password" style={inp()} />
            {dangerErr && <div style={{ fontSize:11, color:C.red, marginTop:4, fontWeight:600 }}>{dangerErr}</div>}
          </div>

          {/* Clear invoices */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center", paddingBottom:14, borderBottom:`1px solid #fadada`, marginBottom:14 }}>
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:4 }}>Clear All Invoices</div>
              <div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>Permanently deletes every invoice. A backup is auto-saved. This cannot be undone.</div>
            </div>
            <button onClick={clearAllInvoices} style={{ padding:"10px 22px", background:C.red, color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>🗑 Clear All Invoices</button>
          </div>

          {/* Clear CRM leads */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:12, alignItems:"center" }}>
            <div style={{ flex:1, minWidth:220 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.red, marginBottom:4 }}>Clear All CRM Leads</div>
              <div style={{ fontSize:12, color:"#888", lineHeight:1.5 }}>Permanently deletes all CRM leads and enquiries. Invoices are not affected.</div>
            </div>
            <button onClick={clearAllLeads} style={{ padding:"10px 22px", background:C.red, color:"#fff", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>🗑 Clear All Leads</button>
          </div>
        </div>
      )}

      {/* ════════ SMS ════════ */}
      {tab==="insights" && <InsightsPanel invoices={invoices} expenses={expenses} leads={leads} />}
      {tab==="pricing" && isAdmin && <PricingRulesPanel notify={notify} />}
      {tab==="sms" && isAdmin && <SmsPanel notify={notify} isMobile={isMobile} invoices={invoices} />}
      {tab==="audit" && isAdmin && <AuditLogViewer scope="hall" title="Hall — Activity Audit Log" checkPassword={checkHallAdminPass} notify={notify} />}
      {tab==="loginlog" && isAdmin && <LoginActivityPanel notify={notify} />}
      {tab==="sync" && isAdmin && <SyncPanel notify={notify} invoices={invoices} expenses={expenses} revenues={revenues} leads={leads} />}

    </div>
  );
}

// ─── Sync to Cloud Panel ─────────────────────────────────────────────────────
function SyncPanel({ notify, invoices, expenses, revenues, leads }) {
  const [status, setStatus] = useState({});
  const [syncing, setSyncing] = useState(false);

  const steps = [
    { key: "leads",    label: "CRM Leads",       count: leads.length },
    { key: "expenses", label: "Hall Expenses",    count: expenses.length },
    { key: "revenues", label: "Hall Revenues",    count: revenues.length },
    { key: "pricing",  label: "Pricing Rules",    count: loadPricingRules().length },
    { key: "config",   label: "App Config (ntfy/WhatsApp)", count: 2 },
  ];

  async function syncAll() {
    if (!hasSupabase()) { notify("Supabase is not configured", "error"); return; }
    setSyncing(true);
    setStatus({});

    // CRM Leads
    try {
      const rows = leads.map(l => ({
        id: String(l.id), num: l.num || "", name: l.name || "", phone: l.phone || "",
        ev_type: l.evType || "", ev_date: l.evDate || "", guests: l.guests || "",
        source: l.source || "", stage: l.stage || "New Enquiry",
        follow_date: l.followDate || null, assigned: l.assigned || "admin",
        notes: l.notes || "", invoice_id: l.invoiceId || null, invoice_num: l.invoiceNum || null,
        updated_at: new Date().toISOString(),
      }));
      if (rows.length) await upsertRows("crm_leads", rows);
      setStatus(s => ({ ...s, leads: "✅" }));
    } catch { setStatus(s => ({ ...s, leads: "❌" })); }

    // Hall Expenses
    try {
      const rows = expenses.map(e => ({ id: String(e.id), date: e.date, category: e.category, amount: e.amount || 0, note: e.note || "", by: e.by || "" }));
      if (rows.length) await upsertRows("hall_expenses", rows);
      setStatus(s => ({ ...s, expenses: "✅" }));
    } catch { setStatus(s => ({ ...s, expenses: "❌" })); }

    // Hall Revenues
    try {
      const rows = revenues.map(r => ({ id: String(r.id), date: r.date, source: r.source, amount: r.amount || 0, note: r.note || "", by: r.by || "" }));
      if (rows.length) await upsertRows("hall_revenues", rows);
      setStatus(s => ({ ...s, revenues: "✅" }));
    } catch { setStatus(s => ({ ...s, revenues: "❌" })); }

    // Pricing Rules
    try {
      const rules = loadPricingRules();
      const rows = rules.map((r, i) => ({ id: String(r.id || `${r.evType}_${i}`), ev_type: r.evType || "", min_guests: parseInt(r.minGuests) || 0, max_guests: parseInt(r.maxGuests) || 999999, min_price: parseFloat(r.minPrice) || 0, max_price: parseFloat(r.maxPrice) || 0, notes: r.notes || "" }));
      if (rows.length) await upsertRows("pricing_rules", rows);
      setStatus(s => ({ ...s, pricing: "✅" }));
    } catch { setStatus(s => ({ ...s, pricing: "❌" })); }

    // App Config
    try {
      const ntfy = JSON.parse(localStorage.getItem("ga_ntfy_config") || "{}");
      const wa   = JSON.parse(localStorage.getItem("ga_wa_config")   || "{}");
      await saveConfig("ntfy_config", ntfy);
      await saveConfig("wa_config",   wa);
      setStatus(s => ({ ...s, config: "✅" }));
    } catch { setStatus(s => ({ ...s, config: "❌" })); }

    setSyncing(false);
    notify("All data pushed to Supabase ☁️", "success");
  }

  const card = { background:"#fff", border:"1.5px solid #e0d0b0", borderRadius:12, padding:"20px 22px", marginBottom:16 };

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:16, fontWeight:800, color:"#1a1a2e", marginBottom:6 }}>☁️ Push All Data to Supabase</div>
        <div style={{ fontSize:13, color:"#666", lineHeight:1.6 }}>
          This uploads all your existing local data to Supabase in one click.<br/>
          Run this once to make sure everything is online and visible from Denmark.
        </div>
      </div>

      <div style={card}>
        {steps.map(s => (
          <div key={s.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f0ede8" }}>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:"#1a1a2e" }}>{s.label}</div>
              <div style={{ fontSize:11, color:"#999" }}>{s.count} record{s.count !== 1 ? "s" : ""} in local storage</div>
            </div>
            <div style={{ fontSize:18 }}>
              {status[s.key] || (syncing ? "⏳" : "⬜")}
            </div>
          </div>
        ))}
      </div>

      <button onClick={syncAll} disabled={syncing} style={{
        width:"100%", padding:"14px", fontSize:15, fontWeight:800,
        background: syncing ? "#ccc" : "linear-gradient(135deg,#7B1212,#c0392b)",
        color:"#fff", border:"none", borderRadius:10, cursor: syncing ? "not-allowed" : "pointer",
        fontFamily:"inherit",
      }}>
        {syncing ? "⏳ Uploading to Supabase..." : "☁️ Push All Data to Supabase Now"}
      </button>

      <div style={{ marginTop:12, fontSize:11, color:"#999", textAlign:"center" }}>
        This is safe to run multiple times — it will not create duplicates.
      </div>
    </div>
  );
}

// ─── Login Activity Panel ─────────────────────────────────────────────────────
function LoginActivityPanel({ notify }) {
  const [log, setLog]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ga_login_monitor") ?? "true"); }
    catch { return true; }
  });

  function toggleMonitor(val) {
    setEnabled(val);
    localStorage.setItem("ga_login_monitor", JSON.stringify(val));
    notify(val ? "Login monitoring enabled ✅" : "Login monitoring disabled", val ? "success" : "info");
  }

  useEffect(() => {
    getUnusualLogins()
      .then(data => { setLog(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function fmtTs(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" })
      + " · " + d.toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" });
  }

  const card = { background:"#fff", border:"1.5px solid #e0d0b0", borderRadius:12, padding:"20px 22px", marginBottom:16 };

  return (
    <div>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:800, color:"#1a1a2e" }}>🔍 Unusual Login Activity</div>
          <div style={{ fontSize:12, color:"#666", marginTop:3 }}>
            Only shows logins from a new city, new network, or failed attempts. Normal logins are hidden.
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, background:"#fff", border:"1.5px solid #e0d0b0", borderRadius:10, padding:"10px 16px" }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:"#333" }}>Login Monitoring</div>
            <div style={{ fontSize:11, color: enabled ? "#1a7040" : "#999" }}>{enabled ? "Active — unusual logins are tracked" : "Disabled — no logins being recorded"}</div>
          </div>
          <div onClick={() => toggleMonitor(!enabled)}
            style={{ width:52, height:28, borderRadius:14, cursor:"pointer", flexShrink:0, background: enabled ? "#1a7a40" : "#ccc", position:"relative", transition:"background .25s" }}>
            <div style={{ position:"absolute", top:3, left: enabled ? 26 : 3, width:22, height:22, borderRadius:"50%", background:"#fff", transition:"left .25s", boxShadow:"0 1px 4px rgba(0,0,0,.2)" }} />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ ...card, textAlign:"center", color:"#999", fontSize:13, padding:40 }}>Loading…</div>
      ) : log.length === 0 ? (
        <div style={{ ...card, textAlign:"center", padding:40 }}>
          <div style={{ fontSize:28, marginBottom:10 }}>✅</div>
          <div style={{ fontSize:14, fontWeight:700, color:"#1a7040" }}>No unusual logins detected</div>
          <div style={{ fontSize:12, color:"#999", marginTop:6 }}>All logins are from known locations and devices.</div>
        </div>
      ) : (
        <>
          <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"12px 16px", marginBottom:14, fontSize:13, color:"#7a5c00", fontWeight:600 }}>
            ⚠️ {log.length} unusual login{log.length>1?"s":""} detected — review below
          </div>
          <div style={card}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"#fafaf8" }}>
                  {["Date & Time","User","Status","Device","Browser · OS","City","ISP / Network"].map(h => (
                    <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:800, color:"#666", textTransform:"uppercase", letterSpacing:.5, borderBottom:"1.5px solid #e0d0b0", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.map(e => (
                  <tr key={e.id} style={{ borderBottom:"1px solid #f0ede8", background: e.success ? "#fffdf0" : "#fff5f5" }}>
                    <td style={{ padding:"9px 12px", whiteSpace:"nowrap", color:"#444" }}>{fmtTs(e.created_at)}</td>
                    <td style={{ padding:"9px 12px", fontWeight:700, color:"#7B1212" }}>{e.username}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:700, background: e.success?"#fff8e1":"#fdf0f0", color: e.success?"#b45309":"#c0392b", border:`1px solid ${e.success?"#f0c04060":"#c0392b40"}` }}>
                        {e.success ? "⚠️ New Location" : "❌ Failed Attempt"}
                      </span>
                    </td>
                    <td style={{ padding:"9px 12px", color:"#444" }}>{e.device}</td>
                    <td style={{ padding:"9px 12px", color:"#444" }}>{e.browser} · {e.os}</td>
                    <td style={{ padding:"9px 12px", color:"#444", fontWeight:600 }}>{e.city}, {e.country}</td>
                    <td style={{ padding:"9px 12px", color:"#666", fontSize:11 }}>{e.isp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── Business Insights Panel ───────────────────────────────────────────────────
function InsightsPanel({ invoices, expenses, leads }) {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,"0")}`;
  const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function fmt(n) { return Number(n||0).toLocaleString(); }
  function fmtD(iso) {
    if (!iso) return "—";
    const [y,m,d] = iso.split("-");
    const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${parseInt(d)} ${M[parseInt(m)-1]}`;
  }
  function pct(a, b) {
    if (!b) return null;
    const diff = Math.round((a - b) / b * 100);
    return diff;
  }
  function arrow(diff) {
    if (diff === null) return null;
    const color = diff >= 0 ? "#1a7040" : "#c0392b";
    return <span style={{ color, fontWeight:700, fontSize:12 }}>{diff >= 0 ? "▲" : "▼"} {Math.abs(diff)}%</span>;
  }

  const thisInv  = invoices.filter(i => (i.evDate||i.invDate||"").startsWith(thisMonth));
  const lastInv  = invoices.filter(i => (i.evDate||i.invDate||"").startsWith(lastMonth));
  const thisExp  = expenses.filter(e => (e.date||"").startsWith(thisMonth));

  const thisBilled   = thisInv.reduce((s,i)=>s+(i.grand||0),0);
  const thisReceived = thisInv.reduce((s,i)=>s+(parseFloat(i.adv)||0),0);
  const thisOutstand = thisInv.reduce((s,i)=>s+(i.balance??Math.max(0,(i.grand||0)-(parseFloat(i.adv)||0))),0);
  const thisExpTotal = thisExp.reduce((s,e)=>s+(e.amount||0),0);

  const lastBilled   = lastInv.reduce((s,i)=>s+(i.grand||0),0);
  const lastReceived = lastInv.reduce((s,i)=>s+(parseFloat(i.adv)||0),0);

  // Upcoming events — next 30 days
  const today = now.toISOString().split("T")[0];
  const in30  = new Date(now); in30.setDate(in30.getDate()+30);
  const in30s = in30.toISOString().split("T")[0];
  const upcoming = invoices
    .filter(i => (i.evDate||"") >= today && (i.evDate||"") <= in30s)
    .sort((a,b)=>(a.evDate||"")>(b.evDate||"")?1:-1);

  // All overdue outstanding (event date past, balance > 0)
  const overdue = invoices
    .filter(i => (i.evDate||"") < today && (i.balance??Math.max(0,(i.grand||0)-(parseFloat(i.adv)||0))) > 0)
    .sort((a,b)=>(b.balance??0)-(a.balance??0))
    .slice(0,5);

  // Best event type by avg revenue
  const byType = {};
  invoices.forEach(i => {
    if (!i.evType||!i.grand) return;
    if (!byType[i.evType]) byType[i.evType]={ total:0, count:0 };
    byType[i.evType].total += i.grand;
    byType[i.evType].count++;
  });
  const bestType = Object.entries(byType).sort((a,b)=>(b[1].total/b[1].count)-(a[1].total/a[1].count))[0];

  // Busiest month historically
  const byMonth = {};
  invoices.forEach(i => {
    const m = (i.evDate||i.invDate||"").slice(5,7);
    if (m) byMonth[m] = (byMonth[m]||0)+1;
  });
  const busiestMonth = Object.entries(byMonth).sort((a,b)=>b[1]-a[1])[0];

  // CRM conversion rate
  const totalLeads = leads.length;
  const converted = leads.filter(l=>l.stage==="Confirmed"||l.invoiced).length;
  const convRate = totalLeads ? Math.round(converted/totalLeads*100) : null;

  const card = (extra={}) => ({ background:"#fff", border:"1.5px solid #e0d0b0", borderRadius:12, padding:"18px 20px", marginBottom:14, ...extra });
  const secTitle = { fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#7B1212", fontWeight:800, marginBottom:14 };

  return (
    <div>
      {/* ── This month summary ── */}
      <div style={card({ borderTop:"3px solid #c9a84c" })}>
        <div style={secTitle}>📅 {MONTHS_FULL[now.getMonth()]} {now.getFullYear()} — at a glance</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:12, marginBottom:14 }}>
          {[
            { label:"Invoices", val:thisInv.length, sub:lastInv.length ? `${lastInv.length} last month` : null },
            { label:"Billed", val:"৳"+fmt(thisBilled), diff:pct(thisBilled,lastBilled) },
            { label:"Received", val:"৳"+fmt(thisReceived), diff:pct(thisReceived,lastReceived) },
            { label:"Outstanding", val:"৳"+fmt(thisOutstand), color:thisOutstand>0?"#c0392b":"#1a7040" },
            { label:"Expenses", val:"৳"+fmt(thisExpTotal) },
            { label:"Net (Received−Exp)", val:"৳"+fmt(thisReceived-thisExpTotal), color:thisReceived-thisExpTotal>=0?"#1a7040":"#c0392b" },
          ].map(({ label, val, diff, sub, color })=>(
            <div key={label} style={{ background:"#fafaf8", border:"1px solid #f0ede8", borderRadius:9, padding:"12px 14px" }}>
              <div style={{ fontSize:10, color:"#999", textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:color||"#111" }}>{val}</div>
              {diff !== undefined && diff !== null && <div style={{ marginTop:3 }}>{arrow(diff)} <span style={{ fontSize:11, color:"#999" }}>vs last month</span></div>}
              {sub && <div style={{ fontSize:11, color:"#999", marginTop:3 }}>{sub}</div>}
            </div>
          ))}
        </div>

        {/* Plain-English summary */}
        <div style={{ background:"#f8f5ee", border:"1px solid #e0d0b0", borderRadius:9, padding:"12px 16px", fontSize:13, lineHeight:1.8, color:"#333" }}>
          {thisInv.length === 0
            ? <span>No invoices recorded for {MONTHS_FULL[now.getMonth()]} yet.</span>
            : <>
                <strong>{MONTHS_FULL[now.getMonth()]} {now.getFullYear()}:</strong>{" "}
                {thisInv.length} invoice{thisInv.length>1?"s":""}, ৳{fmt(thisBilled)} billed, ৳{fmt(thisReceived)} received.{" "}
                {thisOutstand > 0
                  ? <span style={{ color:"#c0392b" }}>৳{fmt(thisOutstand)} still outstanding.</span>
                  : <span style={{ color:"#1a7040" }}>All payments collected ✓</span>}
                {lastBilled > 0 && <>{" "}Compared to {MONTHS_FULL[lastMonthDate.getMonth()]}: revenue {pct(thisBilled,lastBilled) >= 0 ? "up" : "down"} {Math.abs(pct(thisBilled,lastBilled))}%.</>}
                {bestType && <>{" "}Best event type overall: <strong>{bestType[0]}</strong> (avg ৳{fmt(Math.round(bestType[1].total/bestType[1].count))}).</>}
              </>
          }
        </div>
      </div>

      {/* ── Overdue outstanding ── */}
      {overdue.length > 0 && (
        <div style={card({ borderTop:"3px solid #c0392b" })}>
          <div style={secTitle}>🚨 Overdue Outstanding Payments</div>
          <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>Event date has passed but balance not fully collected.</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ background:"#fafaf8" }}>
                {["Client","Phone","Event","Event Date","Balance Due"].map(h=>(
                  <th key={h} style={{ padding:"8px 10px", fontSize:10, color:"#999", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, borderBottom:"1.5px solid #f0ede8", textAlign:"left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {overdue.map(inv => {
                const bal = inv.balance ?? Math.max(0,(inv.grand||0)-(parseFloat(inv.adv)||0));
                return (
                  <tr key={inv.id} style={{ borderBottom:"1px solid #f9f5f0" }}>
                    <td style={{ padding:"9px 10px", fontWeight:700, fontSize:13 }}>{inv.client}</td>
                    <td style={{ padding:"9px 10px", fontSize:12, color:"#666" }}>{inv.phone}</td>
                    <td style={{ padding:"9px 10px", fontSize:12 }}>{inv.evType}</td>
                    <td style={{ padding:"9px 10px", fontSize:12 }}>{fmtD(inv.evDate)}</td>
                    <td style={{ padding:"9px 10px", fontWeight:800, color:"#c0392b", fontSize:13 }}>৳{fmt(bal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Upcoming events ── */}
      <div style={card({ borderTop:"3px solid #1a56cb" })}>
        <div style={secTitle}>📅 Upcoming Events — Next 30 Days</div>
        {upcoming.length === 0
          ? <div style={{ color:"#999", fontSize:13 }}>No events scheduled in the next 30 days.</div>
          : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#fafaf8" }}>
                  {["Event Date","Client","Event Type","Total","Balance","Status"].map(h=>(
                    <th key={h} style={{ padding:"8px 10px", fontSize:10, color:"#999", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, borderBottom:"1.5px solid #f0ede8", textAlign:"left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcoming.map(inv => {
                  const bal = inv.balance ?? Math.max(0,(inv.grand||0)-(parseFloat(inv.adv)||0));
                  const psColor = inv.payStatus==="Paid"?"#1a7040":inv.payStatus==="Partial"?"#a07000":"#c0392b";
                  const daysLeft = Math.round((new Date(inv.evDate)-now)/(1000*60*60*24));
                  return (
                    <tr key={inv.id} style={{ borderBottom:"1px solid #f9f5f0", background: daysLeft<=3?"#fff8f0":"transparent" }}>
                      <td style={{ padding:"9px 10px", fontWeight:700, fontSize:13 }}>
                        {fmtD(inv.evDate)}
                        {daysLeft<=3 && <span style={{ marginLeft:6, fontSize:10, background:"#ffe0b0", color:"#8a4000", padding:"1px 6px", borderRadius:10, fontWeight:700 }}>{daysLeft}d</span>}
                      </td>
                      <td style={{ padding:"9px 10px", fontSize:13 }}>{inv.client}</td>
                      <td style={{ padding:"9px 10px", fontSize:12 }}>{inv.evType}</td>
                      <td style={{ padding:"9px 10px", fontSize:13, color:"#c9a84c", fontWeight:700 }}>৳{fmt(inv.grand)}</td>
                      <td style={{ padding:"9px 10px", fontSize:13, color: bal>0?"#c0392b":"#1a7040", fontWeight:700 }}>{bal>0 ? "৳"+fmt(bal) : "✓ Paid"}</td>
                      <td style={{ padding:"9px 10px" }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:`${psColor}18`, color:psColor, border:`1px solid ${psColor}40` }}>{inv.payStatus}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
      </div>

      {/* ── Historical patterns ── */}
      <div style={card({ borderTop:"3px solid #1a7040" })}>
        <div style={secTitle}>📈 Historical Patterns (All Time)</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:12 }}>
          {[
            { label:"Total invoices ever", val: invoices.length },
            { label:"Total billed (all time)", val:"৳"+fmt(invoices.reduce((s,i)=>s+(i.grand||0),0)) },
            { label:"Total received (all time)", val:"৳"+fmt(invoices.reduce((s,i)=>s+(parseFloat(i.adv)||0),0)) },
            bestType ? { label:"Best event type", val:bestType[0], sub:`avg ৳${fmt(Math.round(bestType[1].total/bestType[1].count))} · ${bestType[1].count} bookings` } : null,
            busiestMonth ? { label:"Historically busiest month", val: MONTHS_FULL[parseInt(busiestMonth[0])-1], sub:`${busiestMonth[1]} bookings recorded` } : null,
            convRate !== null ? { label:"CRM conversion rate", val: convRate+"%", sub:`${converted} of ${totalLeads} leads confirmed` } : null,
          ].filter(Boolean).map(({ label, val, sub })=>(
            <div key={label} style={{ background:"#fafaf8", border:"1px solid #f0ede8", borderRadius:9, padding:"12px 14px" }}>
              <div style={{ fontSize:10, color:"#999", textTransform:"uppercase", letterSpacing:.5, marginBottom:4 }}>{label}</div>
              <div style={{ fontSize:17, fontWeight:800, color:"#111" }}>{val}</div>
              {sub && <div style={{ fontSize:11, color:"#999", marginTop:3 }}>{sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pricing Rules Panel ────────────────────────────────────────────────────────
const blankRule = () => ({ id:"", evType:"", minGuests:"", maxGuests:"", minPrice:"", maxPrice:"", notes:"" });

function PricingRulesPanel({ notify }) {
  const [rules, setRules] = useState(loadPricingRules);
  const [form, setForm] = useState(blankRule());
  const [editId, setEditId] = useState(null);

  useEffect(() => {
    syncPricingRulesFromSupabase().then(() => setRules(loadPricingRules())).catch(() => {});
  }, []);

  const sf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function saveRule() {
    if (!form.evType) { notify("Select an event type", "error"); return; }
    if (!form.minPrice && !form.maxPrice) { notify("Enter at least a price", "error"); return; }
    let updated;
    if (editId) {
      updated = rules.map(r => r.id === editId ? { ...form, id: editId } : r);
    } else {
      updated = [...rules, { ...form, id: String(Date.now()) }];
    }
    savePricingRules(updated);
    setRules(updated);
    setForm(blankRule());
    setEditId(null);
    notify(editId ? "Rule updated ✅" : "Rule added ✅", "success");
  }

  function deleteRule(id) {
    if (!window.confirm("Delete this pricing rule?")) return;
    const updated = rules.filter(r => r.id !== id);
    savePricingRules(updated);
    setRules(updated);
    notify("Rule deleted", "success");
  }

  function editRule(r) {
    setForm({ ...r });
    setEditId(r.id);
  }

  const inp2 = (s={}) => ({ padding:"9px 12px", border:"1.5px solid #e5e3de", borderRadius:8, fontSize:13, fontFamily:"inherit", background:"#fafaf9", width:"100%", boxSizing:"border-box", outline:"none", ...s });
  const lbl2 = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };
  const C2 = { maroon:"#7B1212", gold:"#c9a84c", border:"#e0d0b0", dim:"#666", green:"#1a7040", red:"#c0392b" };

  return (
    <div>
      <div style={{ background:"#fff", border:`1.5px solid ${C2.border}`, borderTop:`3px solid ${C2.gold}`, borderRadius:12, padding:"20px 22px", marginBottom:16 }}>
        <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:C2.maroon, fontWeight:800, marginBottom:4 }}>💰 Pricing Rules</div>
        <div style={{ fontSize:13, color:C2.dim, lineHeight:1.7, marginBottom:16 }}>
          Set your standard pricing for each event type and guest range. These rules appear as hints when staff adds a new CRM enquiry — so they can quote the right price while the client is on the phone.
        </div>

        {/* Rules table */}
        {rules.length === 0
          ? <div style={{ background:"#fafaf8", border:"1px dashed #e0d0b0", borderRadius:9, padding:"22px", textAlign:"center", color:C2.dim, fontSize:13, marginBottom:16 }}>
              No pricing rules yet. Add your first rule below.
            </div>
          : (
            <div style={{ overflowX:"auto", marginBottom:16 }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:620 }}>
                <thead>
                  <tr style={{ background:"#fafaf8" }}>
                    {["Event Type","Min Guests","Max Guests","Min Price (৳)","Max Price (৳)","Notes",""].map(h=>(
                      <th key={h} style={{ padding:"9px 12px", fontSize:10, color:C2.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C2.border}`, textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map(r => (
                    <tr key={r.id} style={{ borderBottom:"1px solid #f0ede8" }}>
                      <td style={{ padding:"10px 12px", fontWeight:700, fontSize:13 }}>{r.evType}</td>
                      <td style={{ padding:"10px 12px", fontSize:13 }}>{r.minGuests||"—"}</td>
                      <td style={{ padding:"10px 12px", fontSize:13 }}>{r.maxGuests||"any"}</td>
                      <td style={{ padding:"10px 12px", fontSize:13, color:C2.green, fontWeight:700 }}>{r.minPrice ? "৳"+Number(r.minPrice).toLocaleString() : "—"}</td>
                      <td style={{ padding:"10px 12px", fontSize:13, color:C2.gold, fontWeight:700 }}>{r.maxPrice ? "৳"+Number(r.maxPrice).toLocaleString() : "—"}</td>
                      <td style={{ padding:"10px 12px", fontSize:12, color:C2.dim, maxWidth:180 }}>{r.notes||"—"}</td>
                      <td style={{ padding:"10px 12px", whiteSpace:"nowrap" }}>
                        <button onClick={()=>editRule(r)} style={{ padding:"4px 9px", borderRadius:6, border:`1.5px solid ${C2.border}`, background:"#fff", cursor:"pointer", fontSize:11, fontWeight:700, marginRight:6 }}>✏️</button>
                        <button onClick={()=>deleteRule(r.id)} style={{ padding:"4px 9px", borderRadius:6, border:`1.5px solid ${C2.red}40`, background:"#fff0f0", cursor:"pointer", fontSize:11 }}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        {/* Add / Edit form */}
        <div style={{ background:"#fafaf8", border:`1px solid ${C2.border}`, borderRadius:10, padding:"16px 18px" }}>
          <div style={{ fontSize:12, fontWeight:800, color:C2.maroon, marginBottom:14 }}>{editId ? "✏️ Edit Rule" : "➕ Add New Rule"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:12 }}>
            <div>
              <label style={lbl2}>Event Type *</label>
              <select value={form.evType} onChange={e=>sf("evType",e.target.value)} style={inp2()}>
                <option value="">— Select —</option>
                {EV_TYPES.map(t=><option key={t.v} value={t.v}>{t.v}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl2}>Min Guests</label>
              <input type="number" value={form.minGuests} onChange={e=>sf("minGuests",e.target.value)} placeholder="e.g. 100" style={inp2()} />
            </div>
            <div>
              <label style={lbl2}>Max Guests</label>
              <input type="number" value={form.maxGuests} onChange={e=>sf("maxGuests",e.target.value)} placeholder="e.g. 300" style={inp2()} />
            </div>
            <div>
              <label style={lbl2}>Min Price (৳)</label>
              <input type="text" inputMode="numeric" value={form.minPrice} onChange={e=>sf("minPrice",e.target.value.replace(/[^\d]/g,""))} placeholder="e.g. 15000" style={inp2()} />
            </div>
            <div>
              <label style={lbl2}>Max Price (৳)</label>
              <input type="text" inputMode="numeric" value={form.maxPrice} onChange={e=>sf("maxPrice",e.target.value.replace(/[^\d]/g,""))} placeholder="e.g. 22000" style={inp2()} />
            </div>
            <div>
              <label style={lbl2}>Notes (optional)</label>
              <input value={form.notes} onChange={e=>sf("notes",e.target.value)} placeholder="e.g. Peak season" style={inp2()} />
            </div>
          </div>
          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            {editId && <button onClick={()=>{ setForm(blankRule()); setEditId(null); }} style={{ padding:"8px 16px", borderRadius:8, border:`1.5px solid ${C2.border}`, background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:12 }}>Cancel</button>}
            <button onClick={saveRule} style={{ padding:"8px 20px", borderRadius:8, border:"none", background:C2.maroon, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:12 }}>{editId ? "💾 Update Rule" : "➕ Add Rule"}</button>
          </div>
        </div>

        <div style={{ marginTop:14, padding:"10px 14px", background:"#fff8e1", border:"1px solid #e0c878", borderRadius:8, fontSize:12, color:"#7a5800", lineHeight:1.7 }}>
          <strong>How it works:</strong> When staff opens the CRM and selects an event type with a guest count, the matching rule appears as a price hint. Multiple rules can exist for the same event type with different guest ranges — the closest match is shown.
        </div>
      </div>
    </div>
  );
}

// ── Invoice Detail Modal ───────────────────────────────────────────────────────
function printAdminInvoice(inv) {
  const MONTHS_S2 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function fd(iso) {
    if (!iso) return "—";
    const [y,m,d] = iso.split("-");
    return `${parseInt(d)} ${MONTHS_S2[parseInt(m)-1]} ${y}`;
  }
  function fc(n) { return Number(n||0).toLocaleString(); }
  const isHolud = (inv.evType||"").toLowerCase().includes("holud") || (inv.evType||"").toLowerCase().includes("wedding");
  const hasHolud = (inv.evType||"").toLowerCase().includes("holud");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.num||""}</title>
  <style>
    body{margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f5f0ea;color:#111;}
    .page{max-width:720px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.12);}
    .header{background:linear-gradient(135deg,#4a0a0a,#7B1212);color:#fff;padding:28px 32px;display:flex;justify-content:space-between;align-items:center;}
    .hall-name{font-size:22px;font-weight:800;letter-spacing:.5px;}
    .tagline{font-size:11px;opacity:.75;margin-top:3px;}
    .inv-num{text-align:right;}
    .inv-num .num{font-size:18px;font-weight:800;color:#f0c860;}
    .inv-num .dt{font-size:11px;opacity:.75;margin-top:4px;}
    .body{padding:28px 32px;}
    .section{margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f0ede8;}
    .section:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}
    .sec-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7B1212;font-weight:800;margin-bottom:12px;}
    .row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
    .field label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;display:block;margin-bottom:3px;}
    .field .val{font-size:13px;font-weight:600;color:#111;}
    .event-box{border-radius:8px;padding:12px 14px;margin-bottom:10px;}
    .event-box.holud{background:#fff8e1;border:1.5px solid #d4a800;}
    .event-box.wedding{background:#fff0f0;border:1.5px solid #e07070;}
    .event-box.generic{background:#f0f4ff;border:1.5px solid #7090cc;}
    .event-box .ev-title{font-size:9px;letter-spacing:2px;text-transform:uppercase;font-weight:800;margin-bottom:8px;}
    .ev-row{display:flex;gap:6px;margin-bottom:4px;align-items:baseline;}
    .ev-row .ev-lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:#7B1212;min-width:70px;}
    .ev-row .ev-val{font-size:12px;font-weight:600;color:#111;}
    table.fin{width:100%;border-collapse:collapse;}
    table.fin td,table.fin th{padding:9px 12px;font-size:12px;border-bottom:1px solid #f0ede8;text-align:left;}
    table.fin th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#999;font-weight:700;background:#fafaf8;}
    table.fin .total-row td{font-weight:800;font-size:13px;border-top:2px solid #e0d0b0;border-bottom:none;}
    .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;}
    .badge.paid{background:#eafaf1;color:#1a7040;border:1px solid #1a704040;}
    .badge.partial{background:#fff8e1;color:#a07000;border:1px solid #c9a84c60;}
    .badge.unpaid{background:#fff0f0;color:#c0392b;border:1px solid #c0392b40;}
    .notes-box{background:#fafaf8;border:1px solid #e5e0d8;border-radius:8px;padding:12px 14px;font-size:12px;color:#555;line-height:1.6;}
    .voter-img{max-width:100%;border-radius:8px;margin-top:8px;border:1.5px solid #e0d0b0;}
    @media print{body{background:#fff;}.page{box-shadow:none;border-radius:0;}}
  </style></head><body>
  <div class="page">
    <div class="header">
      <div>
        <div class="hall-name">Amelia Convention Hall</div>
        <div class="tagline">Convention &amp; Banquet Management</div>
      </div>
      <div class="inv-num">
        <div class="num">${inv.num||"DRAFT"}</div>
        <div class="dt">Date: ${fd(inv.invDate||inv.evDate)}</div>
        <div style="margin-top:6px"><span class="badge ${(inv.payStatus||"").toLowerCase()}">${inv.payStatus||"—"}</span></div>
      </div>
    </div>
    <div class="body">

      <!-- Client Info -->
      <div class="section">
        <div class="sec-title">Client Information</div>
        <div class="row2">
          <div class="field"><label>Full Name</label><div class="val">${inv.client||"—"}</div></div>
          <div class="field"><label>Phone</label><div class="val">${inv.phone||"—"}</div></div>
          ${inv.address ? `<div class="field" style="grid-column:1/-1"><label>Address</label><div class="val">${inv.address}</div></div>` : ""}
        </div>
        ${inv.voterIdData ? `<div style="margin-top:10px"><div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:4px">Voter ID Card</div><img src="${inv.voterIdData}" class="voter-img" style="max-height:140px;object-fit:contain;" /></div>` : ""}
      </div>

      <!-- Event Details -->
      <div class="section">
        <div class="sec-title">Event Details</div>
        <div class="field" style="margin-bottom:12px"><label>Event Type</label><div class="val">${inv.evType||"—"}</div></div>
        ${hasHolud ? `
          <div class="event-box holud">
            <div class="ev-title" style="color:#8a6200">🌼 Holud Ceremony</div>
            ${inv.hDate ? `<div class="ev-row"><span class="ev-lbl">Date</span><span class="ev-val">${fd(inv.hDate)}</span></div>` : ""}
            ${(inv.hStart||inv.hEnd) ? `<div class="ev-row"><span class="ev-lbl">Time</span><span class="ev-val">${inv.hStart||"?"}${(inv.hStart||inv.hEnd)?" – ":""}${inv.hEnd||"?"}</span></div>` : ""}
            ${(inv.hGuests||inv.hTables) ? `<div class="ev-row"><span class="ev-lbl">Guests</span><span class="ev-val">${inv.hGuests?inv.hGuests+" guests":""}${(inv.hGuests&&inv.hTables)?" · ":""}${inv.hTables?inv.hTables+" tables":""}</span></div>` : ""}
          </div>
          <div class="event-box wedding">
            <div class="ev-title" style="color:#7B1212">💒 Wedding Ceremony</div>
            ${inv.evDate ? `<div class="ev-row"><span class="ev-lbl">Date</span><span class="ev-val">${fd(inv.evDate)}</span></div>` : ""}
            ${(inv.wStart||inv.wEnd) ? `<div class="ev-row"><span class="ev-lbl">Time</span><span class="ev-val">${inv.wStart||"?"}${(inv.wStart||inv.wEnd)?" – ":""}${inv.wEnd||"?"}</span></div>` : ""}
            ${(inv.wGuests||inv.wTables) ? `<div class="ev-row"><span class="ev-lbl">Guests</span><span class="ev-val">${inv.wGuests?inv.wGuests+" guests":""}${(inv.wGuests&&inv.wTables)?" · ":""}${inv.wTables?inv.wTables+" tables":""}</span></div>` : ""}
            ${(inv.wBride||inv.wGroom) ? `${inv.wBride?`<div class="ev-row"><span class="ev-lbl">Bride</span><span class="ev-val">${inv.wBride}</span></div>`:""}${inv.wGroom?`<div class="ev-row"><span class="ev-lbl">Groom</span><span class="ev-val">${inv.wGroom}</span></div>`:""}` : ""}
          </div>
        ` : `
          <div class="event-box generic">
            <div class="ev-title" style="color:#305090">📅 Event Schedule</div>
            ${inv.evDate ? `<div class="ev-row"><span class="ev-lbl">Date</span><span class="ev-val">${fd(inv.evDate)}</span></div>` : ""}
            ${(inv.wStart||inv.wEnd) ? `<div class="ev-row"><span class="ev-lbl">Time</span><span class="ev-val">${inv.wStart||"?"}${(inv.wStart||inv.wEnd)?" – ":""}${inv.wEnd||"?"}</span></div>` : ""}
            ${(inv.wGuests||inv.wTables||inv.guests) ? `<div class="ev-row"><span class="ev-lbl">Guests</span><span class="ev-val">${inv.wGuests||inv.guests||""}${((inv.wGuests||inv.guests)&&inv.wTables)?" · ":""}${inv.wTables?inv.wTables+" tables":""}</span></div>` : ""}
          </div>
        `}
      </div>

      <!-- Financial Summary -->
      <div class="section">
        <div class="sec-title">Financial Summary</div>
        <table class="fin">
          <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>
            <tr><td>Hall Booking Total</td><td style="text-align:right;font-weight:600">৳ ${fc(inv.grand)}</td></tr>
            ${inv.waiterTotal ? `<tr><td>Waiter Cost</td><td style="text-align:right;font-weight:600">৳ ${fc(inv.waiterTotal)}</td></tr>` : ""}
            ${(inv.discount||inv.discAmt) ? `<tr><td>Discount</td><td style="text-align:right;color:#c0392b">− ৳ ${fc(inv.discount||inv.discAmt)}</td></tr>` : ""}
            <tr><td>Advance Paid</td><td style="text-align:right;color:#1a7040">৳ ${fc(inv.adv)}</td></tr>
            ${inv.waiterCostPaid ? `<tr><td>Waiter Cost Paid</td><td style="text-align:right;color:#1a7040">৳ ${fc(inv.waiterCostPaid)}</td></tr>` : ""}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td>Balance Due</td>
              <td style="text-align:right;color:#c0392b">৳ ${fc(inv.balance ?? Math.max(0,(inv.grand||0)-(parseFloat(inv.adv)||0)))}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      ${inv.notes ? `<div class="section"><div class="sec-title">Notes</div><div class="notes-box">${inv.notes}</div></div>` : ""}
    </div>
  </div>
  <script>window.print();</script>
  </body></html>`;

  const w = window.open("","_blank","width=780,height=900");
  if (w) { w.document.write(html); w.document.close(); }
}

function InvoiceDetailModal({ inv, onClose, isAdmin, onDelete }) {
  function fd(iso) {
    if (!iso) return "—";
    const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const [y,m,d] = iso.split("-");
    return `${parseInt(d)} ${M[parseInt(m)-1]} ${y}`;
  }
  function fc(n) { return Number(n||0).toLocaleString(); }
  const isHolud = (inv.evType||"").toLowerCase().includes("holud");
  const psColor2 = (ps) => ps==="Paid"?"#1a7040":ps==="Partial"?"#a07000":"#c0392b";
  const psBg = (ps) => ps==="Paid"?"#eafaf1":ps==="Partial"?"#fff8e1":"#fff0f0";

  const row = (label, value) => value ? (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:"#999", marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, fontWeight:600, color:"#111" }}>{value}</div>
    </div>
  ) : null;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:9999, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"20px 10px", overflowY:"auto" }}
      onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:720, boxShadow:"0 8px 40px rgba(0,0,0,.25)", overflow:"hidden" }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#4a0a0a,#7B1212)", color:"#fff", padding:"22px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, opacity:.7, letterSpacing:1.5, textTransform:"uppercase", marginBottom:4 }}>Convention Hall Invoice</div>
            <div style={{ fontSize:22, fontWeight:800, color:"#f0c860" }}>{inv.num||"DRAFT"}</div>
            <div style={{ fontSize:12, opacity:.75, marginTop:4 }}>Created: {fd(inv.invDate||inv.evDate)}</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:10 }}>
            <div style={{ padding:"4px 14px", borderRadius:20, background:psBg(inv.payStatus), color:psColor2(inv.payStatus), fontWeight:700, fontSize:12 }}>{inv.payStatus||"—"}</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>printAdminInvoice(inv)} style={{ padding:"7px 14px", borderRadius:8, border:"none", background:"#f0c860", color:"#4a0a0a", cursor:"pointer", fontWeight:700, fontSize:12 }}>🖨 Print</button>
              {isAdmin && <button onClick={()=>{ if(window.confirm("Delete "+inv.num+"?")) onDelete(inv.id); }} style={{ padding:"7px 12px", borderRadius:8, border:"none", background:"rgba(255,255,255,.2)", color:"#fff", cursor:"pointer", fontWeight:700, fontSize:12 }}>🗑</button>}
              <button onClick={onClose} style={{ padding:"7px 12px", borderRadius:8, border:"none", background:"rgba(255,255,255,.15)", color:"#fff", cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
            </div>
          </div>
        </div>

        <div style={{ padding:"24px 28px" }}>

          {/* Client Info */}
          <div style={{ marginBottom:20, paddingBottom:20, borderBottom:"1.5px solid #f0ede8" }}>
            <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#7B1212", fontWeight:800, marginBottom:14 }}>Client Information</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {row("Full Name", inv.client)}
              {row("Phone", inv.phone)}
              {row("Address", inv.address)}
            </div>
            {inv.voterIdData && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:1, color:"#999", marginBottom:6 }}>Voter ID Card</div>
                <img src={inv.voterIdData} alt="Voter ID" style={{ maxHeight:140, maxWidth:"100%", borderRadius:8, border:"1.5px solid #e0d0b0", objectFit:"contain" }} />
              </div>
            )}
          </div>

          {/* Event Details */}
          <div style={{ marginBottom:20, paddingBottom:20, borderBottom:"1.5px solid #f0ede8" }}>
            <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#7B1212", fontWeight:800, marginBottom:14 }}>Event Details</div>
            <div style={{ marginBottom:12 }}>{row("Event Type", inv.evType)}</div>
            {isHolud ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ background:"#fff8e1", border:"1.5px solid #d4a800", borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"#8a6200", fontWeight:800, marginBottom:10 }}>🌼 Holud</div>
                  {row("Date", fd(inv.hDate))}
                  {(inv.hStart||inv.hEnd) && row("Time", `${inv.hStart||"?"}  –  ${inv.hEnd||"?"}`)}
                  {(inv.hGuests||inv.hTables) && row("Guests/Tables", `${inv.hGuests?inv.hGuests+" guests":""}${inv.hGuests&&inv.hTables?" · ":""}${inv.hTables?inv.hTables+" tables":""}`)}
                </div>
                <div style={{ background:"#fff0f0", border:"1.5px solid #e07070", borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:"#7B1212", fontWeight:800, marginBottom:10 }}>💒 Wedding</div>
                  {row("Date", fd(inv.evDate))}
                  {(inv.wStart||inv.wEnd) && row("Time", `${inv.wStart||"?"}  –  ${inv.wEnd||"?"}`)}
                  {(inv.wGuests||inv.wTables) && row("Guests/Tables", `${inv.wGuests?inv.wGuests+" guests":""}${inv.wGuests&&inv.wTables?" · ":""}${inv.wTables?inv.wTables+" tables":""}`)}
                  {inv.wBride && row("Bride", inv.wBride)}
                  {inv.wGroom && row("Groom", inv.wGroom)}
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {row("Event Date", fd(inv.evDate))}
                {(inv.wStart||inv.wEnd) && row("Time", `${inv.wStart||"?"}  –  ${inv.wEnd||"?"}`)}
                {(inv.wGuests||inv.guests) && row("Guests", inv.wGuests||inv.guests)}
                {inv.wTables && row("Tables", inv.wTables)}
              </div>
            )}
          </div>

          {/* Financials */}
          <div style={{ marginBottom: inv.notes ? 20 : 0, paddingBottom: inv.notes ? 20 : 0, borderBottom: inv.notes ? "1.5px solid #f0ede8" : "none" }}>
            <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#7B1212", fontWeight:800, marginBottom:14 }}>Financial Summary</div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#fafaf8" }}>
                  {["Description","Amount"].map(h=><th key={h} style={{ padding:"8px 12px", fontSize:10, color:"#999", fontWeight:700, textTransform:"uppercase", letterSpacing:.5, borderBottom:"1.5px solid #f0ede8", textAlign:h==="Amount"?"right":"left" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Hall Booking Total", `৳ ${fc(inv.grand)}`, "#111"],
                  inv.waiterTotal ? ["Waiter Cost", `৳ ${fc(inv.waiterTotal)}`, "#111"] : null,
                  (inv.discount||inv.discAmt) ? ["Discount", `− ৳ ${fc(inv.discount||inv.discAmt)}`, "#c0392b"] : null,
                  ["Advance Paid", `৳ ${fc(inv.adv)}`, "#1a7040"],
                  inv.waiterCostPaid ? ["Waiter Cost Paid", `৳ ${fc(inv.waiterCostPaid)}`, "#1a7040"] : null,
                ].filter(Boolean).map(([label,val,color])=>(
                  <tr key={label} style={{ borderBottom:"1px solid #f0ede8" }}>
                    <td style={{ padding:"9px 12px", fontSize:13, color:"#333" }}>{label}</td>
                    <td style={{ padding:"9px 12px", fontSize:13, fontWeight:600, color, textAlign:"right" }}>{val}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:"2.5px solid #e0d0b0" }}>
                  <td style={{ padding:"10px 12px", fontWeight:800, fontSize:14 }}>Balance Due</td>
                  <td style={{ padding:"10px 12px", fontWeight:800, fontSize:14, color:"#c0392b", textAlign:"right" }}>৳ {fc(inv.balance ?? Math.max(0,(inv.grand||0)-(parseFloat(inv.adv)||0)))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div>
              <div style={{ fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#7B1212", fontWeight:800, marginBottom:10 }}>Notes</div>
              <div style={{ background:"#fafaf8", border:"1px solid #e5e0d8", borderRadius:8, padding:"12px 14px", fontSize:13, color:"#555", lineHeight:1.6 }}>{inv.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SMS helpers ────────────────────────────────────────────────────────────────
const SMS_KEY = "ga_sms_config";
const DEFAULT_TEMPLATE = `Dear {name}, thank you for booking Amelia Convention Hall!\n\nYour {evType} is confirmed for {date}.\nTotal: {amount} | Paid: {advance} | Due: {balance}\nInvoice: {invNum}\n\nAmelia Convention Hall\n+880 1838-616405`;

export function loadSmsConfig() {
  try { return JSON.parse(localStorage.getItem(SMS_KEY) || "null") || { enabled:false, apiUrl:"", apiKey:"", senderId:"", template:DEFAULT_TEMPLATE }; }
  catch { return { enabled:false, apiUrl:"", apiKey:"", senderId:"", template:DEFAULT_TEMPLATE }; }
}

function saveSmsConfig(cfg) { localStorage.setItem(SMS_KEY, JSON.stringify(cfg)); }

export async function sendSmsForInvoice(inv) {
  const cfg = loadSmsConfig();
  if (!cfg.enabled || !cfg.apiUrl || !cfg.apiKey) return { ok:false, reason:"SMS not configured" };
  const phone = (inv.phone||"").replace(/\D/g,"");
  if (!phone) return { ok:false, reason:"No phone number" };

  const msg = cfg.template
    .replace(/{name}/g,    inv.client||"")
    .replace(/{evType}/g,  inv.evType||"")
    .replace(/{date}/g,    fmtDate(inv.evDate))
    .replace(/{amount}/g,  "৳"+(inv.grand||0).toLocaleString())
    .replace(/{advance}/g, "৳"+(parseFloat(inv.adv)||0).toLocaleString())
    .replace(/{balance}/g, "৳"+(Math.max(0,(inv.grand||0)-(parseFloat(inv.adv)||0))).toLocaleString())
    .replace(/{invNum}/g,  inv.num||"")
    .replace(/{phone}/g,   inv.phone||"");

  try {
    const url = cfg.apiUrl
      .replace("{phone}",  encodeURIComponent(phone))
      .replace("{apiKey}", encodeURIComponent(cfg.apiKey))
      .replace("{sender}", encodeURIComponent(cfg.senderId||"Amelia"))
      .replace("{msg}",    encodeURIComponent(msg));

    const res = await fetch(url, { method: cfg.apiMethod==="POST" ? "POST" : "GET" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  } catch(e) {
    return { ok:false, reason: e.message };
  }
}

// ── SMS Panel component ────────────────────────────────────────────────────────
const VARIABLES = [
  ["{name}",    "Client full name"],
  ["{evType}",  "Event type (Wedding, etc.)"],
  ["{date}",    "Event date (formatted)"],
  ["{amount}",  "Grand total with ৳"],
  ["{advance}", "Advance paid with ৳"],
  ["{balance}", "Balance due with ৳"],
  ["{invNum}",  "Invoice number (ACH-00001)"],
  ["{phone}",   "Client phone number"],
];

function SmsPanel({ notify, isMobile, invoices }) {
  const [cfg, setCfg] = useState(loadSmsConfig);
  const [saved, setSaved] = useState(false);
  const [waCfg, setWaCfg] = useState(loadWaConfig);
  const [waSaved, setWaSaved] = useState(false);
  const [ntfyCfg, setNtfyCfg] = useState(loadNtfyConfig);
  const [ntfySaved, setNtfySaved] = useState(false);
  const [ntfyTesting, setNtfyTesting] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testLog, setTestLog] = useState(null);
  const [smsLog, setSmsLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem("ga_sms_log")||"[]"); } catch { return []; }
  });

  function set(k, v) { setCfg(p => ({ ...p, [k]:v })); setSaved(false); }
  function setWa(k, v) { setWaCfg(p => ({ ...p, [k]:v })); setWaSaved(false); }
  function saveWa() { saveWaConfig(waCfg); setWaSaved(true); notify("WhatsApp settings saved ✅","success"); setTimeout(()=>setWaSaved(false),2500); }
  function setNtfy(k, v) { setNtfyCfg(p => ({ ...p, [k]:v })); setNtfySaved(false); }
  function saveNtfy() { saveNtfyConfig(ntfyCfg); setNtfySaved(true); notify("Notification settings saved ✅","success"); setTimeout(()=>setNtfySaved(false),2500); }
  async function testNtfy() {
    if (!ntfyCfg.topic) { notify("Enter your ntfy topic name first","error"); return; }
    setNtfyTesting(true);
    try {
      await sendNtfyAlert("Test Alert - L-M Group", "This is a test notification from your booking system. It is working!", ntfyCfg.topic);
      notify("Test notification sent! Check your ntfy app 📱","success");
    } catch(e) {
      notify("Failed to send: " + (e?.message || "unknown error"), "error");
    }
    setNtfyTesting(false);
  }
  async function testWa() {
    if (!waCfg.num1 || !waCfg.key1) { notify("Enter at least Number 1 and API Key 1","error"); return; }
    setWaTesting(true);
    const msg = "✅ *Test Alert from Grand Alayna*\n\nThis is a test notification from your booking system. If you received this, WhatsApp alerts are working!";
    await sendWhatsAppAlert(msg);
    setWaTesting(false);
    notify("Test WhatsApp sent! Check your phone 📱","success");
  }

  function save() {
    saveSmsConfig(cfg);
    setSaved(true);
    notify("SMS settings saved ✅","success");
    setTimeout(()=>setSaved(false), 2500);
  }

  async function sendTest() {
    if (!testPhone.trim()) { notify("Enter a test phone number","error"); return; }
    if (!cfg.apiUrl || !cfg.apiKey) { notify("Please fill in API URL and API Key first","error"); return; }
    setTestSending(true); setTestLog(null);
    const fakeInv = {
      client:"Test Client", evType:"Wedding", evDate: new Date().toISOString().split("T")[0],
      grand:50000, adv:20000, num:"ACH-00001", phone: testPhone,
    };
    const result = await sendSmsForInvoice({ ...fakeInv, phone: testPhone });
    setTestSending(false);
    setTestLog(result);
    notify(result.ok ? "Test SMS sent ✅" : "Test SMS failed ❌", result.ok?"success":"error");
  }

  const previewMsg = cfg.template
    .replace(/{name}/g,    "Rahim Uddin")
    .replace(/{evType}/g,  "Wedding")
    .replace(/{date}/g,    "20 June 2026")
    .replace(/{amount}/g,  "৳80,000")
    .replace(/{advance}/g, "৳30,000")
    .replace(/{balance}/g, "৳50,000")
    .replace(/{invNum}/g,  "ACH-00042")
    .replace(/{phone}/g,   "01712-345678");

  const card = (extra={}) => ({ background:"#fff", border:`1.5px solid #e0d0b0`, borderRadius:12, padding:"20px 22px", marginBottom:16, ...extra });
  const lbl  = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:6, display:"block" };
  const inp  = (extra={}) => ({ width:"100%", padding:"10px 13px", border:"1.5px solid #e0d0b0", borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", background:"#fafaf8", boxSizing:"border-box", ...extra });

  return (
    <div>
      {/* ── Enable toggle ── */}
      <div style={card()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#1a1a2e", marginBottom:4 }}>📱 Auto SMS on Booking</div>
            <div style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>
              Automatically send a welcome SMS to the client when a booking is saved.<br/>
              <strong>Note:</strong> SMS is not sent for Leads — only confirmed bookings.
            </div>
          </div>
          <div
            onClick={() => set("enabled", !cfg.enabled)}
            style={{
              width:52, height:28, borderRadius:14, cursor:"pointer", flexShrink:0,
              background: cfg.enabled ? "#1a7a40" : "#ccc",
              position:"relative", transition:"background .25s",
              boxShadow: cfg.enabled ? "0 0 0 3px rgba(26,122,64,.15)" : "none",
            }}
          >
            <div style={{
              position:"absolute", top:3, left: cfg.enabled?26:3,
              width:22, height:22, borderRadius:"50%", background:"#fff",
              boxShadow:"0 1px 4px rgba(0,0,0,.25)", transition:"left .25s",
            }} />
          </div>
        </div>
        <div style={{ marginTop:12, padding:"8px 12px", borderRadius:8,
          background: cfg.enabled ? "#eafaf1" : "#fafaf8",
          border: `1px solid ${cfg.enabled?"#86efac":"#e0d0b0"}`,
          fontSize:12, fontWeight:600, color: cfg.enabled?"#1a7a40":"#888",
        }}>
          {cfg.enabled ? "✅ Auto SMS is ENABLED — SMS will send on every confirmed booking save" : "⏸ Auto SMS is DISABLED — no messages will be sent"}
        </div>
      </div>

      {/* ── API Configuration ── */}
      <div style={card()}>
        <div style={{ fontSize:13, fontWeight:800, color:"#7B1212", marginBottom:16, paddingBottom:10, borderBottom:"1.5px solid #f0e0d0" }}>
          🔌 SMS API Configuration
        </div>

        <div style={{ background:"#fffbe8", border:"1px solid #e0c878", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#7a5800", lineHeight:1.7 }}>
          <strong>How to connect your SMS provider:</strong><br/>
          Paste your API endpoint in the URL field below. Use placeholders:<br/>
          <code style={{ background:"rgba(0,0,0,.06)", padding:"1px 5px", borderRadius:4 }}>{"{apiKey}"}</code> &nbsp;
          <code style={{ background:"rgba(0,0,0,.06)", padding:"1px 5px", borderRadius:4 }}>{"{sender}"}</code> &nbsp;
          <code style={{ background:"rgba(0,0,0,.06)", padding:"1px 5px", borderRadius:4 }}>{"{phone}"}</code> &nbsp;
          <code style={{ background:"rgba(0,0,0,.06)", padding:"1px 5px", borderRadius:4 }}>{"{msg}"}</code><br/>
          <strong>Example (SSL Wireless):</strong><br/>
          <code style={{ fontSize:10, wordBreak:"break-all" }}>
            https://sms.sslwireless.com/pushapi/dynamic/server.php?api_token={"{apiKey}"}&sid={"{sender}"}&msisdn={"{phone}"}&sms={"{msg}"}&csmsid=BOOKING
          </code>
        </div>

        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:12 }}>
          <div style={{ gridColumn: isMobile?"1":"1 / -1" }}>
            <label style={lbl}>API Endpoint URL</label>
            <input value={cfg.apiUrl} onChange={e=>set("apiUrl",e.target.value)}
              placeholder="https://your-sms-provider.com/api?api_token={apiKey}&..."
              style={inp()} />
          </div>
          <div>
            <label style={lbl}>API Key / Token</label>
            <input value={cfg.apiKey} onChange={e=>set("apiKey",e.target.value)}
              placeholder="Your API key or token"
              style={inp()} type="password" />
          </div>
          <div>
            <label style={lbl}>Sender ID / From Name</label>
            <input value={cfg.senderId} onChange={e=>set("senderId",e.target.value)}
              placeholder="e.g. AmeliaHall"
              style={inp()} />
          </div>
          <div>
            <label style={lbl}>HTTP Method</label>
            <select value={cfg.apiMethod||"GET"} onChange={e=>set("apiMethod",e.target.value)} style={inp()}>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Message Template ── */}
      <div style={card()}>
        <div style={{ fontSize:13, fontWeight:800, color:"#7B1212", marginBottom:16, paddingBottom:10, borderBottom:"1.5px solid #f0e0d0" }}>
          ✍️ Message Template
        </div>

        {/* Variable chips */}
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:8 }}>Available Variables — click to copy</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {VARIABLES.map(([v, desc]) => (
              <div key={v}
                onClick={() => { navigator.clipboard?.writeText(v); notify(`Copied ${v}`,"info"); }}
                title={desc}
                style={{ padding:"4px 10px", borderRadius:20, background:"#f0e8ff", border:"1px solid #c9a8f0", fontSize:11, fontWeight:700, color:"#6030b0", cursor:"pointer", userSelect:"none" }}>
                {v}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:16 }}>
          <div>
            <label style={lbl}>Edit Template</label>
            <textarea
              value={cfg.template}
              onChange={e=>set("template",e.target.value)}
              rows={9}
              style={{ ...inp(), resize:"vertical", lineHeight:1.7, fontFamily:"monospace", fontSize:12 }}
            />
            <div style={{ fontSize:11, color:"#888", marginTop:4 }}>
              Characters: <strong>{cfg.template.length}</strong> / 160 per SMS segment
            </div>
          </div>
          <div>
            <label style={lbl}>Live Preview (sample data)</label>
            <div style={{ background:"#1a1a2e", borderRadius:10, padding:"14px 16px", minHeight:200, fontFamily:"monospace", fontSize:12, color:"#e8d5ff", lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
              {previewMsg}
            </div>
            <div style={{ fontSize:11, color:"#888", marginTop:6, fontStyle:"italic" }}>This is what the client will receive</div>
          </div>
        </div>

        {/* Reset to default */}
        <div style={{ marginTop:12, display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={()=>set("template",DEFAULT_TEMPLATE)} style={{ padding:"7px 14px", borderRadius:8, border:"1.5px solid #e0d0b0", background:"#fff", color:"#555", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            ↺ Reset to Default
          </button>
        </div>
      </div>

      {/* ── Save & Test ── */}
      <div style={card()}>
        <div style={{ fontSize:13, fontWeight:800, color:"#7B1212", marginBottom:16, paddingBottom:10, borderBottom:"1.5px solid #f0e0d0" }}>
          💾 Save & Test
        </div>
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:16 }}>
          <div>
            <button onClick={save} style={{ width:"100%", padding:"13px", background: saved?"#1a7a40":"linear-gradient(135deg,#7B1212,#9a1515)", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", letterSpacing:.5, transition:"background .25s" }}>
              {saved ? "✅ Saved!" : "💾 Save SMS Settings"}
            </button>
          </div>
          <div>
            <div style={{ display:"flex", gap:8 }}>
              <input
                value={testPhone} onChange={e=>setTestPhone(e.target.value)}
                placeholder="Test phone number"
                style={{ ...inp(), flex:1 }}
              />
              <button onClick={sendTest} disabled={testSending} style={{ padding:"10px 16px", background:"linear-gradient(135deg,#c9a84c,#e8c96c)", border:"none", borderRadius:10, fontSize:13, fontWeight:800, cursor:"pointer", color:"#1a0a00", fontFamily:"inherit", whiteSpace:"nowrap", flexShrink:0, opacity:testSending?0.6:1 }}>
                {testSending ? "Sending…" : "📤 Send Test"}
              </button>
            </div>
            {testLog && (
              <div style={{ marginTop:8, padding:"8px 12px", borderRadius:8, fontSize:11, fontWeight:600,
                background: testLog.ok?"#eafaf1":"#fdf0f0",
                border: `1px solid ${testLog.ok?"#86efac":"#fca5a5"}`,
                color: testLog.ok?"#1a7a40":"#c0392b",
              }}>
                {testLog.ok ? `✅ Sent! Status: ${testLog.status}` : `❌ Failed: ${testLog.reason||testLog.body||"Unknown error"}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Send log ── */}
      {smsLog.length > 0 && (
        <div style={card()}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#7B1212" }}>📋 Recent SMS Log</div>
            <button onClick={()=>{ localStorage.removeItem("ga_sms_log"); setSmsLog([]); }} style={{ fontSize:11, color:"#c0392b", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>Clear Log</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {smsLog.slice(0,10).map((entry,i) => (
              <div key={i} style={{ padding:"8px 12px", borderRadius:8, background: entry.ok?"#eafaf1":"#fdf0f0", border:`1px solid ${entry.ok?"#86efac":"#fca5a5"}`, fontSize:12, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                <div>
                  <span style={{ fontWeight:700, color: entry.ok?"#1a7a40":"#c0392b" }}>{entry.ok?"✅":"❌"} {entry.client}</span>
                  <span style={{ color:"#888", marginLeft:8 }}>{entry.phone}</span>
                  <span style={{ color:"#aaa", marginLeft:8, fontSize:10 }}>{entry.invNum}</span>
                </div>
                <div style={{ fontSize:10, color:"#888" }}>{entry.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── WhatsApp Owner Alerts ── */}
      <div style={{ ...card(), borderTop:"3px solid #25D366", marginTop:24 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#128C7E", marginBottom:4 }}>💬 WhatsApp Owner Alerts (CallMeBot)</div>
            <div style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>
              Get instant WhatsApp notifications in Denmark when a booking is made — for both Hotel and Hall.<br/>
              <strong>Free service.</strong> Each recipient needs their own CallMeBot API key.
            </div>
          </div>
          <div
            onClick={() => setWa("enabled", !waCfg.enabled)}
            style={{ width:52, height:28, borderRadius:14, cursor:"pointer", flexShrink:0,
              background: waCfg.enabled ? "#25D366" : "#ccc",
              position:"relative", transition:"background .25s",
              boxShadow: waCfg.enabled ? "0 0 0 3px rgba(37,211,102,.2)" : "none",
            }}
          >
            <div style={{ position:"absolute", top:3, left: waCfg.enabled?26:3,
              width:22, height:22, borderRadius:"50%", background:"#fff",
              boxShadow:"0 1px 4px rgba(0,0,0,.25)", transition:"left .25s" }} />
          </div>
        </div>

        {/* Activation instructions */}
        <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:10, padding:"12px 16px", marginBottom:18, fontSize:12, color:"#166534", lineHeight:1.8 }}>
          <strong>⚡ How to activate (one-time, takes 2 min):</strong><br/>
          1. Open WhatsApp → add <strong>+34 644 29 18 53</strong> as a contact (name it "CallMeBot")<br/>
          2. Send them this exact message: <strong>I allow callmebot to send me messages</strong><br/>
          3. They reply with your API key — paste it below<br/>
          4. Save your Danish number as <strong>+4512345678</strong> format (with country code, no spaces)
        </div>

        {/* Number fields */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:16 }}>
          <div>
            <label style={lbl}>📱 Your WhatsApp Number (with +45)</label>
            <input value={waCfg.num1} onChange={e=>setWa("num1",e.target.value)}
              placeholder="+4512345678"
              style={inp()} />
          </div>
          <div>
            <label style={lbl}>🔑 Your CallMeBot API Key</label>
            <input value={waCfg.key1} onChange={e=>setWa("key1",e.target.value)}
              placeholder="e.g. 1234567"
              style={inp()} type="password" />
          </div>
          <div>
            <label style={lbl}>📱 Wife's WhatsApp Number (optional)</label>
            <input value={waCfg.num2} onChange={e=>setWa("num2",e.target.value)}
              placeholder="+4598765432"
              style={inp()} />
          </div>
          <div>
            <label style={lbl}>🔑 Wife's CallMeBot API Key (optional)</label>
            <input value={waCfg.key2} onChange={e=>setWa("key2",e.target.value)}
              placeholder="e.g. 7654321"
              style={inp()} type="password" />
          </div>
        </div>

        {/* Templates */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:16 }}>
          <div>
            <label style={lbl}>🏛 Hall Booking Message Template</label>
            <textarea value={waCfg.hallTemplate} onChange={e=>setWa("hallTemplate",e.target.value)}
              rows={7} style={{ ...inp(), resize:"vertical", fontFamily:"monospace", fontSize:12, lineHeight:1.7 }} />
            <div style={{ fontSize:10, color:"#888", marginTop:3 }}>Variables: {"{name}"} {"{evType}"} {"{date}"} {"{amount}"} {"{advance}"} {"{balance}"} {"{invNum}"} {"{phone}"}</div>
          </div>
          <div>
            <label style={lbl}>🏨 Hotel Booking Message Template</label>
            <textarea value={waCfg.hotelTemplate} onChange={e=>setWa("hotelTemplate",e.target.value)}
              rows={7} style={{ ...inp(), resize:"vertical", fontFamily:"monospace", fontSize:12, lineHeight:1.7 }} />
            <div style={{ fontSize:10, color:"#888", marginTop:3 }}>Variables: {"{guest}"} {"{room}"} {"{checkin}"} {"{checkout}"} {"{nights}"} {"{total}"} {"{advance}"}</div>
          </div>
        </div>

        {/* Save & Test */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={saveWa} style={{ flex:1, minWidth:140, padding:"12px", background: waSaved?"#1a7a40":"linear-gradient(135deg,#128C7E,#25D366)", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
            {waSaved ? "✅ Saved!" : "💾 Save WhatsApp Settings"}
          </button>
          <button onClick={testWa} disabled={waTesting} style={{ flex:1, minWidth:140, padding:"12px", background:"linear-gradient(135deg,#c9a84c,#e8c96c)", color:"#1a0a00", border:"none", borderRadius:10, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity:waTesting?0.6:1 }}>
            {waTesting ? "Sending…" : "📲 Send Test Message"}
          </button>
        </div>
        <div style={{ marginTop:10, fontSize:11, color:"#888", fontStyle:"italic" }}>
          Both you and your wife will receive the test message if both numbers are configured.
        </div>
      </div>

      {/* ── ntfy Push Notifications ── */}
      <div style={card({ borderTop:"3px solid #7B1212" })}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:"#1a1a2e", marginBottom:4 }}>🔔 Push Notifications (ntfy)</div>
            <div style={{ fontSize:12, color:"#666", lineHeight:1.6 }}>
              Free instant alerts on your phone via the <strong>ntfy</strong> app — no WhatsApp needed.<br/>
              Install <strong>ntfy</strong> from Play Store / App Store, then subscribe to your topic below.
            </div>
          </div>
          <div onClick={() => setNtfy("enabled", !ntfyCfg.enabled)}
            style={{ width:52, height:28, borderRadius:14, cursor:"pointer", flexShrink:0, background: ntfyCfg.enabled?"#1a7a40":"#ccc", position:"relative", transition:"background .25s" }}>
            <div style={{ position:"absolute", top:3, left: ntfyCfg.enabled?26:3, width:22, height:22, borderRadius:"50%", background:"#fff", transition:"left .25s", boxShadow:"0 1px 4px rgba(0,0,0,.2)" }} />
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <label style={lbl}>Your ntfy Topic Name</label>
          <input value={ntfyCfg.topic || ""} onChange={e => setNtfy("topic", e.target.value)}
            placeholder="e.g. L-m-group-hall-hotel-alart"
            style={inp()} />
          <div style={{ fontSize:11, color:"#888", marginTop:5 }}>
            This is the topic you subscribed to in the ntfy app. It must match exactly.
          </div>
        </div>

        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <button onClick={saveNtfy} style={{ flex:1, minWidth:140, padding:"12px", background: ntfySaved?"#1a7a40":"#7B1212", color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
            {ntfySaved ? "✅ Saved!" : "💾 Save Notification Settings"}
          </button>
          <button onClick={testNtfy} disabled={ntfyTesting} style={{ flex:1, minWidth:140, padding:"12px", background:"linear-gradient(135deg,#c9a84c,#e8c96c)", color:"#1a0a00", border:"none", borderRadius:10, fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit", opacity:ntfyTesting?0.6:1 }}>
            {ntfyTesting ? "Sending…" : "📲 Send Test Notification"}
          </button>
        </div>
      </div>
    </div>
  );
}
