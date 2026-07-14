
import { useMemo } from "react";
import { useHall, EV_TYPES, invBilled, invCollected, invInMonth, sumBy, businessExpensesOnly } from "../HallContext";
import useIsMobile from "../useIsMobile";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function HallInsights() {
  const isMobile = useIsMobile();
  const { invoices, expenses } = useHall();
  const today = new Date().toISOString().split("T")[0];
  const thisMonth = today.slice(0,7);
  const thisYear  = today.slice(0,4);

  const bizExpenses = businessExpensesOnly(expenses);
  const mInv  = invoices.filter(inv=>invInMonth(inv, thisMonth));
  const mExp  = bizExpenses.filter(e=>e.date?.startsWith(thisMonth)).reduce((s,e)=>s+e.amount,0);
  const mBilled = sumBy(mInv, invBilled);
  const mPaid   = sumBy(mInv, invCollected);
  const allPaid = sumBy(invoices, invCollected);
  const allExp  = bizExpenses.reduce((s,e)=>s+e.amount,0);

  const byType = useMemo(()=>{
    const map={};
    invoices.forEach(inv=>{ map[inv.evType]=(map[inv.evType]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  },[invoices]);

  const last6 = useMemo(()=>{
    const months=[];
    for(let i=5;i>=0;i--){
      const d=new Date(); d.setMonth(d.getMonth()-i);
      const m=d.toISOString().slice(0,7);
      const label=MONTHS[d.getMonth()]+" "+String(d.getFullYear()).slice(2);
      const inv=invoices.filter(x=>invInMonth(x, m));
      const billed=sumBy(inv, invBilled);
      const paid=sumBy(inv, invCollected);
      const exp=businessExpensesOnly(expenses).filter(e=>e.date?.startsWith(m)).reduce((s,e)=>s+e.amount,0);
      months.push({label,billed,paid,exp,cnt:inv.length});
    }
    return months;
  },[invoices,expenses]);

  const maxBar = Math.max(...last6.map(x=>x.billed),1);

  return (
    <div className="hall-page" style={{ padding: isMobile?"10px 8px":"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"var(--navy)" }}>Insights</div>
        <div style={{ fontSize:12,color:"var(--text3)" }}>Business performance overview</div>
      </div>
      <div className="hall-stat-grid" style={{ display:"grid",gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:22 }}>
        {[
          ["This Month Billed","৳"+mBilled.toLocaleString(),"💰","var(--gold2)"],
          ["This Month Paid","৳"+mPaid.toLocaleString(),"✅","var(--green)"],
          ["This Month Expenses","৳"+mExp.toLocaleString(),"💸","var(--red)"],
          ["Net Profit (Month)","৳"+(mPaid-mExp).toLocaleString(),"📈",(mPaid-mExp)>=0?"var(--green)":"var(--red)"],
        ].map(([l,v,ic,c])=>(
          <div key={l} className="panel" style={{ padding:"14px 16px",textAlign:"center" }}>
            <div style={{ fontSize:22 }}>{ic}</div>
            <div style={{ fontSize:17,fontWeight:800,color:c }}>{v}</div>
            <div style={{ fontSize:11,color:"var(--text3)",marginTop:3 }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:18 }}>
        <div className="panel">
          <div className="panel-header"><div className="panel-title">📊 Revenue vs Expenses — Last 6 Months</div></div>
          <div style={{ padding:"0 14px 14px" }}>
            {last6.map(x=>(
              <div key={x.label} style={{ marginBottom:14 }}>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--text3)",marginBottom:5 }}>
                  <span style={{ fontWeight:700,color:"var(--navy)" }}>{x.label}</span>
                  <span>{x.cnt} bookings · Net: <strong style={{ color:x.paid-x.exp>=0?"var(--green)":"var(--red)" }}>৳{(x.paid-x.exp).toLocaleString()}</strong></span>
                </div>
                <div style={{ display:"flex",gap:4,alignItems:"center" }}>
                  <div style={{ flex:1,height:10,background:"var(--border)",borderRadius:5,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:(x.billed/maxBar*100)+"%",background:"var(--gold2)",borderRadius:5 }} />
                  </div>
                  <span style={{ fontSize:11,fontWeight:700,color:"var(--gold2)",width:80,textAlign:"right" }}>৳{x.billed.toLocaleString()}</span>
                </div>
                <div style={{ display:"flex",gap:4,alignItems:"center",marginTop:3 }}>
                  <div style={{ flex:1,height:6,background:"var(--border)",borderRadius:5,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:(x.exp/maxBar*100)+"%",background:"var(--red)",borderRadius:5,opacity:.7 }} />
                  </div>
                  <span style={{ fontSize:11,color:"var(--red)",width:80,textAlign:"right" }}>৳{x.exp.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><div className="panel-title">🎭 Events by Type</div></div>
          <div style={{ padding:"0 14px 14px" }}>
            {byType.length===0&&<div style={{ color:"var(--text3)",fontSize:13,textAlign:"center",padding:14 }}>No data</div>}
            {byType.map(([t,n])=>{
              const et=EV_TYPES.find(x=>x.v===t);
              return (
                <div key={t} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4 }}>
                    <span>{et?.i} {t}</span><span style={{ fontWeight:700 }}>{n}</span>
                  </div>
                  <div style={{ height:6,background:"var(--border)",borderRadius:3,overflow:"hidden" }}>
                    <div style={{ height:"100%",width:(n/invoices.length*100)+"%",background:et?.accent||"var(--navy)",borderRadius:3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
