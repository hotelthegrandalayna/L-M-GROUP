
import { useState } from "react";
import { useHall, EV_TYPES } from "../HallContext";
import useIsMobile from "../useIsMobile";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// Per-event-type calendar colours (background, border accent)
const EV_CAL = {
  "Wedding":          { bg:"#fff5f0", border:"rgba(123,18,18,.28)",  chip:"#fae8a0", text:"#7B1212" },
  "Holud":            { bg:"#fffbea", border:"rgba(154,112,0,.25)",  chip:"#faebc0", text:"#7a5800" },
  "Wedding + Holud":  { bg:"#fdf4ff", border:"rgba(130,60,180,.25)", chip:"#e8d8ff", text:"#6030b0" },
  "Reception":        { bg:"#f8f0ff", border:"rgba(142,68,173,.25)", chip:"#e8d8ff", text:"#6030b0" },
  "Engagement":       { bg:"#fff0f8", border:"rgba(200,60,130,.22)", chip:"#f8d0e8", text:"#a01860" },
  "Birthday":         { bg:"#fff0f0", border:"rgba(192,57,43,.25)",  chip:"#fcc8c8", text:"#c0392b" },
  "Corporate Event":  { bg:"#f0f5ff", border:"rgba(52,100,219,.22)", chip:"#c8e8f8", text:"#1a4ab0" },
  "Others":           { bg:"#f0faf4", border:"rgba(26,122,64,.25)",  chip:"#b8e8c8", text:"#1a7a40" },
};

const C = { maroon:"#7B1212", gold:"#c9a84c", dim:"#666", border:"#e0d0b0" };

