const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Insights.jsx';

const code = `import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { money, todayStr } from "../utils/helpers";

function StatCard({ label, value, sub, icon, color }) {
  return (
    <div className="panel" style={{ padding:"16px 18px", display:"flex", alignItems:"center", gap:14 }}>
      <div style={{ width:44,height:44,borderRadius:12,background:(color||"var(--navy)")+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
        <i className={"ti "+icon} style={{ fontSize:22, color:color||"var(--navy)" }} />
      </div>
      <div>
        <div style={{ fontSize:11, color:"var(--text3)", marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:19, fontWeight:800, color:color||"var(--navy)" }}>{value}</div>
        {sub && <div style={{ fontSize:11, color:"var(--text3)", marginTop:1 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Bar({ label, value, max, color, suffix }) {
  const pct = max > 0 ? Math.min(100, (value/max)*100) : 0;
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
        <span style={{ fontWeight:600 }}>{label}</span>
        <span style={{ fontWeight:700, color:color||"var(--navy)" }}>{suffix||""}{typeof value==="number"&&!suffix?money(value):value}</span>
      </div>
      <div style={{ height:7, background:"var(--border)", borderRadius:4, overflow:"hidden" }}>
        <div style={{ height:"100%", width:pct+"%", background:color||"var(--navy)", borderRadius:4, transition:"width .5s" }} />
      </div>
    </div>
  );
}

export default function Insights() {
  const { rooms, bookings, revenues, expenses } = useApp();
  const today = todayStr();
  const thisMonth = today.slice(0,7);
  const lastMonth = (() => { const d=new Date(today); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7); })();

  const mBookings = bookings.filter(b=>b.checkin?.startsWith(thisMonth)&&b.status!=="cancelled");
  const lBookings = bookings.filter(b=>b.checkin?.startsWith(lastMonth)&&b.status!=="cancelled");
  const mRev  = revenues.filter(r=>r.date?.startsWith(thisMonth)).reduce((s,r)=>s+r.amount,0);
  const lRev  = revenues.filter(r=>r.date?.startsWith(lastMonth)).reduce((s,r)=>s+r.amount,0);
  const mExp  = expenses.filter(e=>e.date?.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
  const lExp  = expenses.filter(e=>e.date?.startsWith(lastMonth)).reduce((s,e)=>s+e.amount,0);
  const mProfit = mRev - mExp;
  const lProfit = lRev - lExp;
  const allRev  = revenues.reduce((s,r)=>s+r.amount,0);
  const allExp  = expenses.reduce((s,e)=>s+e.amount,0);

  const occToday = rooms.filter(r => {
    const active = bookings.find(b=>b.room===r.number&&(b.status==="checked-in"||(b.status==="confirmed"&&b.checkin<=today&&b.checkout>today)));
    return !!active;
  }).length;

  const avgRate = rooms.length ? Math.round(rooms.reduce((s,r)=>s+r.rate,0)/rooms.length) : 0;
  const revPAR  = rooms.length ? Math.round(mRev/rooms.length) : 0;
  const avgNights = mBookings.length ? (mBookings.reduce((s,b)=>s+(b.nights||0),0)/mBookings.length).toFixed(1) : 0;

  const pctChange = (curr,prev) => prev===0 ? (curr>0?100:0) : Math.round(((curr-prev)/prev)*100);
  const revChange = pctChange(mRev,lRev);
  const bkChange  = pctChange(mBookings.length,lBookings.length);

  const byRoom = useMemo(()=>rooms.map(r=>({
    room: r.number,
    type: r.type,
    stays: bookings.filter(b=>b.room===r.number&&b.status!=="cancelled").length,
    revenue: revenues.filter(rv=>bookings.find(b=>b.id===rv.bookingId&&b.room===r.number)).reduce((s,rv)=>s+rv.amount,0),
  })).sort((a,b)=>b.revenue-a.revenue),[rooms,bookings,revenues]);

  const maxRoomRev = byRoom.length ? Math.max(...byRoom.map(r=>r.revenue)) : 1;

  const bySource = useMemo(()=>{
    const map={};
    bookings.filter(b=>b.status!=="cancelled").forEach(b=>{ const s=b.source||"Walk-in"; map[s]=(map[s]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[bookings]);
  const maxSource = bySource.length ? bySource[0][1] : 1;

  const last6 = useMemo(()=>{
    const months=[];
    for(let i=5;i>=0;i--){
      const d=new Date(today); d.setMonth(d.getMonth()-i);
      const m=d.toISOString().slice(0,7);
      const label=d.toLocaleString("default",{month:"short",year:"2-digit"});
      const rev=revenues.filter(r=>r.date?.startsWith(m)).reduce((s,r)=>s+r.amount,0);
      const exp=expenses.filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+e.amount,0);
      const bk=bookings.filter(b=>b.checkin?.startsWith(m)&&b.status!=="cancelled").length;
      months.push({m,label,rev,exp,bk});
    }
    return months;
  },[revenues,expenses,bookings,today]);

  const maxBarVal = Math.max(...last6.map(x=>x.rev),1);

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Insights</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>Business performance overview</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
        <StatCard label="This Month Revenue" value={money(mRev)} sub={(revChange>=0?"+":"")+revChange+"% vs last month"} icon="ti-currency-taka" color="var(--gold2)" />
        <StatCard label="This Month Bookings" value={mBookings.length} sub={(bkChange>=0?"+":"")+bkChange+"% vs last month"} icon="ti-calendar-check" color="var(--navy)" />
        <StatCard label="Occupancy Today" value={Math.round(occToday/rooms.length*100)+"%"} sub={occToday+" of "+rooms.length+" rooms"} icon="ti-percentage" color="var(--blue)" />
        <StatCard label="Net Profit (Month)" value={money(mProfit)} sub={money(allRev-allExp)+" all-time"} icon="ti-trending-up" color={mProfit>=0?"var(--green)":"var(--red)"} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:18, marginBottom:18 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title"><i className="ti ti-chart-bar" /> Revenue vs Expenses — Last 6 Months</div></div>
          <div style={{ padding:"6px 14px 14px" }}>
            {last6.map(x=>(
              <div key={x.m} style={{ marginBottom:14 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text3)", marginBottom:5 }}>
                  <span style={{ fontWeight:700, color:"var(--navy)" }}>{x.label}</span>
                  <span>{x.bk} booking{x.bk!==1?"s":""} · Net: <strong style={{ color:x.rev-x.exp>=0?"var(--green)":"var(--red)" }}>{money(x.rev-x.exp)}</strong></span>
                </div>
                <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                  <div style={{ flex:1, height:10, background:"var(--border)", borderRadius:5, overflow:"hidden", position:"relative" }}>
                    <div style={{ position:"absolute", left:0, top:0, height:"100%", width:(x.rev/maxBarVal*100)+"%", background:"var(--gold2)", borderRadius:5, transition:"width .5s" }} />
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:"var(--gold2)", width:80, textAlign:"right" }}>{money(x.rev)}</span>
                </div>
                <div style={{ display:"flex", gap:4, alignItems:"center", marginTop:3 }}>
                  <div style={{ flex:1, height:6, background:"var(--border)", borderRadius:5, overflow:"hidden", position:"relative" }}>
                    <div style={{ position:"absolute", left:0, top:0, height:"100%", width:(x.exp/maxBarVal*100)+"%", background:"var(--red)", borderRadius:5, opacity:.7, transition:"width .5s" }} />
                  </div>
                  <span style={{ fontSize:11, color:"var(--red)", width:80, textAlign:"right" }}>{money(x.exp)}</span>
                </div>
              </div>
            ))}
            <div style={{ display:"flex", gap:16, fontSize:11, marginTop:4 }}>
              <span><span style={{ display:"inline-block",width:10,height:10,background:"var(--gold2)",borderRadius:2,marginRight:4 }}></span>Revenue</span>
              <span><span style={{ display:"inline-block",width:10,height:10,background:"var(--red)",borderRadius:2,marginRight:4,opacity:.7 }}></span>Expenses</span>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><i className="ti ti-building" /> Revenue by Room</div></div>
            <div style={{ padding:"6px 14px 14px" }}>
              {byRoom.map(r=>(
                <Bar key={r.room} label={"Rm "+r.room+" ("+r.type+")"} value={r.revenue} max={maxRoomRev} color="var(--navy)" />
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><i className="ti ti-source-code" /> Booking Source</div></div>
            <div style={{ padding:"6px 14px 14px" }}>
              {bySource.length===0&&<div style={{ color:"var(--text3)",fontSize:13,textAlign:"center",padding:10 }}>No data</div>}
              {bySource.map(([s,n])=>(
                <Bar key={s} label={s} value={n} max={maxSource} color="var(--blue)" suffix="" />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          ["Avg Room Rate",     money(avgRate),                    "ti-tag",         "var(--gold2)"],
          ["RevPAR (Month)",    money(revPAR),                     "ti-building",    "var(--navy)"],
          ["Avg Stay Length",   avgNights+" nights",               "ti-moon",        "var(--blue)"],
          ["Expense Ratio",     mRev>0?Math.round(mExp/mRev*100)+"%":"—", "ti-chart-pie","var(--red)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"14px 16px", textAlign:"center" }}>
            <i className={"ti "+ic} style={{ fontSize:24,color:c,display:"block",marginBottom:6 }} />
            <div style={{ fontSize:17,fontWeight:800,color:c }}>{v}</div>
            <div style={{ fontSize:11,color:"var(--text3)",marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path, code, 'utf8');
console.log('OK size=' + fs.statSync(path).size);
