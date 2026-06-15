import { useState } from "react";
import { useApp } from "../../context/AppContext";
import AdminFinance from "./AdminFinance";
import AdminRooms   from "./AdminRooms";
import AdminStaff   from "./AdminStaff";
import AdminData    from "./AdminData";
import AdminSMS     from "./AdminSMS";

const TABS = [
  { key:"finance", label:"Finance",  icon:"ti-currency-taka" },
  { key:"rooms",   label:"Rooms",    icon:"ti-building"      },
  { key:"sms",     label:"Messages", icon:"ti-message-circle" },
  { key:"staff",   label:"Staff",    icon:"ti-users"         },
  { key:"data",    label:"Data",     icon:"ti-database"      },
];

export default function AdminPanel() {
  const { curRole } = useApp();
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

      <div style={{ display:"flex", gap:4, borderBottom:"2px solid var(--border)", marginBottom:20 }}>
        {TABS.filter(t=>!(t.key==="staff"&&curRole!=="admin")).map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            display:"flex",alignItems:"center",gap:6,padding:"10px 18px",border:"none",background:"none",cursor:"pointer",
            fontSize:13,fontWeight:700,transition:"all .15s",
            color:tab===t.key?"var(--navy)":"var(--text3)",
            borderBottom:tab===t.key?"3px solid var(--gold)":"3px solid transparent",
            marginBottom:-2 }}>
            <i className={"ti "+t.icon} style={{ fontSize:15 }} />{t.label}
          </button>
        ))}
      </div>

      {tab==="finance" && <AdminFinance />}
      {tab==="rooms"   && <AdminRooms />}
      {tab==="sms"     && <AdminSMS />}
      {tab==="staff"   && curRole==="admin" && <AdminStaff />}
      {tab==="data"    && <AdminData />}
    </div>
  );
}
