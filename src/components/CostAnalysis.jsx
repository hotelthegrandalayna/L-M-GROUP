import { useMemo } from "react";

// Shared "Where did the money go?" cost analysis panel.
// Used by both the hotel Expenses page and the hall Expenses page.
// Expects items pre-normalized to { cat, amount, date } — business expenses only.

const BAR_COLORS = ["#E24B4A","#EF9F27","#378ADD","#7F77DD","#1D9E75","#D4537E","#0F6E56","#993C1D","#185FA5","#5F5E5A"];
const BAR_BGS    = ["#FCEBEB","#FAEEDA","#E6F1FB","#EEEDFE","#E1F5EE","#FBEAF0","#E1F5EE","#FAECE7","#E6F1FB","#F1EFE8"];

function money(n) { return "৳" + (n||0).toLocaleString(); }

export default function CostAnalysis({ items, allItems, monthKey, monthLabel, catEmoji, accent, onPickCategory }) {

  const analysis = useMemo(() => {
    const totals = {}; const counts = {};
    items.forEach(e => {
      const c = e.cat || "Other";
      totals[c] = (totals[c]||0) + (e.amount||0);
      counts[c] = (counts[c]||0) + 1;
    });
    const rows = Object.entries(totals)
      .map(([cat, amt]) => ({ cat, amt, cnt: counts[cat] }))
      .filter(r => r.amt > 0)
      .sort((a,b) => b.amt - a.amt);
    const total = rows.reduce((s,r) => s + r.amt, 0);

    const top = rows[0] || null;
    const mostFrequent = rows.length ? [...rows].sort((a,b) => b.cnt - a.cnt)[0] : null;
    const smallest = rows.length ? rows[rows.length-1] : null;

    // High-cost alert: compare top category's share vs its average share in
    // previous months (needs at least 2 months of history to judge)
    let alert = null;
    if (top && total > 0) {
      const share = top.amt / total;
      const monthShares = [];
      const byMonth = {};
      allItems.forEach(e => {
        const m = (e.date||"").slice(0,7);
        if (!m || m === monthKey) return;
        if (!byMonth[m]) byMonth[m] = { cat: 0, total: 0 };
        byMonth[m].total += (e.amount||0);
        if ((e.cat||"Other") === top.cat) byMonth[m].cat += (e.amount||0);
      });
      Object.values(byMonth).forEach(v => { if (v.total > 0) monthShares.push(v.cat / v.total); });
      if (monthShares.length >= 2) {
        const avg = monthShares.reduce((s,x)=>s+x,0) / monthShares.length;
        if (share > 0.3 && share > avg * 1.5) {
          alert = { cat: top.cat, amt: top.amt, share: Math.round(share*100), avg: Math.round(avg*100) };
        }
      }
    }

    return { rows, total, top, mostFrequent, smallest, alert };
  }, [items, allItems, monthKey]);

  const { rows, total, top, mostFrequent, smallest, alert } = analysis;
  const emoji = c => (catEmoji && catEmoji[c]) || "📌";

  if (rows.length === 0) return null;

  return (
    <div style={{ background:"#fff", border:"1.5px solid #e2e2e2", borderRadius:12, padding:"18px 20px", marginBottom:18 }}>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:14 }}>
        <div style={{ fontSize:15, fontWeight:800, color:accent }}>📊 Where did the money go? — {monthLabel}</div>
        <span style={{ background:accent+"18", color:accent, fontSize:11, padding:"4px 10px", borderRadius:12, fontWeight:700 }}>{money(total)} total cost</span>
      </div>

      {/* High-cost alert */}
      {alert && (
        <div style={{ display:"flex", gap:10, background:"#FCEBEB", border:"1.5px solid #F09595", borderRadius:12, padding:"12px 14px", marginBottom:16, alignItems:"center" }}>
          <span style={{ fontSize:22 }}>⚠️</span>
          <div style={{ fontSize:12, color:"#791F1F", lineHeight:1.5 }}>
            <span style={{ fontWeight:800, fontSize:13 }}>{alert.cat} is unusually high this month</span><br/>
            Normally around {alert.avg}% of your costs — this month it's <strong>{alert.share}% ({money(alert.amt)})</strong>. Worth a look.
          </div>
        </div>
      )}

      {/* Medal cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:18 }}>
        {top && (
          <div style={{ background:"#FCEBEB", borderRadius:12, padding:12, textAlign:"center" }}>
            <div style={{ fontSize:20 }}>🥇</div>
            <div style={{ fontSize:10, color:"#993C1D", letterSpacing:.5, margin:"2px 0", fontWeight:700 }}>BIGGEST COST</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#791F1F" }}>{emoji(top.cat)} {top.cat}</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#A32D2D" }}>{money(top.amt)}</div>
          </div>
        )}
        {mostFrequent && (
          <div style={{ background:"#E6F1FB", borderRadius:12, padding:12, textAlign:"center" }}>
            <div style={{ fontSize:20 }}>🔁</div>
            <div style={{ fontSize:10, color:"#185FA5", letterSpacing:.5, margin:"2px 0", fontWeight:700 }}>MOST OFTEN</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#0C447C" }}>{emoji(mostFrequent.cat)} {mostFrequent.cat}</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#185FA5" }}>{mostFrequent.cnt} times</div>
          </div>
        )}
        {smallest && (
          <div style={{ background:"#E1F5EE", borderRadius:12, padding:12, textAlign:"center" }}>
            <div style={{ fontSize:20 }}>🌱</div>
            <div style={{ fontSize:10, color:"#0F6E56", letterSpacing:.5, margin:"2px 0", fontWeight:700 }}>SMALLEST COST</div>
            <div style={{ fontSize:13, fontWeight:800, color:"#085041" }}>{emoji(smallest.cat)} {smallest.cat}</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#0F6E56" }}>{money(smallest.amt)}</div>
          </div>
        )}
      </div>

      {/* Category bars */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {rows.map((r, i) => {
          const pct = total > 0 ? Math.round(r.amt / total * 100) : 0;
          const color = BAR_COLORS[i % BAR_COLORS.length];
          const bg    = BAR_BGS[i % BAR_BGS.length];
          const isAlerted = alert && alert.cat === r.cat;
          return (
            <div key={r.cat} onClick={() => onPickCategory && onPickCategory(r.cat)}
              style={{ display:"flex", alignItems:"center", gap:10, cursor: onPickCategory ? "pointer" : "default" }}
              title={`Show only ${r.cat} in the table`}>
              <span style={{ width:30, height:30, borderRadius:8, background:bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>{emoji(r.cat)}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                  <span style={{ fontWeight:700 }}>
                    {r.cat}
                    {isAlerted && <span style={{ background:"#FCEBEB", color:"#A32D2D", fontSize:9, padding:"1px 7px", borderRadius:8, marginLeft:6, fontWeight:800 }}>HIGH</span>}
                  </span>
                  <span style={{ color: i===0 ? "#A32D2D" : "#666", fontWeight:700 }}>{money(r.amt)}</span>
                </div>
                <div style={{ height:12, background:"#f0f0f0", borderRadius:6, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:Math.max(pct,1)+"%", background:color, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:6, boxSizing:"border-box", transition:"width .4s" }}>
                    {pct >= 8 && <span style={{ fontSize:9, color:"#fff", fontWeight:800 }}>{pct}%</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:11, color:"#999", marginTop:12 }}>Tap any category to see only those expenses in the table below.</div>
    </div>
  );
}
