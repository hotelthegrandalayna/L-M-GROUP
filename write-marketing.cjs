const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Marketing.jsx';

const code = `import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { money, todayStr } from "../utils/helpers";

const TEMPLATES = [
  { id:1, name:"Welcome Message",    icon:"ti-hand-stop", tag:"check-in",
    body:"Dear {guest}, welcome to Hotel The Grand Alayna! We hope you enjoy your stay in Room {room}. Check-out is on {checkout}. Feel free to contact us for anything. Thank you!" },
  { id:2, name:"Checkout Reminder",  icon:"ti-bell",      tag:"checkout",
    body:"Dear {guest}, this is a friendly reminder that your check-out is tomorrow ({checkout}). Please settle any outstanding balance at the front desk. We hope you had a wonderful stay!" },
  { id:3, name:"Payment Reminder",   icon:"ti-receipt",   tag:"payment",
    body:"Dear {guest}, we noticed there is an outstanding balance of {balance} on your account for Room {room}. Kindly settle at your earliest convenience. Thank you!" },
  { id:4, name:"Thank You Message",  icon:"ti-heart",     tag:"feedback",
    body:"Dear {guest}, thank you for choosing Hotel The Grand Alayna! We hope you had a wonderful experience. We look forward to welcoming you again soon. Please share your feedback with us!" },
  { id:5, name:"Special Offer",      icon:"ti-discount",  tag:"promo",
    body:"Dear {guest}, as a valued guest, we are pleased to offer you an exclusive 10% discount on your next stay at Hotel The Grand Alayna. Book now and enjoy! Contact us to avail this offer." },
];

const TAG_COLOR = { "check-in":"#10b981","checkout":"#f59e0b","payment":"#ef4444","feedback":"#8b5cf6","promo":"#3b82f6" };

function fill(template, booking) {
  if (!booking) return template;
  const inv  = booking.invoiceTotal ?? booking.amount;
  const paid = (booking.paymentHistory||[]).reduce((s,p)=>s+p.amount,0);
  const bal  = Math.max(0,inv-paid);
  return template
    .replace(/{guest}/g,   booking.guest||"Guest")
    .replace(/{room}/g,    booking.room||"")
    .replace(/{checkin}/g, booking.checkin||"")
    .replace(/{checkout}/g,booking.checkout||"")
    .replace(/{balance}/g, "BDT "+bal.toLocaleString())
    .replace(/{phone}/g,   booking.phone||"");
}

export default function Marketing() {
  const { bookings } = useApp();
  const today = todayStr();
  const [selTemplate, setSelTemplate] = useState(TEMPLATES[0]);
  const [selBooking,  setSelBooking]  = useState(null);
  const [customMsg,   setCustomMsg]   = useState("");
  const [copied,      setCopied]      = useState(false);
  const [filterTag,   setFilterTag]   = useState("all");
  const [search,      setSearch]      = useState("");

  const activeBookings = bookings.filter(b=>!["cancelled"].includes(b.status)).sort((a,b)=>b.id-a.id);

  const filteredBookings = useMemo(()=>{
    let arr=[...activeBookings];
    if(search.trim()){const q=search.trim().toLowerCase();arr=arr.filter(b=>b.guest?.toLowerCase().includes(q)||b.phone?.includes(q)||String(b.room).includes(q));}
    return arr;
  },[activeBookings,search]);

  const previewMsg = fill(customMsg||selTemplate.body, selBooking);

  function copyMsg() {
    navigator.clipboard.writeText(previewMsg).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

  function openWhatsApp() {
    if (!selBooking?.phone) { alert("No phone number for selected booking"); return; }
    const ph = selBooking.phone.replace(/[^0-9]/g,"");
    const intl = ph.startsWith("0") ? "88"+ph : ph.startsWith("88")?ph:"88"+ph;
    window.open("https://wa.me/"+intl+"?text="+encodeURIComponent(previewMsg),"_blank");
  }

  const todayArrivals   = bookings.filter(b=>b.checkin===today&&b.status==="confirmed").length;
  const todayDepartures = bookings.filter(b=>b.checkout===today&&b.status!=="cancelled").length;
  const withBalance     = bookings.filter(b=>{const inv=b.invoiceTotal??b.amount;const pd=(b.paymentHistory||[]).reduce((s,p)=>s+p.amount,0);return Math.max(0,inv-pd)>0&&b.status!=="cancelled";}).length;

  return (
    <div style={{ padding:"22px 24px", maxWidth:1100, margin:"0 auto" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Marketing & Messaging</div>
        <div style={{ fontSize:12, color:"var(--text3)" }}>Send WhatsApp messages to guests using templates</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:22 }}>
        {[
          { label:"Today Arrivals",   value:todayArrivals,   icon:"ti-login",         color:"var(--green)" },
          { label:"Today Departures", value:todayDepartures, icon:"ti-logout",        color:"var(--gold2)" },
          { label:"With Balance Due", value:withBalance,     icon:"ti-alert-circle",  color:"var(--red)"   },
        ].map(m=>(
          <div key={m.label} className="panel" style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:10,background:m.color+"18",display:"flex",alignItems:"center",justifyContent:"center" }}>
              <i className={"ti "+m.icon} style={{ fontSize:20, color:m.color }} />
            </div>
            <div><div style={{ fontSize:11, color:"var(--text3)" }}>{m.label}</div><div style={{ fontSize:22, fontWeight:800, color:m.color }}>{m.value}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:10 }}>1. Choose Template</div>
          <div style={{ display:"flex", flex:"column", flexDirection:"column", gap:8, marginBottom:16 }}>
            {TEMPLATES.map(t=>(
              <div key={t.id} onClick={()=>{setSelTemplate(t);setCustomMsg("");}} style={{
                display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:9, cursor:"pointer",
                border:"1.5px solid "+(selTemplate.id===t.id?"var(--navy)":"var(--border)"),
                background:selTemplate.id===t.id?"#f0f4ff":"transparent", transition:"all .15s",
              }}>
                <i className={"ti "+t.icon} style={{ fontSize:18, color:selTemplate.id===t.id?"var(--navy)":"var(--text3)", flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{t.name}</div>
                  <div style={{ fontSize:11, color:"var(--text3)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.body.slice(0,60)}...</div>
                </div>
                <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:8,
                  background:(TAG_COLOR[t.tag]||"#888")+"18", color:TAG_COLOR[t.tag]||"#888", flexShrink:0 }}>
                  {t.tag}
                </span>
              </div>
            ))}
          </div>

          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8 }}>2. Select Guest</div>
          <div style={{ position:"relative", marginBottom:8 }}>
            <i className="ti ti-search" style={{ position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"var(--text3)",fontSize:13 }} />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest or room..." style={{ paddingLeft:30,width:"100%",boxSizing:"border-box",fontSize:12 }} />
          </div>
          <div style={{ maxHeight:220, overflowY:"auto", border:"1.5px solid var(--border)", borderRadius:9 }}>
            {filteredBookings.length===0&&<div style={{ color:"var(--text3)",fontSize:12,textAlign:"center",padding:14 }}>No bookings</div>}
            {filteredBookings.map(b=>{
              const inv=b.invoiceTotal??b.amount; const pd=(b.paymentHistory||[]).reduce((s,p)=>s+p.amount,0); const bal=Math.max(0,inv-pd);
              return (
                <div key={b.id} onClick={()=>setSelBooking(b)} style={{
                  display:"flex", alignItems:"center", gap:10, padding:"9px 12px", cursor:"pointer",
                  borderBottom:"1px solid var(--border)", fontSize:12,
                  background:selBooking?.id===b.id?"#f0f4ff":"transparent",
                }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.guest}</div>
                    <div style={{ fontSize:11, color:"var(--text3)" }}>Rm {b.room} · {b.phone}</div>
                  </div>
                  {bal>0&&<span style={{ fontSize:10,fontWeight:700,color:"var(--red)",flexShrink:0 }}>Due {money(bal)}</span>}
                  <span style={{ fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:6,
                    background:b.status==="checked-in"?"#dcfce7":b.status==="confirmed"?"#fffbee":"#f1f5f9",
                    color:b.status==="checked-in"?"#166534":b.status==="confirmed"?"#8a6200":"#475569", flexShrink:0 }}>
                    {b.status.replace("-"," ")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:10 }}>3. Preview & Send</div>
          <div className="panel" style={{ padding:14, marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", marginBottom:6, display:"flex", justifyContent:"space-between" }}>
              <span>Message Preview</span>
              {selBooking&&<span style={{ color:"var(--navy)" }}><i className="ti ti-user" /> {selBooking.guest}</span>}
            </div>
            <div style={{ background:"#dcfce7", borderRadius:12, borderBottomLeftRadius:2, padding:"12px 14px", fontSize:13, lineHeight:1.7, color:"#1a3324", minHeight:100, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
              {previewMsg}
            </div>
          </div>

          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", marginBottom:6 }}>Customize Message (optional)</div>
            <textarea value={customMsg} onChange={e=>setCustomMsg(e.target.value)} placeholder={"Edit message here...\\n\\nVariables: {guest} {room} {checkin} {checkout} {balance} {phone}"} rows={5}
              style={{ width:"100%", boxSizing:"border-box", resize:"vertical", fontSize:12, padding:10, borderRadius:8, border:"1.5px solid var(--border)", fontFamily:"inherit", lineHeight:1.6 }} />
          </div>

          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button className="btn sm" onClick={copyMsg} style={{ flex:"1 1 auto" }}>
              <i className={"ti "+(copied?"ti-check":"ti-copy")} style={{ color:copied?"var(--green)":undefined }} /> {copied?"Copied!":"Copy Text"}
            </button>
            <button className="btn primary sm" onClick={openWhatsApp} disabled={!selBooking} style={{ flex:"1 1 auto", opacity:selBooking?1:.5 }}>
              <i className="ti ti-brand-whatsapp" /> Send WhatsApp
            </button>
          </div>
          {!selBooking&&<div style={{ fontSize:11,color:"var(--text3)",textAlign:"center",marginTop:8 }}>Select a guest to enable WhatsApp send</div>}

          <div style={{ marginTop:18, padding:"12px 14px", background:"var(--panel)", borderRadius:9, fontSize:12 }}>
            <div style={{ fontWeight:700, marginBottom:6, color:"var(--text3)", fontSize:11, textTransform:"uppercase" }}>Available Variables</div>
            {["{guest}","  {room}","  {checkin}","  {checkout}","  {balance}","  {phone}"].map(v=>(
              <span key={v} style={{ display:"inline-block",margin:"3px 4px",padding:"2px 8px",borderRadius:6,background:"var(--navy)",color:"var(--gold)",fontSize:11,fontFamily:"monospace" }}>{v.trim()}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(path, code, 'utf8');
console.log('OK size=' + fs.statSync(path).size);
