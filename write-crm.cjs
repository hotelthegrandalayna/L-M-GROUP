const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/CRM.jsx';

const code = `import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { money, todayStr } from "../utils/helpers";

function GuestModal({ guest, bookings, onClose }) {
  const g = guest;
  const gBookings = bookings.filter(b => b.phone === g.phone || b.guest?.toLowerCase() === g.name?.toLowerCase()).sort((a,b)=>b.id-a.id);
  const totalSpent = gBookings.reduce((s,b)=>s+(b.invoiceTotal??b.amount),0);
  const totalPaid  = gBookings.reduce((s,b)=>s+(b.paymentHistory||[]).reduce((a,p)=>a+p.amount,0),0);
  const totalDue   = Math.max(0, totalSpent - totalPaid);
  const lastStay   = gBookings[0];
  const nights     = gBookings.reduce((s,b)=>s+(b.nights||0),0);

  const STATUS_COLOR = { confirmed:"#f59e0b", "checked-in":"#10b981", "checked-out":"#64748b", cancelled:"#ef4444" };

  return (
    <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">
              <div style={{ width:36,height:36,borderRadius:"50%",background:"var(--navy)",color:"var(--gold)",display:"inline-flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:16,marginRight:10 }}>
                {g.name?.charAt(0).toUpperCase()}
              </div>
              {g.name}
            </div>
            <div className="modal-sub">{g.phone} {g.nationality ? "· "+g.nationality : ""}</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:16 }}>
          {[
            ["Stays",      gBookings.length, "ti-door-enter",    "var(--navy)"],
            ["Nights",     nights,           "ti-moon",          "var(--blue)"],
            ["Total Spent",money(totalSpent),"ti-currency-taka", "var(--gold2)"],
            ["Outstanding",money(totalDue),  "ti-alert-circle",  totalDue>0?"var(--red)":"var(--green)"],
          ].map(([l,v,ic,c])=>(
            <div key={l} style={{ background:"var(--panel)", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
              <i className={"ti "+ic} style={{ fontSize:18, color:c, display:"block", marginBottom:4 }} />
              <div style={{ fontSize:16, fontWeight:800, color:c }}>{v}</div>
              <div style={{ fontSize:10, color:"var(--text3)" }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>Stay History</div>
        {gBookings.length===0 && <div style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:14 }}>No bookings found</div>}
        {gBookings.map(b=>{
          const inv  = b.invoiceTotal??b.amount;
          const paid = (b.paymentHistory||[]).reduce((s,p)=>s+p.amount,0);
          const bal  = Math.max(0,inv-paid);
          return (
            <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderBottom:"1px solid var(--border)", fontSize:12 }}>
              <div style={{ width:32,height:32,borderRadius:8,background:(STATUS_COLOR[b.status]||"#888")+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <i className="ti ti-building" style={{ color:STATUS_COLOR[b.status]||"#888", fontSize:15 }} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700 }}>#{b.id} · Rm {b.room} · {b.nights}n</div>
                <div style={{ fontSize:11, color:"var(--text3)" }}>{b.checkin} → {b.checkout}</div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontWeight:700 }}>{money(inv)}</div>
                {bal>0 && <div style={{ fontSize:10, color:"var(--red)" }}>Due {money(bal)}</div>}
                {bal<=0 && inv>0 && <div style={{ fontSize:10, color:"var(--green)" }}>Paid</div>}
              </div>
              <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:8,
                background:(STATUS_COLOR[b.status]||"#888")+"18", color:STATUS_COLOR[b.status]||"#888" }}>
                {b.status.replace("-"," ")}
              </span>
            </div>
          );
        })}

        <div className="modal-actions" style={{ marginTop:14 }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function CRM() {
  const { bookings } = useApp();
  const [search, setSearch]   = useState("");
  const [sortKey, setSortKey] = useState("stays");
  const [sortDir, setSortDir] = useState("desc");
  const [selGuest, setSelGuest] = useState(null);

  const guests = useMemo(() => {
    const map = {};
    bookings.forEach(b => {
      if (!b.guest || b.status === "cancelled") return;
      const key = b.phone || b.guest.toLowerCase();
      if (!map[key]) map[key] = { name:b.guest, phone:b.phone||"", nationality:b.nationality||"", stays:0, nights:0, totalSpent:0, totalPaid:0, lastStay:"", rooms:new Set() };
      const g = map[key];
      g.stays++;
      g.nights += b.nights||0;
      const inv = b.invoiceTotal??b.amount;
      g.totalSpent += inv;
      g.totalPaid  += (b.paymentHistory||[]).reduce((s,p)=>s+p.amount,0);
      if (!g.lastStay || b.checkout > g.lastStay) g.lastStay = b.checkout;
      g.rooms.add(b.room);
    });
    return Object.values(map).map(g=>({ ...g, rooms:[...g.rooms], balance:Math.max(0,g.totalSpent-g.totalPaid) }));
  }, [bookings]);

  const filtered = useMemo(()=>{
    let arr = [...guests];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(g=>g.name.toLowerCase().includes(q)||g.phone.includes(q)||(g.nationality||"").toLowerCase().includes(q));
    }
    arr.sort((a,b)=>{
      let va=a[sortKey],vb=b[sortKey];
      if(typeof va==="string") va=va.toLowerCase(),vb=(vb||"").toLowerCase();
      if(va<vb) return sortDir==="asc"?-1:1;
      if(va>vb) return sortDir==="asc"?1:-1;
      return 0;
    });
    return arr;
  },[guests,search,sortKey,sortDir]);

  function toggleSort(k){
    if(sortKey===k) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(k); setSortDir("desc"); }
  }
  function SortIcon({k}){
    if(sortKey!==k) return <i className="ti ti-selector" style={{ opacity:.3,fontSize:11 }} />;
    return <i className={"ti ti-sort-"+(sortDir==="asc"?"ascending":"descending")+"-letters"} style={{ fontSize:11,color:"var(--gold2)" }} />;
  }

  const totalGuests  = guests.length;
  const repeatGuests = guests.filter(g=>g.stays>1).length;
  const totalRevenue = guests.reduce((s,g)=>s+g.totalSpent,0);
  const outstanding  = guests.reduce((s,g)=>s+g.balance,0);

  const COLS = [
    [null,    "Guest",       200],
    ["phone", "Phone",       120],
    ["stays", "Stays",        60],
    ["nights","Nights",       65],
    ["totalSpent","Revenue", 120],
    ["balance",  "Balance",  110],
    ["lastStay", "Last Stay",110],
    [null,    "Actions",      80],
  ];

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Guest CRM</div>
          <div style={{ fontSize:12, color:"var(--text3)" }}>{totalGuests} unique guests</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:18 }}>
        {[
          { label:"Total Guests",   value:totalGuests,          icon:"ti-users",        color:"var(--navy)"  },
          { label:"Repeat Guests",  value:repeatGuests,         icon:"ti-repeat",       color:"var(--blue)"  },
          { label:"Total Revenue",  value:money(totalRevenue),  icon:"ti-currency-taka",color:"var(--gold2)" },
          { label:"Outstanding",    value:money(outstanding),   icon:"ti-alert-circle", color:outstanding>0?"var(--red)":"var(--green)" },
        ].map(m=>(
          <div key={m.label} className="panel" style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:10,background:m.color+"18",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <i className={"ti "+m.icon} style={{ fontSize:20, color:m.color }} />
            </div>
            <div><div style={{ fontSize:11, color:"var(--text3)" }}>{m.label}</div><div style={{ fontSize:17, fontWeight:800, color:m.color }}>{m.value}</div></div>
          </div>
        ))}
      </div>

      <div style={{ position:"relative", marginBottom:14 }}>
        <i className="ti ti-search" style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:14 }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest name, phone or nationality..." style={{ paddingLeft:32,width:"100%",boxSizing:"border-box" }} />
      </div>

      <div className="panel" style={{ padding:0, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"var(--navy2)", color:"var(--gold)" }}>
              {COLS.map(([k,l,w])=>(
                <th key={l} style={{ padding:"9px 12px",textAlign:"left",fontSize:10,textTransform:"uppercase",letterSpacing:.5,width:w,whiteSpace:"nowrap",cursor:k?"pointer":"default" }}
                  onClick={()=>k&&toggleSort(k)}>
                  {l} {k&&<SortIcon k={k} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={COLS.length} style={{ textAlign:"center",padding:28,color:"var(--text3)" }}>No guests found</td></tr>}
            {filtered.map((g,i)=>(
              <tr key={g.phone||g.name} style={{ borderBottom:"1px solid var(--border)", background:i%2===0?"":"var(--panel-alt)", cursor:"pointer" }} onClick={()=>setSelGuest(g)}>
                <td style={{ padding:"10px 12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                    <div style={{ width:32,height:32,borderRadius:"50%",background:"var(--navy)",color:"var(--gold)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,flexShrink:0 }}>
                      {g.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight:700 }}>{g.name}</div>
                      {g.stays>1&&<span style={{ fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:8,background:"#eff6ff",color:"#3b82f6",border:"1px solid #bfdbfe" }}>Repeat</span>}
                    </div>
                  </div>
                </td>
                <td style={{ padding:"10px 12px",color:"var(--text3)",fontSize:12 }}>{g.phone||"-"}</td>
                <td style={{ padding:"10px 12px",textAlign:"center",fontWeight:700 }}>{g.stays}</td>
                <td style={{ padding:"10px 12px",textAlign:"center" }}>{g.nights}</td>
                <td style={{ padding:"10px 12px",fontWeight:700 }}>{money(g.totalSpent)}</td>
                <td style={{ padding:"10px 12px" }}>
                  {g.balance>0
                    ? <span style={{ color:"var(--red)",fontWeight:700 }}>{money(g.balance)}</span>
                    : <span style={{ color:"var(--green)",fontSize:11 }}><i className="ti ti-circle-check" /> Clear</span>}
                </td>
                <td style={{ padding:"10px 12px",color:"var(--text3)",fontSize:12 }}>{g.lastStay||"-"}</td>
                <td style={{ padding:"10px 12px" }}>
                  <button className="btn sm" style={{ fontSize:11 }} onClick={e=>{e.stopPropagation();setSelGuest(g);}}>
                    <i className="ti ti-eye" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:10,fontSize:12,color:"var(--text3)" }}><i className="ti ti-list" /> {filtered.length} of {totalGuests} guests</div>

      {selGuest && <GuestModal guest={selGuest} bookings={bookings} onClose={()=>setSelGuest(null)} />}
    </div>
  );
}
`;

fs.writeFileSync(path, code, 'utf8');
console.log('OK size=' + fs.statSync(path).size);
