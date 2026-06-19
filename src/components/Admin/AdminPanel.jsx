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

const TABS = [
  { key:"finance",  label:"Finance",  icon:"ti-currency-taka"  },
  { key:"rooms",    label:"Rooms",    icon:"ti-building"       },
  { key:"invoices", label:"Invoices", icon:"ti-file-invoice"   },
  { key:"sms",      label:"Messages", icon:"ti-message-circle" },
  { key:"audit",    label:"Audit Log",icon:"ti-eye"            },
  { key:"staff",    label:"Staff",    icon:"ti-users"          },
  { key:"data",     label:"Data",     icon:"ti-database"       },
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
    </div>
  );
}