function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${MONTHS_S[parseInt(m)-1]} ${y}`;
}

function fmtMoney(n) { return "৳" + Number(n||0).toLocaleString(); }

function InvPreviewModal({ inv, onClose }) {
  if (!inv) return null;
  const ec = EV_CAL[inv.evType] || {};
  const grand = inv.grand || 0;
  const paid  = parseFloat(inv.adv) || 0;
  const bal   = Math.max(0, grand - paid);
  const ps    = inv.payStatus || "Unpaid";
  const psColor = ps==="Paid"?"#1a7a40":ps==="Partial"?"#8a6200":"#c0392b";
  const psBg    = ps==="Paid"?"#d4f5e2":ps==="Partial"?"#fef0b0":"#fcd5d5";
  return (
    <div onClick={onClose} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:16,width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,.25)",overflow:"hidden" }}>
        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#5a0a0a,#7B1212)",padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div>
            <div style={{ fontSize:15,fontWeight:800,fontFamily:"'Playfair Display',serif",color:"#f2dfc0" }}>{inv.client}</div>
            <div style={{ fontSize:11,color:"#c9a84c",marginTop:2 }}>Invoice #{inv.num} &nbsp;·&nbsp; {inv.evDate}</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,color:"#f2dfc0",cursor:"pointer",fontSize:18,padding:"4px 10px",lineHeight:1 }}>✕</button>
        </div>
        {/* Event type badge */}
        <div style={{ padding:"10px 18px",borderBottom:"1px solid #f0ede8",display:"flex",alignItems:"center",gap:8 }}>
          <span style={{ fontSize:11,fontWeight:800,padding:"3px 10px",borderRadius:20,background:ec.chip||"#eee",color:ec.text||"#333",border:`1px solid ${ec.border||"#ddd"}` }}>{inv.evType}</span>
          {inv.wDur && <span style={{ fontSize:11,color:C.dim }}>{inv.wDur}</span>}
          {(inv.wGuests||inv.hGuests) && <span style={{ fontSize:11,color:C.dim }}>👥 {inv.wGuests||inv.hGuests} guests</span>}
        </div>
        {/* Financials */}
        <div style={{ padding:"14px 18px",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,borderBottom:"1px solid #f0ede8" }}>
          {[["Grand Total","#7B1212",fmtMoney(grand)],["Advance Paid","#1a7a40",fmtMoney(paid)],["Balance Due","#c0392b",fmtMoney(bal)]].map(([l,c,v])=>(
            <div key={l} style={{ textAlign:"center",padding:"10px 6px",borderRadius:8,background:"#fafaf8",border:"1.5px solid #ede8e0" }}>
              <div style={{ fontSize:14,fontWeight:800,color:c,fontFamily:"'Playfair Display',serif" }}>{v}</div>
              <div style={{ fontSize:9,color:C.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:.5,marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>
        {/* Status + contact */}
        <div style={{ padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8 }}>
          <span style={{ fontSize:11,fontWeight:800,padding:"4px 12px",borderRadius:20,background:psBg,color:psColor,border:`1px solid ${psColor}40` }}>{ps}</span>
          <div style={{ fontSize:12,color:C.dim }}>{inv.phone}{inv.phone2?" · "+inv.phone2:""}</div>
        </div>
        {/* Services */}
        {inv.services?.length > 0 && (
          <div style={{ padding:"0 18px 14px" }}>
            <div style={{ fontSize:10,fontWeight:700,color:C.dim,textTransform:"uppercase",letterSpacing:.5,marginBottom:6 }}>Services</div>
            {inv.services.filter(s=>s.included!==false).map((s,i)=>(
              <div key={i} style={{ display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid #f5f5f3" }}>
                <span>{s.desc}</span>
                <span style={{ fontWeight:700 }}>৳{(parseFloat(s.rate)||0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function HallCalendar() {
  const { invoices } = useHall();
  const isMobile = useIsMobile();
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const [filter, setFilter] = useState("");
  const [previewInv, setPreviewInv] = useState(null);

  function prev() { if (mo===0){setMo(11);setYr(y=>y-1);}else setMo(m=>m-1); }
  function next() { if (mo===11){setMo(0);setYr(y=>y+1);}else setMo(m=>m+1); }

  const daysInMonth = new Date(yr, mo+1, 0).getDate();
  const startDay    = new Date(yr, mo, 1).getDay();
  const daysInPrev  = new Date(yr, mo, 0).getDate();
  const totalCells  = Math.ceil((startDay + daysInMonth) / 7) * 7;

  function getInvForDate(day) {
    const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return invoices.filter(inv =>
      (inv.evDate===ds || inv.hDate===ds || inv.h2Date===ds) &&
      (!filter || inv.evType===filter)
    );
  }

  const todayStr = now.toISOString().split("T")[0];

  const upcoming = invoices
    .filter(inv => inv.evDate >= todayStr && (!filter||inv.evType===filter))
    .sort((a,b) => a.evDate > b.evDate ? 1 : -1)
    .slice(0, 20);

  // Stats
  const bookedThisMonth = invoices.filter(inv => {
    const ds = `${yr}-${String(mo+1).padStart(2,"0")}`;
    return (inv.evDate||"").startsWith(ds);
  }).length;
  const availDays = daysInMonth - bookedThisMonth;
  const upcomingCount = invoices.filter(inv => inv.evDate >= todayStr).length;

  const ps = { padding:"15px 17px", background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, display:"flex", alignItems:"center", gap:12 };
  const psIcon = { fontSize:22 };
  const psN = { fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:C.maroon };
  const psL = { fontSize:10, color:C.dim, textTransform:"uppercase", letterSpacing:.8, fontWeight:700 };

  // When multiple invoices on same day, previewInv is an array — show picker first
  const multiPick = Array.isArray(previewInv);

  return (
    <div className="hall-page" style={{ padding: isMobile?"10px 8px":"22px 28px", maxWidth:1100, margin:"0 auto", width:"100%" }}>
      {/* Multi-booking picker modal */}
      {multiPick && (
        <div onClick={()=>setPreviewInv(null)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16 }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:"#fff",borderRadius:14,width:"100%",maxWidth:340,boxShadow:"0 20px 60px rgba(0,0,0,.25)",overflow:"hidden" }}>
            <div style={{ background:"linear-gradient(135deg,#5a0a0a,#7B1212)",padding:"12px 18px",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div style={{ fontSize:14,fontWeight:800,color:"#f2dfc0",fontFamily:"'Playfair Display',serif" }}>Multiple Bookings</div>
              <button onClick={()=>setPreviewInv(null)} style={{ background:"rgba(255,255,255,.15)",border:"none",borderRadius:8,color:"#f2dfc0",cursor:"pointer",fontSize:18,padding:"4px 10px",lineHeight:1 }}>✕</button>
            </div>
            {previewInv.map(inv=>{
              const ec = EV_CAL[inv.evType]||{};
              return (
                <div key={inv.id} onClick={()=>setPreviewInv(inv)} style={{ padding:"12px 18px",borderBottom:"1px solid #f0ede8",cursor:"pointer",display:"flex",gap:10,alignItems:"center" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#fafaf8"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <span style={{ fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:20,background:ec.chip||"#eee",color:ec.text||"#333",border:`1px solid ${ec.border||"#ddd"}`,flexShrink:0 }}>{inv.evType}</span>
                  <div>
                    <div style={{ fontWeight:700,fontSize:13 }}>{inv.client}</div>
                    <div style={{ fontSize:11,color:C.dim }}>{inv.phone}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Single invoice preview */}
      {!multiPick && <InvPreviewModal inv={previewInv} onClose={()=>setPreviewInv(null)} />}
      {/* Page title */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:26, fontWeight:700, fontFamily:"'Playfair Display',serif", color:C.maroon }}>Booking Calendar</div>
        <div style={{ fontSize:12, color:C.dim, marginTop:4 }}>Visual overview of all bookings.</div>
      </div>

      {/* Stat bar */}
      <div className="hall-stat-grid" style={{ display:"grid", gridTemplateColumns: isMobile?"1fr 1fr":"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        <div style={ps}><span style={psIcon}>📋</span><div><div style={psN}>{invoices.length}</div><div style={psL}>Total Invoices</div></div></div>
        <div style={ps}><span style={psIcon}>📅</span><div><div style={psN}>{bookedThisMonth}</div><div style={psL}>Booked This Month</div></div></div>
        <div style={{...ps, background:"#f0faf4", borderColor:"rgba(26,122,64,.25)"}}><span style={psIcon}>✅</span><div><div style={{...psN, color:"#1a7a40"}}>{availDays}</div><div style={psL}>Available Days</div></div></div>
        <div style={{...ps, background:"#fff8f0", borderColor:"rgba(201,168,76,.3)"}}><span style={psIcon}>⏳</span><div><div style={{...psN, color:C.gold}}>{upcomingCount}</div><div style={psL}>Upcoming</div></div></div>
      </div>

      {/* Calendar card */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:14, padding:20, marginBottom:20, boxShadow:"0 2px 12px rgba(0,0,0,.06)" }}>
        {/* Cal header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:10 }}>
          {/* Monthly View badge */}
          <div style={{ fontSize:9, letterSpacing:2, textTransform:"uppercase", color:"#fff", fontWeight:700, background:C.maroon, padding:"5px 12px", borderRadius:7 }}>
            📅 Monthly View
          </div>

          {/* Nav */}
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <button onClick={prev} style={{ width:28, height:28, borderRadius:7, border:"1.5px solid #ddd", background:"#fff", color:"#333", cursor:"pointer", fontSize:14, fontWeight:700, transition:".2s" }}>‹</button>
            <div style={{ fontSize:15, fontWeight:800, color:C.maroon, minWidth:160, textAlign:"center", fontFamily:"'Playfair Display',serif" }}>{MONTHS[mo]} {yr}</div>
            <button onClick={next} style={{ width:28, height:28, borderRadius:7, border:"1.5px solid #ddd", background:"#fff", color:"#333", cursor:"pointer", fontSize:14, fontWeight:700, transition:".2s" }}>›</button>
          </div>

          {/* Legend + filter */}
          <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
            {isMobile && null /* hide legend on mobile to save space */}

            {!isMobile && Object.entries(EV_CAL).map(([k,v]) => (
              <div key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:C.dim, fontWeight:600 }}>
                <div style={{ width:9, height:9, borderRadius:3, background:v.chip, border:`1px solid ${v.border}` }} />
                {k.replace(" Event","").replace(" + ","+").replace("Wedding","Wed.").replace("Corporate","Corp.")}
              </div>
            ))}
            <select value={filter} onChange={e=>setFilter(e.target.value)}
              style={{ padding:"5px 9px", fontSize:11, borderRadius:8, border:"1.5px solid #ddd", background:"#fff", fontFamily:"inherit", cursor:"pointer" }}>
              <option value="">All</option>
              {EV_TYPES.map(t=><option key={t.v} value={t.v}>{t.v}</option>)}
            </select>
          </div>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:3 }}>
          {DAYS.map(d => (
            <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:700, color:C.dim, padding:"4px 0", letterSpacing:.5 }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
          {Array.from({ length: totalCells }).map((_, i) => {
            const day  = i - startDay + 1;
            const isCurrentMonth = day >= 1 && day <= daysInMonth;
            const isToday = isCurrentMonth && yr===now.getFullYear() && mo===now.getMonth() && day===now.getDate();
            const displayDay = isCurrentMonth ? day : (i < startDay ? daysInPrev - startDay + i + 1 : day - daysInMonth);

            const invs = isCurrentMonth ? getInvForDate(day) : [];
            const multi = invs.length > 1;

            // Determine cell style
            let cellBg = "#fafaf8", cellBorder = "#e8e4dc";
            if (isToday) { cellBg="#fffbf0"; cellBorder=C.gold; }
            else if (multi) { cellBg="#fde8e8"; cellBorder="#c0392b"; }
            else if (invs.length===1) {
              const ec = EV_CAL[invs[0].evType] || {};
              cellBg = ec.bg || "#fafaf8";
              cellBorder = ec.border || "#e8e4dc";
            }

            const hasBooking = isCurrentMonth && invs.length > 0;
            return (
              <div key={i}
                onClick={hasBooking ? () => setPreviewInv(invs.length===1 ? invs[0] : invs) : undefined}
                style={{
                  minHeight:60, borderRadius:7, padding:"4px 5px",
                  background: isCurrentMonth ? cellBg : "#f5f5f3",
                  border: `1px solid ${isCurrentMonth ? cellBorder : "#eee"}`,
                  opacity: isCurrentMonth ? 1 : .38,
                  position:"relative",
                  cursor: hasBooking ? "pointer" : "default",
                  transition: hasBooking ? "transform .15s, box-shadow .15s" : undefined,
                  boxShadow: hasBooking ? "0 1px 4px rgba(0,0,0,.06)" : undefined,
                }}
                onMouseEnter={e=>{ if(hasBooking){ e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,.13)"; }}}
                onMouseLeave={e=>{ if(hasBooking){ e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.06)"; }}}
              >
                <div style={{ fontSize:11, fontWeight:isToday?800:600, color:isToday?C.maroon:"#333", marginBottom:2 }}>
                  {displayDay}
                </div>
                {invs.slice(0,2).map((inv,j) => {
                  const ec = EV_CAL[inv.evType] || {};
                  return (
                    <div key={j} title={`${inv.client} — ${inv.evType}`} style={{
                      fontSize:9, fontWeight:700, padding:"2px 4px", borderRadius:3, marginBottom:2,
                      background: ec.chip || "#eee",
                      color: ec.text || "#333",
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                      border:`1px solid ${ec.border||"#ddd"}`,
                    }}>
                      {inv.client}
                    </div>
                  );
                })}
                {invs.length > 2 && (
                  <div style={{ fontSize:9, color:C.maroon, fontWeight:700 }}>+{invs.length-2} more</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Bookings table */}
      <div className="hall-table-wrap" style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:14, overflow: isMobile?"auto":"hidden" }}>
        <div style={{ padding:"11px 16px", borderBottom:`1.5px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:C.gold, fontWeight:700 }}>Upcoming Bookings</div>
          <select value={filter} onChange={e=>setFilter(e.target.value)}
            style={{ padding:"5px 9px", fontSize:11, borderRadius:8, border:"1.5px solid #ddd", background:"#fff", fontFamily:"inherit" }}>
            <option value="">All</option>
            {EV_TYPES.map(t=><option key={t.v} value={t.v}>{t.v}</option>)}
          </select>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"#fafaf8" }}>
              {["Date","Event","Client","Guests","Total","Status"].map(h => (
                <th key={h} style={{ padding:"9px 12px", fontSize:10, color:C.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C.border}`, textAlign:"left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {upcoming.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign:"center", padding:28, color:C.dim, fontSize:13 }}>No upcoming bookings.</td></tr>
            ) : upcoming.map(inv => {
              const ec = EV_CAL[inv.evType] || {};
              const ps = inv.payStatus;
              const psColor = ps==="Paid"?"#1a7a40":ps==="Partial"?C.gold:"#c0392b";
              return (
                <tr key={inv.id} onClick={()=>setPreviewInv(inv)} style={{ borderBottom:`1px solid #f0ede8`,cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#fafaf8"}
                  onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>
                    <div style={{ fontWeight:800, color:C.maroon }}>{inv.evDate?.slice(8)} {MONTHS_S[parseInt(inv.evDate?.slice(5,7))-1]}</div>
                    <div style={{ fontSize:10, color:C.dim }}>{inv.evDate?.slice(0,4)}</div>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:20, background:ec.chip||"#eee", color:ec.text||"#333", border:`1px solid ${ec.border||"#ddd"}` }}>{inv.evType}</span>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{inv.client}</div>
                    <div style={{ fontSize:11, color:C.dim }}>{inv.phone}</div>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:C.dim }}>{inv.wGuests || inv.hGuests || "—"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:800, color:C.maroon, fontFamily:"'Playfair Display',serif" }}>৳{Number(inv.grand||0).toLocaleString()}</div>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:10, fontWeight:800, padding:"3px 9px", borderRadius:20, background:`${psColor}18`, color:psColor, border:`1px solid ${psColor}40` }}>{ps}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
