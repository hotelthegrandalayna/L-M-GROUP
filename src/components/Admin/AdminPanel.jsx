import { useState } from "react";
import { useApp } from "../../context/AppContext";
import AdminFinance from "./AdminFinance";
import AdminRooms   from "./AdminRooms";
import AdminStaff   from "./AdminStaff";
import AdminData    from "./AdminData";
import AdminSMS       from "./AdminSMS";
import AdminInvoices  from "./AdminInvoices";
import AuditLogViewer from "../AuditLogViewer";
import { checkAdminPassword } from "../../utils/auth";
import { hasSupabase, upsertRows, saveConfig } from "../../utils/supabaseSync";
import { collectLocalPasswords } from "../../utils/userPass";

const TABS = [
  { key:"finance",  label:"Finance",  icon:"ti-currency-taka"  },
  { key:"rooms",    label:"Rooms",    icon:"ti-building"       },
  { key:"invoices", label:"Invoices", icon:"ti-file-invoice"   },
  { key:"sms",      label:"Messages", icon:"ti-message-circle" },
  { key:"audit",    label:"Audit Log",icon:"ti-eye"            },
  { key:"staff",    label:"Staff",    icon:"ti-users"          },
  { key:"data",     label:"Data",     icon:"ti-database"       },
  { key:"sync",     label:"Sync Cloud",icon:"ti-cloud-upload"  },
];

export default function AdminPanel() {
  const { curRole, notify } = useApp();
  const [tab, setTab] = useState("finance");

  if (curRole !== "admin" && curRole !== "manager") {
    return (
      <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>
        <i className="ti ti-lock" style={{ fontSize:40, display:"block", marginBottom:12 }} />
        <div style={{ fontSize:16, fontWeight:700 }}>Access Restricted</div>
        <div style={{ fontSize:13 }}>Admin panel is only available to administrators and managers.</div>
      </div>
    );
  }

  return (
    <div style={{ padding:"22px 24px", margin:"0 auto", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Admin Panel</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>Hotel management settings</div>
      </div>

      <div style={{ display:"flex", gap:4, borderBottom:"2px solid var(--border)", marginBottom:20, flexWrap:"wrap" }}>
        {TABS.filter(t=>!(t.key==="staff"&&curRole!=="admin")).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            display:"flex",alignItems:"center",gap:6,padding:"10px 16px",border:"none",cursor:"pointer",
            fontSize:13,fontWeight:700,transition:"all .15s",
            background: tab===t.key ? "var(--bg4)" : "none",
            color: tab===t.key ? "var(--navy)" : "#555",
            borderBottom: tab===t.key ? "3px solid var(--gold)" : "3px solid transparent",
            borderRadius:"6px 6px 0 0",
            marginBottom:-2 }}>
            <i className={"ti "+t.icon} style={{ fontSize:15, color: tab===t.key ? "var(--gold)" : "#777" }} />{t.label}
          </button>
        ))}
      </div>

      {tab==="finance"  && <AdminFinance />}
      {tab==="rooms"    && <AdminRooms />}
      {tab==="invoices" && <AdminInvoices />}
      {tab==="sms"      && <AdminSMS />}
      {tab==="audit"    && <AuditLogViewer scope="hotel" title="Hotel — Activity Audit Log" checkPassword={checkAdminPassword} notify={notify} />}
      {tab==="staff"   && curRole==="admin" && <AdminStaff />}
      {tab==="data"    && <AdminData />}
      {tab==="sync"    && curRole==="admin" && <HotelSyncPanel notify={notify} />}
    </div>
  );
}

function HotelSyncPanel({ notify }) {
  const { revenues, expenses, bookings } = useApp();
  const [status, setStatus] = useState({});
  const [syncing, setSyncing] = useState(false);

  const steps = [
    { key:"revenues",  label:"Hotel Revenues",  count: revenues.length },
    { key:"expenses",  label:"Hotel Expenses",  count: expenses.length },
    { key:"config",    label:"App Config (ntfy/WhatsApp)", count: 2 },
    { key:"passwords", label:"Login Passwords (all devices)", count: Object.keys(collectLocalPasswords()).length },
  ];

  async function syncAll() {
    if (!hasSupabase()) { notify("Supabase not configured", "error"); return; }
    setSyncing(true);
    setStatus({});

    try {
      const rows = revenues.map(r => ({ id: String(r.id), date: r.date, source: r.source, amount: r.amount || 0, note: r.note || "", by: r.by || "", booking_id: r.bookingId || null }));
      if (rows.length) await upsertRows("revenues", rows);
      setStatus(s => ({ ...s, revenues:"✅" }));
    } catch { setStatus(s => ({ ...s, revenues:"❌" })); }

    try {
      const rows = expenses.map(e => ({ id: String(e.id), date: e.date, category: e.category, amount: e.amount || 0, note: e.note || "", by: e.by || "" }));
      if (rows.length) await upsertRows("expenses", rows);
      setStatus(s => ({ ...s, expenses:"✅" }));
    } catch { setStatus(s => ({ ...s, expenses:"❌" })); }

    try {
      const ntfy = JSON.parse(localStorage.getItem("ga_ntfy_config") || "{}");
      const wa   = JSON.parse(localStorage.getItem("ga_wa_config")   || "{}");
      await saveConfig("ntfy_config", ntfy);
      await saveConfig("wa_config",   wa);
      setStatus(s => ({ ...s, config:"✅" }));
    } catch { setStatus(s => ({ ...s, config:"❌" })); }

    try {
      const passMap = collectLocalPasswords();
      if (Object.keys(passMap).length) await saveConfig("user_passwords", passMap);
      setStatus(s => ({ ...s, passwords:"✅" }));
    } catch { setStatus(s => ({ ...s, passwords:"❌" })); }

    setSyncing(false);
    notify("Hotel data pushed to Supabase ☁️", "success");
  }

  return (
    <div style={{ maxWidth:600 }}>
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:18, fontWeight:800, color:"var(--navy)", marginBottom:6 }}>☁️ Push All Hotel Data to Supabase</div>
        <div style={{ fontSize:13, color:"var(--text3)", lineHeight:1.6 }}>
          Uploads all local data to Supabase in one click.<br/>
          Run once to ensure everything is visible from Denmark. Safe to run multiple times — no duplicates created.
        </div>
      </div>

      <div style={{ background:"#fff", border:"1.5px solid var(--border)", borderRadius:12, padding:"16px 20px", marginBottom:16 }}>
        {steps.map(s => (
          <div key={s.key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid var(--border)" }}>
            <div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--navy)" }}>{s.label}</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>{s.count} record{s.count!==1?"s":""} locally</div>
            </div>
            <div style={{ fontSize:20 }}>{status[s.key] || (syncing ? "⏳" : "⬜")}</div>
          </div>
        ))}
      </div>

      <button onClick={syncAll} disabled={syncing} style={{
        width:"100%", padding:"14px", fontSize:15, fontWeight:800,
        background: syncing ? "#ccc" : "linear-gradient(135deg,#2D1B69,#4a2ea8)",
        color:"#fff", border:"none", borderRadius:10,
        cursor: syncing ? "not-allowed" : "pointer", fontFamily:"inherit",
      }}>
        {syncing ? "⏳ Uploading..." : "☁️ Push All Data to Supabase Now"}
      </button>
    </div>
  );
}
