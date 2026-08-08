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
    <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 15px", marginBottom:14 }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap", marginBottom:12 }}>
        <span style={{ width:24, height:24, borderRadius:7, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <i className="ti ti-chart-donut" style={{ fontSize:13, color:"var(--text2)" }} />
        </span>
        <span style={{ fontSize:10.5, fontWeight:600, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" }}>Where the money went — {monthLabel}</span>
        <span style={{ marginLeft:"auto", fontSize:11, color:"var(--text3)", fontVariantNumeric:"tabular-nums" }}>{money(total)} total</span>
      </div>

      {/* High-cost alert */}
      {alert && (
        <div style={{ display:"flex", gap:9, background:"#fdf4f3", border:"1px solid #e0b3b0", borderRadius:10, padding:"10px 13px", marginBottom:13, alignItems:"center" }}>
          <i className="ti ti-alert-triangle" style={{ fontSize:17, color:"#8f2323", flexShrink:0 }} />
          <div style={{ fontSize:11.5, color:"#8f2323", lineHeight:1.5 }}>
            <span style={{ fontWeight:600 }}>{alert.cat} is unusually high this month</span><br/>
            Normally around {alert.avg}% of your costs — this month it's <strong>{alert.share}% ({money(alert.amt)})</strong>.
          </div>
        </div>
      )}

      {/* Highlights */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10, marginBottom:14 }}>
        {[
          top          && ["Biggest cost",  top.cat,          money(top.amt),            "#b5322a"],
          mostFrequent && ["Most often",    mostFrequent.cat, mostFrequent.cnt+" times", "var(--text2)"],
          smallest     && ["Smallest cost", smallest.cat,     money(smallest.amt),       "#2f7d4f"],
        ].filter(Boolean).map(([label,cat,val,color])=>(
          <div key={label} style={{ border:"1px solid var(--border)", borderRadius:9, padding:"9px 11px" }}>
            <div style={{ fontSize:9, letterSpacing:.6, textTransform:"uppercase", color:"var(--text3)", fontWeight:600 }}>{label}</div>
            <div style={{ fontSize:13, fontWeight:600, marginTop:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{cat}</div>
            <div style={{ fontSize:14, fontWeight:600, color, fontVariantNumeric:"tabular-nums" }}>{val}</div>
          </div>
        ))}
      </div>

      {/* Category bars — aligned columns: name · bar · % · amount */}
      <div>
        {rows.map((r, i) => {
          const pct = total > 0 ? Math.round(r.amt / total * 100) : 0;
          const color = BAR_COLORS[i % BAR_COLORS.length];
          const isAlerted = alert && alert.cat === r.cat;
          return (
            <div key={r.cat} onClick={() => onPickCategory && onPickCategory(r.cat)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderTop:"1px solid var(--border)", cursor: onPickCategory ? "pointer" : "default" }}
              title={`Show only ${r.cat} in the table`}>
              <span style={{ flex:"0 0 130px", minWidth:0, fontSize:12.5, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {r.cat}
                {isAlerted && <span style={{ background:"#fdf4f3", color:"#8f2323", fontSize:9, padding:"1px 6px", borderRadius:8, marginLeft:5, fontWeight:600 }}>HIGH</span>}
              </span>
              <div style={{ flex:1, minWidth:40, height:7, background:"var(--bg3)", borderRadius:20, overflow:"hidden" }}>
                <div style={{ height:"100%", width:Math.max(pct,1)+"%", background:color, borderRadius:20, transition:"width .4s" }} />
              </div>
              <span style={{ flex:"0 0 38px", textAlign:"right", fontSize:10.5, color:"var(--text3)" }}>{pct}%</span>
              <span style={{ flex:"0 0 70px", textAlign:"right", fontSize:12.5, fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{money(r.amt)}</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:10.5, color:"var(--text3)", marginTop:10 }}>Tap a category to filter the records below.</div>
    </div>
  );
}
