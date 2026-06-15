
import { useState, useMemo, useRef, useEffect } from "react";
import { useHall, EV_TYPES } from "../HallContext";
import useIsMobile from "../useIsMobile";

const C = { maroon:"#7B1212", gold:"#c9a84c", dim:"#666", border:"#e0d0b0", green:"#1a7040", red:"#c0392b", blue:"#1a56cb" };

const STAGES = [
  { key:"New Enquiry", icon:"🆕", color:C.blue,  bg:"#e8f1fd" },
  { key:"Quoted",      icon:"💬", color:C.maroon, bg:"#fdf0f0" },
  { key:"Follow Up",   icon:"🔔", color:"#b45309",bg:"#fef3e2" },
  { key:"Confirmed",   icon:"✅", color:C.green,  bg:"#eafaf1" },
  { key:"Lost",        icon:"❌", color:"#666",   bg:"#f5f5f5" },
];

const SOURCES = ["Walk-in","Phone Call","WhatsApp","Facebook","Instagram","Referral","Returning Client","Other"];

function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m)-1]} ${y}`;
}

function fuClass(followDate) {
  if (!followDate) return "";
  const today = new Date().toISOString().split("T")[0];
  if (followDate < today) return "overdue";
  if (followDate === today) return "today";
  return "";
}

let _nextId = Date.now();
function genId() { return String(++_nextId); }

function crmNextNum(leads) {
  if (!leads.length) return "CRM-001";
  const nums = leads.map(l => parseInt(l.num?.replace(/\D/g,"")) || 0);
  return "CRM-" + String(Math.max(...nums)+1).padStart(3,"0");
}

const blankForm = () => ({
  name:"", phone:"", evType:"", evDate:"", guests:"",
  source:"", stage:"New Enquiry", followDate:"", assigned:"admin", notes:""
});

export default function HallCRM() {
  const { invoices, leads = [], setLeads, notify } = useHall();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [form, setForm] = useState(blankForm());
  const [editId, setEditId] = useState(null);
  const [errors, setErrors] = useState({});
  const formRef = useRef();
  const today = new Date().toISOString().split("T")[0];

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Pipeline counts ──────────────────────────────────────────────────────────
  const pipelineCounts = useMemo(() =>
    STAGES.reduce((acc, s) => {
      acc[s.key] = leads.filter(l => l.stage === s.key);
      return acc;
    }, {}),
  [leads]);

  // ── Today's alert banner ─────────────────────────────────────────────────────
  const dueToday  = leads.filter(l => l.followDate === today && l.stage !== "Confirmed" && l.stage !== "Lost");
  const overdue   = leads.filter(l => l.followDate && l.followDate < today && l.stage !== "Confirmed" && l.stage !== "Lost");

  // ── Filtered table ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return [...leads].reverse().filter(l =>
      (!s || l.name?.toLowerCase().includes(s) || l.phone?.includes(s)) &&
      (!filterStage || l.stage === filterStage) &&
      (!filterSource || l.source === filterSource)
    );
  }, [leads, search, filterStage, filterSource]);

  // ── Anniversary reminders from wedding invoices ──────────────────────────────
  const anniversaries = useMemo(() => {
    const now = new Date();
    return invoices
      .filter(inv => (inv.evType === "Wedding" || inv.evType === "Wedding + Holud") && inv.wBride && inv.evDate)
      .map(inv => {
        const d = new Date(inv.evDate);
        const years = now.getFullYear() - d.getFullYear();
        let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
        if (next < now) next = new Date(now.getFullYear()+1, d.getMonth(), d.getDate());
        const daysLeft = Math.round((next - now) / (1000*60*60*24));
        return { inv, years, daysLeft, isToday: daysLeft === 0 };
      })
      .sort((a,b) => a.daysLeft - b.daysLeft);
  }, [invoices]);

  // ── Actions ──────────────────────────────────────────────────────────────────
  function saveLead() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Name is required.";
    if (!form.phone.trim()) errs.phone = "Phone is required.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    if (editId) {
      setLeads(prev => prev.map(l => l.id === editId ? { ...l, ...form, updatedAt: new Date().toISOString() } : l));
      notify("Lead updated", "success");
    } else {
      const newLead = {
        id: genId(), num: crmNextNum(leads),
        ...form, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      setLeads(prev => [...prev, newLead]);
      notify("Lead saved!", "success");
    }
    clearForm();
  }

  function clearForm() {
    setForm(blankForm());
    setEditId(null);
    setErrors({});
  }

  function editLead(l) {
    setForm({ name:l.name||"", phone:l.phone||"", evType:l.evType||"", evDate:l.evDate||"",
      guests:l.guests||"", source:l.source||"", stage:l.stage||"New Enquiry",
      followDate:l.followDate||"", assigned:l.assigned||"admin", notes:l.notes||"" });
    setEditId(l.id);
    setErrors({});
    formRef.current?.scrollIntoView({ behavior:"smooth" });
    notify("Editing: " + l.name, "info");
  }

  function deleteLead(l) {
    if (!window.confirm("Delete this lead?")) return;
    setLeads(prev => prev.filter(x => x.id !== l.id));
    notify("Deleted.", "success");
  }

  function quickStage(id, newStage) {
    setLeads(prev => prev.map(l => {
      if (l.id !== id) return l;
      const upd = { ...l, stage: newStage, updatedAt: new Date().toISOString() };
      if (newStage === "Follow Up" && !l.followDate) upd.followDate = today;
      return upd;
    }));
    const name = leads.find(l=>l.id===id)?.name || "";
    notify(`${name} moved to ${newStage}`, "success");
  }

  function exportCSV() {
    const headers = ["Lead #","Name","Phone","Event","Date","Guests","Source","Stage","Follow-up","Notes"];
    const rows = leads.map(l => [l.num,l.name,l.phone,l.evType,l.evDate,l.guests,l.source,l.stage,l.followDate,l.notes].map(v=>`"${(v||"").replace(/"/g,'""')}"`));
    const csv = [headers, ...rows].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "crm_leads.csv";
    a.click();
  }

  function sendWA(phone, name) {
    let p = phone.replace(/[^0-9]/g,"");
    if (p.startsWith("0")) p = "880" + p.slice(1);
    const msg = `আস-সালামু আলাইকুম ${name} ভাই/আপা 🙏\n\nআমরা আপনার সাথে যোগাযোগ করতে চাচ্ছি। আপনার সুবিধামতো সময় জানালে আমরা আপনার সাথে কথা বলতে পারি।\n\n🏛️ Amelia Convention Hall`;
    window.open(`https://wa.me/${p}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function sendAnniversaryWish(inv, years) {
    let phone = (inv.wCouplePhone||inv.phone||"").replace(/[^0-9]/g,"");
    if (phone.startsWith("0")) phone = "880" + phone.slice(1);
    const ordinal = years===1?"1st":years===2?"2nd":years===3?"3rd":years+"th";
    const msg = `আস-সালামু আলাইকুম ${inv.wBride||""} ও ${inv.wGroom||""} 💑\n\n🎉 আপনাদের *${ordinal} বিবাহবার্ষিকী* উপলক্ষে Amelia Convention Hall-এর পক্ষ থেকে আন্তরিক শুভেচ্ছা!\n\n💍 আপনাদের সুখী দাম্পত্য জীবনের জন্য আমাদের আন্তরিক দোয়া রইল।\n\n📞 +880 1838-616405`;
    if (!phone) { notify("No phone saved", "error"); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  const inp = (style={}) => ({ padding:"9px 12px", border:"1.5px solid #e5e3de", borderRadius:8, fontSize:13, fontFamily:"inherit", background:"#fafaf9", width:"100%", boxSizing:"border-box", outline:"none", ...style });
  const lbl = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };
  const errTxt = { fontSize:11, color:C.red, marginTop:3 };

  return (
    <div className="hall-page" style={{ padding: isMobile?"10px 8px":"22px 28px", maxWidth:1200, margin:"0 auto", width:"100%" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12, marginBottom:18 }}>
        <div>
          <div style={{ fontSize:26, fontWeight:700, fontFamily:"'Playfair Display',serif", color:C.maroon, marginBottom:2 }}>🤝 CRM — Lead Tracker</div>
          <div style={{ fontSize:12, color:C.dim }}>Track enquiries, follow-ups and convert leads to bookings.</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={exportCSV} style={{ padding:"8px 14px", fontSize:12, borderRadius:9, border:"1.5px solid #e5e3de", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>⬇ Export CSV</button>
          <button onClick={() => formRef.current?.scrollIntoView({ behavior:"smooth" })}
            style={{ padding:"8px 16px", fontSize:12, borderRadius:9, border:"none", background:C.maroon, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800 }}>➕ Add Lead</button>
        </div>
      </div>

      {/* ── Pipeline Dashboard ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:16 }}>
        {STAGES.map(s => {
          const lst = pipelineCounts[s.key] || [];
          const pct = leads.length ? Math.round(lst.length / leads.length * 100) : 0;
          const overdueFU = s.key === "Follow Up" ? lst.filter(l => l.followDate && l.followDate < today).length : 0;
          const invoicedC = s.key === "Confirmed" ? lst.filter(l => l.invoiced).length : 0;
          return (
            <div key={s.key} onClick={() => setFilterStage(filterStage === s.key ? "" : s.key)}
              style={{ cursor:"pointer", background:s.bg, border:`2px solid ${s.color}22`, borderRadius:12, padding:"14px 16px", transition:".15s", userSelect:"none",
                ...(filterStage===s.key ? { borderColor:s.color+"88", boxShadow:`0 0 0 2px ${s.color}22` } : {}) }}
              onMouseOver={e=>e.currentTarget.style.borderColor=s.color+"55"}
              onMouseOut={e=>e.currentTarget.style.borderColor=filterStage===s.key?s.color+"88":s.color+"22"}
            >
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:s.color, marginBottom:10 }}>{s.icon} {s.key}</div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1 }}>{lst.length}</div>
              <div style={{ fontSize:10, color:"#999", marginTop:3 }}>{pct}% of all leads</div>
              {overdueFU > 0 && <div style={{ fontSize:10, color:C.red, fontWeight:700, marginTop:4 }}>⚠ {overdueFU} overdue</div>}
              {invoicedC > 0 && <div style={{ fontSize:10, color:C.green, fontWeight:700, marginTop:4 }}>🧾 {invoicedC} invoiced</div>}
            </div>
          );
        })}
      </div>

      {/* ── Today's Alert Banner ── */}
      {(dueToday.length > 0 || overdue.length > 0) && (
        <div style={{ background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:10, padding:"12px 16px", marginBottom:14, fontSize:13, color:"#7a5c00", fontWeight:600 }}>
          {dueToday.length > 0 && <div>📅 <strong>{dueToday.length} follow-up{dueToday.length>1?"s":""} due TODAY:</strong> {dueToday.map(l=>l.name).join(", ")}</div>}
          {overdue.length > 0 && <div style={{ marginTop: dueToday.length?4:0 }}>⚠️ <strong>{overdue.length} overdue:</strong> {overdue.map(l=>l.name).join(", ")}</div>}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Search name, phone or event..."
          style={{ ...inp(), flex:1, minWidth:200 }} />
        <select value={filterStage} onChange={e=>setFilterStage(e.target.value)} style={{ ...inp(), maxWidth:180 }}>
          <option value="">All Stages</option>
          {STAGES.map(s=><option key={s.key} value={s.key}>{s.icon} {s.key}</option>)}
        </select>
        <select value={filterSource} onChange={e=>setFilterSource(e.target.value)} style={{ ...inp(), maxWidth:180 }}>
          <option value="">All Sources</option>
          {SOURCES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Lead Table ── */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, overflowX:"auto", marginBottom:20 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:720 }}>
          <thead>
            <tr style={{ background:"#fafaf8" }}>
              {["Lead #","Client","Event","Date / Guests","Source","Stage","Follow-up","Notes","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 12px", fontSize:10, color:C.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C.border}`, textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign:"center", padding:28, color:C.dim, fontSize:13 }}>No leads found. Add your first enquiry above!</td></tr>
            ) : filtered.map(l => {
              const fu = fuClass(l.followDate);
              const locked = (l.stage === "Confirmed" || l.invoiced);
              return (
                <tr key={l.id} style={{ borderBottom:"1px solid #f0ede8", background: locked ? "#f8fff8" : "transparent", opacity: locked ? .82 : 1 }}>
                  <td style={{ padding:"10px 12px", fontWeight:700, color:C.maroon, fontSize:12 }}>{l.num}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:700, fontSize:13 }}>{l.name}</div>
                    <div style={{ fontSize:10, color:C.dim }}>{l.phone}</div>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>{l.evType || "—"}</td>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>
                    {l.evDate ? fmtDate(l.evDate) : "—"}
                    {l.guests ? <span style={{ fontSize:10, color:"#999" }}> ({l.guests})</span> : null}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    {l.source ? <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20, background:"#f0f4ff", color:C.blue, border:"1px solid #c8d8f8" }}>{l.source}</span> : "—"}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    {locked ? (
                      <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, background:"#eafaf1", color:C.green, border:`1px solid ${C.green}40` }}>✅ Confirmed</span>
                    ) : (
                      <select value={l.stage} onChange={e=>quickStage(l.id,e.target.value)}
                        style={{ padding:"4px 7px", fontSize:11, fontWeight:700, borderRadius:8, cursor:"pointer", border:"1.5px solid #ccc", background:"#fff", fontFamily:"inherit" }}>
                        {STAGES.map(s=><option key={s.key} value={s.key}>{s.key}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, whiteSpace:"nowrap" }}>
                    {l.followDate ? (
                      <span style={{ fontWeight:700, color: fu==="overdue"?C.red:fu==="today"?C.green:C.dim }}>
                        {fu==="overdue"?"⚠️ ":fu==="today"?"✅ ":""}{fmtDate(l.followDate)}
                      </span>
                    ) : "—"}
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:11, color:"#555", maxWidth:140 }}>
                    {l.notes ? l.notes.slice(0,55)+(l.notes.length>55?"…":"") : "—"}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    {locked ? (
                      <span style={{ fontSize:10, color:C.green, fontWeight:700, padding:"4px 8px", background:"#eafaf1", border:"1px solid #a0dbb0", borderRadius:8 }}>🧾 Invoiced</span>
                    ) : (
                      <div style={{ display:"flex", gap:4 }}>
                        <button title="WhatsApp Follow-up" onClick={()=>sendWA(l.phone,l.name)}
                          style={{ padding:"4px 7px", borderRadius:7, border:"1.5px solid #25D366", background:"#eafff3", cursor:"pointer", fontSize:13 }}>💬</button>
                        <button title="Edit" onClick={()=>editLead(l)}
                          style={{ padding:"4px 7px", borderRadius:7, border:"1.5px solid #ddd", background:"#fff", cursor:"pointer", fontSize:13 }}>✏️</button>
                        <button title="Delete" onClick={()=>deleteLead(l)}
                          style={{ padding:"4px 7px", borderRadius:7, border:`1.5px solid ${C.red}40`, background:"#fff0f0", cursor:"pointer", fontSize:13 }}>🗑</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Anniversary Reminders ── */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.gold}`, borderRadius:12, padding:"18px 20px", marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:8 }}>
          <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:C.maroon }}>💍 Marriage Anniversary Reminders</h3>
          <span style={{ fontSize:11, color:"#999" }}>Auto-populated from wedding invoices · Click 💬 to send WhatsApp wish</span>
        </div>
        {anniversaries.length === 0 ? (
          <div style={{ color:"#aaa", fontSize:13, padding:"8px 0" }}>No wedding invoices with couple details yet.</div>
        ) : anniversaries.map((a,i) => {
          const badge = a.isToday
            ? <span style={{ background:C.gold, color:"#3d1a00", fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:10, marginLeft:8 }}>🎉 TODAY!</span>
            : a.daysLeft <= 7
            ? <span style={{ background:"#e74c3c", color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, marginLeft:8 }}>{a.daysLeft}d away</span>
            : a.daysLeft <= 30
            ? <span style={{ background:"#f39c12", color:"#fff", fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, marginLeft:8 }}>{a.daysLeft}d away</span>
            : <span style={{ color:"#aaa", fontSize:11, marginLeft:8 }}>{a.daysLeft} days</span>;
          return (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid #f0ece4", flexWrap:"wrap" }}>
              <div style={{ fontSize:22 }}>💍</div>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.maroon }}>
                  {a.inv.wBride} &amp; {a.inv.wGroom}{badge}
                </div>
                <div style={{ fontSize:11, color:"#888", marginTop:2 }}>
                  {fmtDate(a.inv.evDate)} &nbsp;·&nbsp; {a.years} year{a.years!==1?"s":""} anniversary &nbsp;·&nbsp; {a.inv.num}
                </div>
              </div>
              <button onClick={()=>sendAnniversaryWish(a.inv, a.years)}
                style={{ padding:"6px 14px", background:"#25D366", color:"#fff", border:"none", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                💬 Send Wishes
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Add / Edit Lead Form ── */}
      <div ref={formRef} style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${C.maroon}`, borderRadius:12, padding:"20px 22px" }}>
        <h3 style={{ margin:"0 0 18px", fontSize:15, fontWeight:800, color:C.maroon }}>
          {editId ? "✏️ Edit Lead" : "➕ Add New Enquiry / Lead"}
        </h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
          <div>
            <label style={lbl}>Client Name *</label>
            <input value={form.name} onChange={e=>setF("name",e.target.value)} placeholder="Full name" style={inp(errors.name?{borderColor:C.red}:{})} />
            {errors.name && <div style={errTxt}>{errors.name}</div>}
          </div>
          <div>
            <label style={lbl}>Phone *</label>
            <input value={form.phone} onChange={e=>setF("phone",e.target.value)} placeholder="+880 1XXX-XXXXXX" style={inp(errors.phone?{borderColor:C.red}:{})} />
            {errors.phone && <div style={errTxt}>{errors.phone}</div>}
          </div>
          <div>
            <label style={lbl}>Event Type</label>
            <select value={form.evType} onChange={e=>setF("evType",e.target.value)} style={inp()}>
              <option value="">— Select —</option>
              {EV_TYPES.map(t=><option key={t.v} value={t.v}>{t.v}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Preferred Event Date</label>
            <input type="date" value={form.evDate} onChange={e=>setF("evDate",e.target.value)} min={today} style={inp()} />
          </div>
          <div>
            <label style={lbl}>Estimated Guests</label>
            <input type="number" value={form.guests} onChange={e=>setF("guests",e.target.value)} placeholder="e.g. 200" min={1} style={inp()} />
          </div>
          <div>
            <label style={lbl}>Enquiry Source</label>
            <select value={form.source} onChange={e=>setF("source",e.target.value)} style={inp()}>
              <option value="">— Select —</option>
              {SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Pipeline Stage</label>
            <select value={form.stage} onChange={e=>setF("stage",e.target.value)} style={inp()}>
              {STAGES.map(s=><option key={s.key} value={s.key}>{s.icon} {s.key}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Follow-up Date</label>
            <input type="date" value={form.followDate} onChange={e=>setF("followDate",e.target.value)} min={today} style={inp()} />
          </div>
          <div>
            <label style={lbl}>Assigned To</label>
            <select value={form.assigned} onChange={e=>setF("assigned",e.target.value)} style={inp()}>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop:12 }}>
          <label style={lbl}>Notes / Comments</label>
          <textarea value={form.notes} onChange={e=>setF("notes",e.target.value)}
            placeholder="What did the client ask? Price given? Any special requests?"
            rows={3} style={{ ...inp(), resize:"vertical" }} />
        </div>
        <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:14 }}>
          <button onClick={clearForm} style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #e5e3de", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 }}>Clear</button>
          <button onClick={saveLead} style={{ padding:"9px 20px", borderRadius:9, border:"none", background:C.maroon, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13 }}>
            💾 {editId ? "Update Lead" : "Save Lead"}
          </button>
        </div>
      </div>

    </div>
  );
}
