import { useState, useMemo } from "react";
import { useApp } from "../../context/AppContext";
import { money, todayStr, maxId } from "../../utils/helpers";
import { checkAdminPassword } from "../../utils/auth";

const REV_SOURCES = ["Room Rent","Food & Beverage","Laundry","Parking","Other"];

export default function AdminFinance() {
  const { curUser, bookings, updateBookings, revenues, updateRevenues, expenses, updateExpenses, rooms, notify } = useApp();
  const today = todayStr();
  const thisMonth = today.slice(0,7);
  const [tab, setTab] = useState("overview");
  const [addRev, setAddRev] = useState(false);
  const [rSrc,  setRSrc]  = useState("Room Rent");
  const [rAmt,  setRAmt]  = useState(0);
  const [rDate, setRDate] = useState(today);
  const [rNote, setRNote] = useState("");
  const [reportMonth, setReportMonth] = useState(thisMonth);

  // Build revenue directly from bookings — covers ALL cases:
  // 1. paymentHistory entries (new bookings)
  // 2. advance field only (old bookings without paymentHistory)
  const bookingRevenues = useMemo(() => {
    const entries = [];
    bookings.forEach(b => {
      const history = b.paymentHistory || [];
      const checkinDate = b.checkin || today;

      if (history.length > 0) {
        // Use detailed payment history
        history.forEach(p => {
          const date = p.ts ? p.ts.split("T")[0] : checkinDate;
          entries.push({
            id: `bk-${b.id}-${p.ts || Math.random()}`,
            source: "Room Rent",
            amount: parseFloat(p.amount) || 0,
            date,
            note: `${b.guest} Rm ${b.room} — ${p.note || p.type || "payment"} (${p.method || ""})`,
            bookingId: b.id,
            fromBooking: true,
          });
        });
      } else {
        // Fallback: use advance + restPayment fields for old bookings
        const totalPaid = (parseFloat(b.advance) || 0) + (parseFloat(b.restPayment) || 0) + (parseFloat(b.extrasAdvance) || 0);
        if (totalPaid > 0) {
          entries.push({
            id: `bk-${b.id}-adv`,
            source: "Room Rent",
            amount: totalPaid,
            date: checkinDate,
            note: `${b.guest} Rm ${b.room} — payment (${b.paymentMethod || "Cash"})`,
            bookingId: b.id,
            fromBooking: true,
          });
        }
      }
    });
    return entries;
  }, [bookings]);

  // Merge booking revenues + manual-only entries (no bookingId)
  const allRevenues = useMemo(() => {
    const manualOnly = revenues.filter(r => !r.bookingId && !r.fromBooking);
    return [...bookingRevenues, ...manualOnly];
  }, [bookingRevenues, revenues]);

  const mRev = allRevenues.filter(r=>r.date?.startsWith(thisMonth)).reduce((s,r)=>s+r.amount,0);
  const mExp = expenses.filter(e=>e.date?.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
  const allRev = allRevenues.reduce((s,r)=>s+r.amount,0);
  const allExp = expenses.reduce((s,e)=>s+e.amount,0);
  const todayRev = allRevenues.filter(r=>r.date===today).reduce((s,r)=>s+r.amount,0);
  const todayExp = expenses.filter(e=>e.date===today).reduce((s,e)=>s+e.amount,0);

  function saveRev() {
    const a = parseFloat(rAmt)||0;
    if (a<=0) { notify("Enter a valid amount","error"); return; }
    updateRevenues([...revenues, { id:maxId(revenues), source:rSrc, amount:a, date:rDate, note:rNote.trim(), by:curUser||"staff" }]);
    notify("Revenue entry added","success");
    setAddRev(false); setRAmt(0); setRNote("");
  }

  function dangerReset() {
    const pw = window.prompt("Enter admin password to reset ALL finance records:");
    if (!checkAdminPassword(pw)) { notify("Incorrect password","error"); return; }
    if (!window.confirm("Permanently delete ALL bookings, revenues, and expenses?")) return;
    updateBookings([]); updateRevenues([]); updateExpenses([]);
    notify("All finance records have been reset","error");
  }

  const bySource = useMemo(()=>{
    const map={};
    allRevenues.filter(r=>r.date?.startsWith(thisMonth)).forEach(r=>{ map[r.source]=(map[r.source]||0)+r.amount; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[allRevenues,thisMonth]);

  // ── Last 6 months ──
  const last6 = useMemo(()=>{
    const months=[];
    for(let i=5;i>=0;i--){
      const d=new Date(today); d.setMonth(d.getMonth()-i);
      const m=d.toISOString().slice(0,7);
      const label=d.toLocaleString("default",{month:"short",year:"2-digit"});
      const rev=allRevenues.filter(r=>r.date?.startsWith(m)).reduce((s,r)=>s+r.amount,0);
      const exp=expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+e.amount,0);
      const bk=bookings.filter(b=>b.checkin?.startsWith(m)&&b.status!=="cancelled").length;
      months.push({m,label,rev,exp,bk});
    }
    return months;
  },[allRevenues,expenses,bookings,today]);
  const maxBarVal = Math.max(...last6.map(x=>x.rev),1);

  // ── Revenue by Room ──
  const byRoom = useMemo(()=>rooms.map(r=>({
    room:r.number, type:r.type,
    rev:allRevenues.filter(rv=>rv.bookingId && bookings.find(b=>b.id===rv.bookingId&&b.room===r.number)).reduce((s,rv)=>s+rv.amount,0)
  })).sort((a,b)=>b.rev-a.rev),[rooms,bookings,allRevenues]);
  const maxRoomRev = byRoom.length?Math.max(...byRoom.map(r=>r.rev),1):1;

  // ── Monthly report ──
  const reportMonths = useMemo(()=>{
    const ms=[];
    for(let i=11;i>=0;i--){ const d=new Date(today); d.setMonth(d.getMonth()-i); ms.push(d.toISOString().slice(0,7)); }
    return ms;
  },[today]);

  const report = useMemo(()=>{
    const bks=bookings.filter(b=>b.checkin?.startsWith(reportMonth)&&b.status!=="cancelled");
    const rev=allRevenues.filter(r=>r.date?.startsWith(reportMonth)).reduce((s,r)=>s+r.amount,0);
    const exp=expenses.filter(e=>e.date?.startsWith(reportMonth)).reduce((s,e)=>s+e.amount,0);
    const nights=bks.reduce((s,b)=>s+(b.nights||0),0);
    const bySource={};
    bks.forEach(b=>{ const src=b.source||"Walk-in"; bySource[src]=(bySource[src]||0)+1; });
    const topGuests=[...bks].sort((a,b)=>(b.amount||0)-(a.amount||0)).slice(0,5);
    const expCats={};
    expenses.filter(e=>e.date?.startsWith(reportMonth)).forEach(e=>{ expCats[e.category]=(expCats[e.category]||0)+e.amount; });
    return { bks, rev, exp, nights, bySource, topGuests, profit:rev-exp, expCats };
  },[bookings,allRevenues,expenses,reportMonth]);

  const mBookings=bookings.filter(b=>b.checkin?.startsWith(thisMonth)&&b.status!=="cancelled");
  const avgRate=rooms.length?Math.round(rooms.reduce((s,r)=>s+r.rate,0)/rooms.length):0;
  const revPAR=rooms.length?Math.round(mRev/rooms.length):0;
  const avgNights=mBookings.length?(mBookings.reduce((s,b)=>s+(b.nights||0),0)/mBookings.length).toFixed(1):0;

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:18 }}>
        {[
          ["Today Revenue",   money(todayRev),   "ti-sun",             "var(--gold2)"],
          ["Month Revenue",   money(mRev),       "ti-currency-taka",   "var(--navy)"],
          ["Month Profit",    money(mRev-mExp),  "ti-trending-up",     (mRev-mExp)>=0?"var(--green)":"var(--red)"],
          ["Today Expenses",  money(todayExp),   "ti-receipt",         "var(--red)"],
          ["Month Expenses",  money(mExp),       "ti-minus-vertical",  "var(--red)"],
          ["All-time Profit", money(allRev-allExp),"ti-chart-line",    (allRev-allExp)>=0?"var(--green)":"var(--red)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"12px 14px", display:"flex", alignItems:"center", gap:10 }}>
            <i className={"ti "+ic} style={{ fontSize:20, color:c, flexShrink:0 }} />
            <div><div style={{ fontSize:10, color:"var(--text3)" }}>{l}</div><div style={{ fontSize:16, fontWeight:800, color:c }}>{v}</div></div>
          </div>
        ))}
      </div>

      {/* Metric badges */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        {[
          ["Avg Room Rate",   money(avgRate),       "ti-tag",       "var(--gold2)"],
          ["RevPAR (Month)",  money(revPAR),        "ti-building",  "var(--navy)"],
          ["Avg Stay Length", avgNights+" nights",  "ti-moon",      "#5b3fa0"],
          ["Expense Ratio",   mRev>0?Math.round(mExp/mRev*100)+"%":"—","ti-chart-pie","var(--red)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"11px 14px", textAlign:"center" }}>
            <i className={"ti "+ic} style={{ fontSize:20,color:c,display:"block",marginBottom:4 }} />
            <div style={{ fontSize:15,fontWeight:800,color:c }}>{v}</div>
            <div style={{ fontSize:10,color:"var(--text3)",marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {["overview","charts","revenues","expenses","report"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:"6px 14px",borderRadius:20,border:"1.5px solid",cursor:"pointer",fontSize:12,fontWeight:700,transition:"all .15s",
            background:tab===t?"var(--navy)":"transparent",color:tab===t?"#fff":"var(--text3)",borderColor:tab===t?"var(--navy)":"var(--border)" }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
        <button className="btn sm primary" style={{ marginLeft:"auto" }} onClick={()=>setAddRev(true)}><i className="ti ti-plus" /> Add Revenue</button>
      </div>

      {tab==="overview" && (
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>Revenue by Source (This Month)</div>
          {bySource.length===0&&<div style={{ color:"var(--text3)",fontSize:13,padding:14 }}>No revenue entries this month</div>}
          {bySource.map(([s,a])=>(
            <div key={s} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid var(--border)",fontSize:13 }}>
              <span>{s}</span><strong style={{ color:"var(--green)" }}>{money(a)}</strong>
            </div>
          ))}
          <div style={{ display:"flex",justifyContent:"space-between",padding:"10px 12px",fontWeight:800,fontSize:14,borderTop:"2px solid var(--border)",marginTop:4 }}>
            <span>Total</span><span style={{ color:"var(--gold2)" }}>{money(mRev)}</span>
          </div>
        </div>
      )}

      {tab==="charts" && (
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><i className="ti ti-chart-bar" /> Revenue vs Expenses — Last 6 Months</div></div>
            <div style={{ padding:"6px 14px 14px" }}>
              {last6.map(x=>(
                <div key={x.m} style={{ marginBottom:13 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text3)", marginBottom:4 }}>
                    <span style={{ fontWeight:700, color:"var(--navy)" }}>{x.label}</span>
                    <span>{x.bk} bookings · Net: <strong style={{ color:x.rev-x.exp>=0?"var(--green)":"var(--red)" }}>{money(x.rev-x.exp)}</strong></span>
                  </div>
                  <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                    <div style={{ flex:1, height:9, background:"var(--border)", borderRadius:5, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:(x.rev/maxBarVal*100)+"%", background:"var(--gold2)", borderRadius:5, transition:"width .5s" }} />
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:"var(--gold2)", width:90, textAlign:"right" }}>{money(x.rev)}</span>
                  </div>
                  <div style={{ display:"flex", gap:4, alignItems:"center", marginTop:3 }}>
                    <div style={{ flex:1, height:6, background:"var(--border)", borderRadius:5, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:(x.exp/maxBarVal*100)+"%", background:"var(--red)", borderRadius:5, opacity:.7, transition:"width .5s" }} />
                    </div>
                    <span style={{ fontSize:11, color:"var(--red)", width:90, textAlign:"right" }}>{money(x.exp)}</span>
                  </div>
                </div>
              ))}
              <div style={{ display:"flex", gap:14, fontSize:11, marginTop:4 }}>
                <span><span style={{ display:"inline-block",width:10,height:10,background:"var(--gold2)",borderRadius:2,marginRight:4 }}></span>Revenue</span>
                <span><span style={{ display:"inline-block",width:10,height:10,background:"var(--red)",borderRadius:2,marginRight:4,opacity:.7 }}></span>Expenses</span>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><i className="ti ti-building" /> Revenue by Room</div></div>
            <div style={{ padding:"6px 14px 14px" }}>
              {byRoom.map(r=>(
                <div key={r.room} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                    <span style={{ fontWeight:600 }}>Rm {r.room}</span>
                    <span style={{ fontWeight:700, color:"var(--navy)" }}>{money(r.rev)}</span>
                  </div>
                  <div style={{ height:7, background:"var(--border)", borderRadius:4, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:(r.rev/maxRoomRev*100)+"%", background:"var(--navy)", borderRadius:4 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab==="revenues" && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead><tr style={{ background:"var(--navy2)",color:"var(--gold)" }}>
              {["Date","Source","Amount","Note","By"].map(h=><th key={h} style={{ padding:"8px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {allRevenues.length===0&&<tr><td colSpan={5} style={{ textAlign:"center",padding:20,color:"var(--text3)" }}>No revenue entries</td></tr>}
              {[...allRevenues].sort((a,b)=>b.date?.localeCompare(a.date)).map((r,i)=>(
                <tr key={r.id} style={{ borderBottom:"1px solid var(--border)",background:i%2===0?"":"var(--panel-alt)" }}>
                  <td style={{ padding:"8px 10px",color:"var(--text3)",fontSize:12 }}>{r.date}</td>
                  <td style={{ padding:"8px 10px" }}>{r.source}</td>
                  <td style={{ padding:"8px 10px",fontWeight:700,color:"var(--green)" }}>{money(r.amount)}</td>
                  <td style={{ padding:"8px 10px",color:"var(--text2)",fontSize:12 }}>{r.note||"-"}</td>
                  <td style={{ padding:"8px 10px",fontSize:11,color:"var(--text3)" }}>{r.by||"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="expenses" && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",fontSize:13 }}>
            <thead><tr style={{ background:"var(--navy2)",color:"var(--gold)" }}>
              {["Date","Category","Amount","Method","Note","By"].map(h=><th key={h} style={{ padding:"8px 10px",textAlign:"left",fontSize:10,textTransform:"uppercase" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.length===0&&<tr><td colSpan={6} style={{ textAlign:"center",padding:20,color:"var(--text3)" }}>No expenses</td></tr>}
              {[...expenses].reverse().map((e,i)=>(
                <tr key={e.id} style={{ borderBottom:"1px solid var(--border)",background:i%2===0?"":"var(--panel-alt)" }}>
                  <td style={{ padding:"8px 10px",color:"var(--text3)",fontSize:12 }}>{e.date}</td>
                  <td style={{ padding:"8px 10px" }}>{e.category}</td>
                  <td style={{ padding:"8px 10px",fontWeight:700,color:"var(--red)" }}>{money(e.amount)}</td>
                  <td style={{ padding:"8px 10px",fontSize:12,color:"var(--text3)" }}>{e.method||"Cash"}</td>
                  <td style={{ padding:"8px 10px",color:"var(--text2)",fontSize:12 }}>{e.note||"-"}</td>
                  <td style={{ padding:"8px 10px",fontSize:11,color:"var(--text3)" }}>{e.by||"-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab==="report" && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:14 }}>Monthly Financial Report</div>
            <div style={{ display:"flex", gap:8 }}>
              <select value={reportMonth} onChange={e=>setReportMonth(e.target.value)} style={{ fontSize:12, padding:"5px 8px" }}>
                {reportMonths.map(m=><option key={m} value={m}>{new Date(m+"-15").toLocaleString("default",{month:"long",year:"numeric"})}</option>)}
              </select>
              <button className="btn sm" onClick={()=>window.print()}><i className="ti ti-printer" /> Print</button>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
            {[
              { label:"BOOKINGS",   val:report.bks.length },
              { label:"NIGHTS SOLD",val:report.nights },
              { label:"REVENUE",    val:money(report.rev), color:"var(--gold2)" },
              { label:"NET PROFIT", val:money(report.profit), color:report.profit>=0?"var(--green)":"var(--red)" },
            ].map(s=>(
              <div key={s.label} style={{ textAlign:"center", padding:"13px", background:"var(--bg3)", borderRadius:9 }}>
                <div style={{ fontSize:18, fontWeight:800, color:s.color||"var(--text)" }}>{s.val}</div>
                <div style={{ fontSize:9, fontWeight:700, letterSpacing:1.2, textTransform:"uppercase", color:"var(--text3)", marginTop:3 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:1.2, textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Revenue &amp; Expenses</div>
              <div style={{ fontSize:13 }}>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border)" }}><span>Revenue</span><strong style={{ color:"var(--gold2)" }}>{money(report.rev)}</strong></div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid var(--border)" }}><span>Expenses</span><strong style={{ color:"var(--red)" }}>-{money(report.exp)}</strong></div>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", fontWeight:800, fontSize:14 }}><span>Net Profit</span><span style={{ color:report.profit>=0?"var(--green)":"var(--red)" }}>{money(report.profit)}</span></div>
              </div>
            </div>
            <div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:1.2, textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Expense Breakdown</div>
              {Object.entries(report.expCats).length===0?<div style={{ fontSize:12, color:"var(--text3)" }}>No expenses</div>:Object.entries(report.expCats).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>(
                <div key={cat} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0", borderBottom:"1px solid var(--border)" }}>
                  <span>{cat}</span><strong style={{ color:"var(--red)" }}>{money(amt)}</strong>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:1.2, textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Top Guests by Spend</div>
              {report.topGuests.length===0?<div style={{ fontSize:12, color:"var(--text3)" }}>No bookings</div>:report.topGuests.map((b,i)=>(
                <div key={i} style={{ fontSize:12, padding:"4px 0", borderBottom:"1px solid var(--border)" }}>
                  <div style={{ fontWeight:700 }}>{b.guest}</div>
                  <div style={{ color:"var(--text3)", fontSize:11 }}>{money(b.amount||0)} · Rm {b.room} · {b.nights}n</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:9, fontWeight:800, letterSpacing:1.2, textTransform:"uppercase", color:"var(--text3)", marginBottom:8 }}>Booking Sources</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
              {Object.entries(report.bySource).map(([src,n])=>(
                <div key={src} style={{ fontSize:12, padding:"5px 12px", background:"var(--bg3)", borderRadius:8, fontWeight:700 }}>
                  {src}: <span style={{ color:"var(--navy)" }}>{n}</span>
                </div>
              ))}
              {Object.keys(report.bySource).length===0&&<div style={{ fontSize:12, color:"var(--text3)" }}>No bookings this month</div>}
            </div>
          </div>
        </div>
      )}

      {addRev && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setAddRev(false)}>
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title"><i className="ti ti-plus" style={{ color:"var(--gold)" }} /> Add Revenue Entry</div>
              <button className="modal-close" onClick={()=>setAddRev(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-group"><label>Source</label>
              <select value={rSrc} onChange={e=>setRSrc(e.target.value)}>{REV_SOURCES.map(s=><option key={s}>{s}</option>)}</select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Amount (BDT) *</label><input type="number" value={rAmt} min="0" onChange={e=>setRAmt(e.target.value)} /></div>
              <div className="form-group"><label>Date *</label><input type="date" value={rDate} onChange={e=>setRDate(e.target.value)} /></div>
            </div>
            <div className="form-group"><label>Note</label><input value={rNote} onChange={e=>setRNote(e.target.value)} placeholder="Optional description" /></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setAddRev(false)}>Cancel</button>
              <button className="btn primary" onClick={saveRev}><i className="ti ti-device-floppy" /> Save</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop:28, padding:16, border:"1.5px solid #fca5a5", borderRadius:10, background:"#fff1f2" }}>
        <div style={{ fontSize:12, fontWeight:800, color:"#991b1b", marginBottom:8 }}><i className="ti ti-alert-triangle" /> Danger Zone</div>
        <div style={{ fontSize:12, color:"#7f1d1d", marginBottom:12 }}>Reset all finance records — permanently deletes ALL bookings, revenues, and expenses.</div>
        <button className="btn danger sm" onClick={dangerReset}><i className="ti ti-trash" /> Reset All Finance Records</button>
      </div>
    </div>
  );
}
