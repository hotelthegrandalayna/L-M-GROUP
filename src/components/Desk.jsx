import { useState, useRef, useEffect, Fragment, useMemo } from "react";
import { useApp } from "../context/AppContext";
import useIsMobile from "../hall/useIsMobile";
import { todayStr, money, bookingConflicts, getRoomDisplayStatus, bookingCoversRoom, roomBookingWindow, maxId, formatDate } from "../utils/helpers";
import { buildInvoiceHTML, buildTCHtml, hotelPrint, roomLabel } from "./Invoice";
import { NewBookingModal, InvoicePreviewModal } from "./Bookings";
import { monthMoney } from "../lib/hotelMoney";
import { sendNtfyAlert } from "../utils/ntfy";
import { hotelBusinessOnly } from "../utils/expenseType";
import { pendingTasks, freqLabel } from "../utils/tasks";

function addDaysIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Custom date input: shows DD/MM/YYYY, opens native calendar on click
function DateDMY({ value, onChange, min, style }) {
  const ref = useRef();
  const display = value
    ? value.slice(8,10) + '/' + value.slice(5,7) + '/' + value.slice(0,4)
    : 'DD/MM/YYYY';
  return (
    <div style={{ position:'relative', ...style }}>
      <div
        onClick={() => { try { ref.current?.showPicker(); } catch { ref.current?.click(); } }}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
          background:'var(--bg2)', border:'1.5px solid var(--border)', borderRadius:8,
          padding:'8px 10px', cursor:'pointer', fontSize:14, fontWeight:600,
          color: value ? 'var(--text1)' : 'var(--text3)' }}>
        <span>{display}</span>
        <i className="ti ti-calendar" style={{ fontSize:16, color:'var(--text3)' }} />
      </div>
      <input ref={ref} type="date" value={value} min={min}
        onChange={e => onChange(e.target.value)}
        style={{ position:'absolute', opacity:0, top:0, left:0, width:'100%', height:'100%', pointerEvents:'none' }} />
    </div>
  );
}

import GuestSurveyOverlay from "./GuestSurveyOverlay";
import { persistHotelBookingBundle } from "../lib/hotelSupabase";

// ── Room status colours (bold, high-visibility) ────────────────────────────
const STATUS_STYLE = {
  occupied:    { label:"Occupied",    tint:"#FBD3D3", stripTx:"#8f2323", dot:"#E24B4A" },
  reserved:    { label:"Reserved",    tint:"#DAD4F8", stripTx:"#332b7a", dot:"#7F77DD" },
  vacant:      { label:"Vacant",      tint:"#D6EEC6", stripTx:"#356010", dot:"#5AA82F" },
  cleaning:    { label:"Cleaning",    tint:"#FAE4A6", stripTx:"#6b4600", dot:"#E0A400" },
  maintenance: { label:"Maintenance", tint:"#E3E6EB", stripTx:"#414855", dot:"#9CA3AF" },
};

// Elegant room cards: white body, a soft tinted status strip with a colour dot,
// a light guest name, a hairline divider, and a prominent amount. Subtle lift.
const ROOM_MAP_CSS = `
@keyframes rmAheadZoom { 0%,100%{ transform:scale(1); } 50%{ transform:scale(1.12); } }
.rm-card { position:relative; border-radius:14px; cursor:pointer; overflow:hidden;
  background:var(--panel,#fff); border:0.5px solid var(--border,#e6e6ec);
  box-shadow:0 4px 14px rgba(0,0,0,.09);
  transition:transform .14s cubic-bezier(.2,.7,.3,1), box-shadow .14s ease; will-change:transform; }
.rm-card:hover { transform:translateY(-3px); box-shadow:0 10px 24px rgba(0,0,0,.14); }
.rm-card:active { transform:translateY(0); box-shadow:0 3px 10px rgba(0,0,0,.10); }
.rm-ahead { animation:rmAheadZoom 1.6s ease-in-out infinite; display:inline-block; }
.rm-act { transition:transform .09s ease, box-shadow .09s ease; }
.rm-act:hover { filter:brightness(1.06); }
.rm-act:active { transform:translateY(3px); box-shadow:0 1px 0 var(--rm-act-sh), 0 2px 4px rgba(0,0,0,.16) !important; }
`;

// 3D tactile action button for the room popup — raised with a coloured under-edge
function actBtn(bg, edge) {
  return {
    display:"inline-flex", alignItems:"center", justifyContent:"center", gap:5,
    padding:"10px 14px", borderRadius:10, border:"none", cursor:"pointer",
    fontSize:12.5, fontWeight:800, color:"#fff", background:bg, fontFamily:"inherit",
    boxShadow:`0 4px 0 ${edge}, 0 6px 9px rgba(0,0,0,.18)`, ["--rm-act-sh"]:edge,
  };
}

function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.getDate() + " " + d.toLocaleDateString("en-GB", { month: "short" });
}

// Per-room money breakdown for a booking that covers more than one room.
// Handles BOTH shapes — `multiRooms` and primary + `extraRooms` — and treats every
// room equally (no "primary room" in the display). Returns [] for a single room.
function roomShares(b) {
  if (!b) return [];
  const nights = b.nights || 1;
  if (b.isMultiRoomBooking && (b.multiRooms || []).length) {
    return b.multiRooms.map(r => ({
      number: String(r.number),
      name: r.name || "",
      amount: r.amount ?? r.net ?? Math.max(0, (r.grossAmt ?? (r.rate || 0) * (r.nights || nights)) - (r.discAmt || 0)),
    }));
  }
  const extras = b.extraRooms || [];
  if (!extras.length) return [];
  const extrasDisc = extras.reduce((s, r) => s + (r.discAmt || 0), 0);
  const primaryDisc = Math.max(0, (b.discAmt || 0) - extrasDisc);
  const primaryGross = (b.roomRate || 0) * nights;
  const primaryNet = primaryGross > 0
    ? Math.max(0, primaryGross - primaryDisc)
    : Math.max(0, (b.invoiceTotal ?? b.amount ?? 0) - extras.reduce((s, r) => s + (r.amount || 0), 0));
  return [
    { number: String(b.room), name: b.roomName || "", amount: primaryNet },
    ...extras.map(r => ({
      number: String(r.number),
      name: r.name || "",
      amount: r.amount ?? Math.max(0, (r.grossAmt ?? (r.rate || 0) * nights) - (r.discAmt || 0)),
    })),
  ];
}

function getHotelDue(b) {
  if (!b) return 0;
  // invoiceTotal is always the net payable (discount already baked in at booking creation).
  // Do NOT subtract discAmt again — it would double-count the discount.
  const total = b.invoiceTotal ?? b.amount ?? 0;
  const paid  = (parseFloat(b.advance)||0) + (parseFloat(b.restPayment)||0) + (parseFloat(b.extrasAdvance)||0);
  return Math.max(0, total - paid);
}

function RoomModal({ room, onClose, onCheckout, onExtend, onCollect, onService, onInvoice, onNewBooking }) {
  const { curUser, curRole, bookings, updateBookings, revenues, updateRevenues, notify, setActiveTab, setPendingCompleteId } = useApp();
  const today = todayStr();

  // 30-day availability for THIS room — read-only, drives the strip
  const availStrip = (() => {
    const out = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(today + "T00:00:00"); d.setDate(d.getDate() + i);
      const ds = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const bk = bookings.find(b => (b.status === "checked-in" || b.status === "confirmed") && bookingCoversRoom(b, room.number)
        && (() => { const w = roomBookingWindow(b, room.number); return w.checkin <= ds && w.checkout > ds; })());
      out.push({ ds, dnum: d.getDate(), wd: d.toLocaleDateString("en-GB", { weekday: "narrow" }),
        state: bk ? (bk.status === "checked-in" ? "occupied" : "reserved") : "free", guest: bk?.guest || "" });
    }
    return out;
  })();
  const tmr = new Date(today + "T00:00:00");
  tmr.setDate(tmr.getDate() + 1);
  const d2  = new Date(today + "T00:00:00");
  d2.setDate(d2.getDate() + 2);
  const tmrIso = tmr.toISOString().split("T")[0];
  const d2Iso  = d2.toISOString().split("T")[0];
  const bIn  = bookings.find(b => b.status === "checked-in" && bookingCoversRoom(b, room.number) && roomBookingWindow(b, room.number).checkout >= today);
  const bRes = bookings.find(b => { if (b.status !== "confirmed" || !bookingCoversRoom(b, room.number)) return false; const w = roomBookingWindow(b, room.number); return w.checkin <= today && w.checkout > today; });
  const future = bookings.filter(b => b.status === "confirmed" && bookingCoversRoom(b, room.number) && roomBookingWindow(b, room.number).checkin > today).sort((a,b) => a.checkin > b.checkin ? 1 : -1);

  const [nm,  setNm]  = useState("");
  const [ph,  setPh]  = useState("");
  const [ci,  setCi]  = useState(bRes ? tmrIso : today);
  const [co,  setCo]  = useState(bRes ? d2Iso  : tmrIso);
  const [adv, setAdv] = useState("");
  const [acChoice, setAcChoice] = useState("AC");
  const [mtd, setMtd] = useState("Cash");
  const [txn, setTxn] = useState("");
  const [nt,  setNt]  = useState("");

  const isDual = !!(room.acRate && room.nonAcRate);
  const roomRate = isDual ? (acChoice==="AC" ? room.acRate : room.nonAcRate) : room.rate;

  function calcP() {
    if (!ci || !co || new Date(co) <= new Date(ci)) return null;
    const n = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    const t = n * roomRate;
    return { n, t, b: Math.max(0, t - (parseFloat(adv)||0)) };
  }

  function doRes() {
    if (!nm.trim()) { notify("Guest name required", "error"); return; }
    if (!ph.trim()) { notify("Mobile required", "error"); return; }
    if (!ci || !co || new Date(co) <= new Date(ci)) { notify("Check dates", "error"); return; }
    if (bookingConflicts(room.number, ci, co, null, bookings)) { notify("Already reserved for those dates", "error"); return; }
    const n = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    const amt = n * roomRate;
    const id  = maxId(bookings);
    const a   = parseFloat(adv)||0;
    const t   = ["bKash","Nagad"].includes(mtd) ? txn : "";
    const bk  = { id, guest: nm.trim(), phone: ph.trim(), room: room.number, type: room.type,
      checkin: ci, checkout: co, nights: n, amount: amt, advance: a,
      paymentHistory: a > 0 ? [{ ts: new Date().toISOString(), amount: a, method: mtd, txnNumber: t, note: "Reservation advance", type: "room", by: curUser || "staff" }] : [],
      paymentMethod: mtd, txnNumber: t, transactionNumber: t, restPayment: 0, dueAmount: Math.max(0, amt - a), status: "confirmed", notes: nt.trim(),
      acChoice: isDual ? acChoice : undefined, roomRate,
      source: "Walk-in", adults: 2, children: 0, nationality: "", discountType: "none",
      discountAmount: 0, createdAt: new Date().toISOString(), by: curUser || "staff" };
    updateBookings([...bookings, bk]);
    void persistHotelBookingBundle(bk)
      .then(({ guest, booking }) => {
        if (!booking) return;
        updateBookings((prev) =>
          prev.map((x) =>
            x.id === bk.id
              ? {
                  ...x,
                  guest_id: guest?.id ?? x.guest_id,
                  supabaseBookingId:
                    booking.id ?? x.supabaseBookingId ?? x.dbBookingId ?? null,
                  restPayment: booking.rest_payment ?? x.restPayment ?? 0,
                  dueAmount: booking.due_amount ?? x.dueAmount ?? 0,
                  transactionNumber:
                    booking.transaction_number ??
                    x.transactionNumber ??
                    x.txnNumber ??
                    "",
                  txnNumber:
                    booking.transaction_number ??
                    x.txnNumber ??
                    x.transactionNumber ??
                    "",
                }
              : x,
          ),
        );
      })
      .catch((err) => {
        console.error("Failed to sync desk reservation to Supabase:", err);
        notify("Reservation saved locally, but Supabase sync failed", "error");
      });
    if (a > 0) updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: a, date: today, note: nm.trim() + " Rm " + room.number + " - deposit (" + mtd + ")", bookingId: id }]);
    notify("Room " + room.number + " reserved for " + nm.trim() + (a > 0 ? " — Advance: " + money(a) : ""), "success");
    onClose();
  }

  function cancelRes(bid) {
    if (!window.confirm("Cancel this reservation?")) return;
    const b = bookings.find(x => x.id === bid);
    const cancelled = { ...b, status: "cancelled" };
    updateBookings(bookings.map(x => x.id === bid ? cancelled : x));
    updateRevenues(prev => prev.filter(r => r.bookingId !== bid && !(b && r.note && r.note.includes(b.guest) && r.note.includes("Rm "+b.room))));
    void persistHotelBookingBundle(cancelled).catch(err => console.error("Supabase cancelRes sync failed:", err));
    notify("Reservation cancelled and revenue reversed", "success"); onClose();
  }

  function chkOut(bid) {
    onCheckout(bid); // opens styled checkout modal in Desk
    onClose();
  }

  function FRow({ b }) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#fffbee", border:"1.5px solid #FCD34D", borderRadius:8, marginBottom:6 }}>
        <i className="ti ti-calendar-event" style={{ color:"#F59E0B", fontSize:15, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700 }}>{b.guest}</div>
          <div style={{ fontSize:11, color:"var(--text3)" }}>{formatDate(b.checkin)} to {formatDate(b.checkout)} | {b.nights}n | {money(b.amount)}</div>
        </div>
        {curRole === "admin" && <button className="btn sm danger" style={{ fontSize:10, padding:"4px 8px" }} onClick={() => cancelRes(b.id)}><i className="ti ti-x" /></button>}
      </div>
    );
  }

  // ⚠️ Called as {qrForm()} NOT <QRForm /> — avoids unmount-on-keystroke bug
  function qrForm() {
    const p = calcP();
    return (
      <div>
        {isDual && (
          <div className="form-group" style={{ marginBottom:12 }}>
            <label><i className="ti ti-wind" style={{ color:"var(--navy)", marginRight:4 }} />AC or Non-AC? *</label>
            <div style={{ display:"flex", gap:10, marginTop:4 }}>
              {["AC","Non-AC"].map(opt=>(
                <button key={opt} type="button" onClick={()=>setAcChoice(opt)} style={{
                  flex:1, padding:"10px 0", borderRadius:9, border:"2px solid", cursor:"pointer",
                  fontWeight:800, fontSize:13, fontFamily:"inherit", transition:"all .15s",
                  background: acChoice===opt?"var(--navy)":"var(--bg3)",
                  color:      acChoice===opt?"#fff":"var(--text2)",
                  borderColor: acChoice===opt?"var(--navy)":"var(--border)",
                }}>
                  {opt==="AC" ? "❄️ AC" : "🌬️ Non-AC"}
                  <div style={{ fontSize:10, fontWeight:600, opacity:.8, marginTop:2 }}>
                    ৳{opt==="AC" ? room.acRate.toLocaleString() : room.nonAcRate.toLocaleString()}/night
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="form-row">
          <div className="form-group">
            <label>Guest Name *</label>
            <input value={nm} onChange={e => setNm(e.target.value)} placeholder="Full name" autoComplete="off" />
          </div>
          <div className="form-group">
            <label>Mobile *</label>
            <input value={ph} onChange={e => setPh(e.target.value)} placeholder="+880..." autoComplete="off" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Check-in *</label><input type="date" lang="en-GB" value={ci} min={today} onChange={e=>{ setCi(e.target.value); setCo(addDaysIso(e.target.value,1)); }} /></div>
          <div className="form-group"><label>Check-out *</label><input type="date" lang="en-GB" value={co} min={ci ? addDaysIso(ci,1) : addDaysIso(today,1)} onChange={e=>setCo(e.target.value)} /></div>
        </div>
        <div style={{ background:"var(--navy)", color:"#fff", borderRadius:8, padding:"11px 14px", textAlign:"center", fontSize:13, marginBottom:12, minHeight:48, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {p ? (
            <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"8px 20px", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:10, opacity:.65 }}>{p.n} night{p.n > 1 ? "s" : ""} x {money(roomRate)}{isDual?" ("+acChoice+")":""}</div>
                <div style={{ fontSize:18, fontWeight:800, color:"var(--gold2)" }}>{money(p.t)}</div>
              </div>
              {parseFloat(adv) > 0 && <>
                <div style={{ borderLeft:"1px solid rgba(255,255,255,.2)", paddingLeft:20 }}>
                  <div style={{ fontSize:10, opacity:.65 }}>Advance</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#6de8a8" }}>-{money(parseFloat(adv)||0)}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, opacity:.65 }}>Balance Due</div>
                  <div style={{ fontSize:18, fontWeight:800, color:p.b > 0 ? "#f5a0a0" : "#6de8a8" }}>{money(p.b)}</div>
                </div>
              </>}
            </div>
          ) : <span style={{ opacity:.6, fontSize:12 }}>Select valid dates</span>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Advance (BDT)</label>
            <input type="number" value={adv} min="0" placeholder="0" onChange={e => setAdv(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Payment Method</label>
            <select value={mtd} onChange={e => setMtd(e.target.value)}>
              {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {["bKash","Nagad"].includes(mtd) && (
          <div className="form-group">
            <label>Transaction Number</label>
            <input value={txn} onChange={e => setTxn(e.target.value)} placeholder="01X-XXXXXXXXXX" />
          </div>
        )}
        <div className="form-group">
          <label>Notes</label>
          <input value={nt} onChange={e => setNt(e.target.value)} placeholder="Special requests..." />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="ti ti-building" style={{ color:"var(--gold)" }} /> Room {room.number}{room.name ? " — " + room.name : ""}</div>
            <div className="modal-sub">{room.type} — {money(room.rate)}/night</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {/* Availability — next 30 days for this room */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.4, marginBottom:6 }}>Availability — next 30 days</div>
          <div style={{ display:"flex", gap:3, overflowX:"auto", paddingBottom:4 }}>
            {availStrip.map(dd => {
              const cell = dd.state === "occupied" ? { bg:"#E24B4A", fg:"#fff" }
                         : dd.state === "reserved" ? { bg:"#7F77DD", fg:"#fff" }
                         : { bg:"#fff", fg:"var(--text3)" };
              return (
                <div key={dd.ds} title={dd.state === "free" ? "Free" : (dd.state + " · " + dd.guest)}
                  style={{ minWidth:30, flexShrink:0, textAlign:"center", padding:"4px 0", borderRadius:7, fontSize:11,
                    background:cell.bg, color:cell.fg,
                    border: dd.ds === today ? "2px solid var(--navy)" : (dd.state === "free" ? "0.5px solid var(--border)" : "0.5px solid transparent") }}>
                  <div style={{ fontSize:8, opacity:.75 }}>{dd.wd}</div>
                  <div style={{ fontWeight:700 }}>{dd.dnum}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:12, fontSize:10, color:"var(--text3)", marginTop:5 }}>
            <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:3, background:"#E24B4A", verticalAlign:"-1px" }} /> occupied</span>
            <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:3, background:"#7F77DD", verticalAlign:"-1px" }} /> reserved</span>
            <span><span style={{ display:"inline-block", width:10, height:10, borderRadius:3, background:"#fff", border:"0.5px solid var(--border)", verticalAlign:"-1px" }} /> free</span>
          </div>
        </div>

        {bIn && (() => {
          const extSum = (bIn.extensions || []).reduce((s, e) => s + (e.amount || 0), 0);
          const extNights = (bIn.extensions || []).reduce((s, e) => s + (e.nights || 0), 0);
          const totalNow = bIn.invoiceTotal ?? bIn.amount ?? 0;
          const origTotal = Math.max(0, totalNow - extSum);
          const paidNow = (parseFloat(bIn.advance)||0) + (parseFloat(bIn.restPayment)||0) + (parseFloat(bIn.extrasAdvance)||0);
          const dueNow = getHotelDue(bIn);
          return (
          <div style={{ background:"var(--green-bg)", border:"1.5px solid var(--green-bd)", borderRadius:9, padding:13, marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--green)", textTransform:"uppercase", marginBottom:10 }}>Currently Checked In</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, fontSize:12 }}>
              {[["Guest",bIn.guest],["Phone",bIn.phone],["Check-in",formatDate(bIn.checkin)],["Check-out",formatDate(bIn.checkout)],["Nights",bIn.nights]].map(([l,v]) => (
                <div key={l}><div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>{l}</div><strong>{v}</strong></div>
              ))}
            </div>
            <div style={{ background:"#fff", borderRadius:8, padding:"9px 11px", marginTop:11 }}>
              {(() => {
                const shares = roomShares(bIn);
                if (shares.length < 2) return null;
                return (
                  <div style={{ marginBottom:7, paddingBottom:7, borderBottom:"1px dashed var(--border)" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.6, marginBottom:5 }}>
                      This booking covers {shares.length} rooms
                    </div>
                    {shares.map(s => (
                      <div key={s.number} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"2px 0" }}>
                        <span style={{ color: String(s.number) === String(room.number) ? "var(--navy)" : "var(--text2)", fontWeight: String(s.number) === String(room.number) ? 700 : 400 }}>
                          Room {s.number}{s.name ? " — " + s.name : ""}{String(s.number) === String(room.number) ? " (this room)" : ""}
                        </span>
                        <span style={{ fontWeight:700 }}>{money(s.amount)}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"4px 0 0", marginTop:3, borderTop:"1px solid var(--border)" }}>
                      <span style={{ color:"var(--text3)" }}>Together</span>
                      <span style={{ fontWeight:800 }}>{money(shares.reduce((s, r) => s + r.amount, 0))}</span>
                    </div>
                  </div>
                );
              })()}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"2px 0" }}><span style={{ color:"var(--text3)" }}>{extSum > 0 ? "Original stay" : "Room total"}</span><span style={{ fontWeight:700 }}>{money(origTotal)}</span></div>
              {extSum > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"2px 0", color:"#332b7a" }}><span>Extended +{extNights} night{extNights>1?"s":""}</span><span style={{ fontWeight:700 }}>+{money(extSum)}</span></div>}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"5px 0 2px", marginTop:3, borderTop:"1px solid var(--border)", fontWeight:800 }}><span>Total</span><span>{money(totalNow)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginTop:4 }}>
                <span style={{ color:"#137a3f" }}>Paid {money(paidNow)}</span>
                {dueNow > 0 ? <span style={{ color:"#b02a2a", fontWeight:700 }}>Due {money(dueNow)}</span> : <span style={{ color:"#137a3f", fontWeight:700 }}>Fully paid ✓</span>}
              </div>
            </div>
          </div>
          );
        })()}
        {bIn && (<>
          {future.length > 0 && <><div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Upcoming Reservations</div>{future.map(b => <FRow key={b.id} b={b} />)}</>}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginTop:14 }}>
            {getHotelDue(bIn) > 0 && <button className="rm-act" style={actBtn("#c0392b","#7a1e14")} onClick={() => onCollect && onCollect(bIn)}><i className="ti ti-cash" /> Collect {money(getHotelDue(bIn))}</button>}
            <button className="rm-act" style={actBtn("#4a2ea8","#2c1a6b")} onClick={() => onExtend && onExtend(bIn)}><i className="ti ti-calendar-plus" /> Extend stay</button>
            <button className="rm-act" style={actBtn("#b07800","#6b4900")} onClick={() => onService && onService(bIn)}><i className="ti ti-sparkles" /> Add service</button>
            <button className="rm-act" style={actBtn("#1a5a8a","#0e3554")} onClick={() => onInvoice && onInvoice(bIn)}><i className="ti ti-file-invoice" /> Invoice</button>
            <button className="rm-act" style={{ ...actBtn("#7a1a1a","#470d0d"), gridColumn:"1/-1" }} onClick={() => chkOut(bIn.id)}><i className="ti ti-logout" /> Check out</button>
            <button className="rm-act" style={{ ...actBtn("#1a7040","#0d3d22"), gridColumn:"1/-1" }} onClick={() => onNewBooking && onNewBooking({ room: room.number, ci: bIn.checkout, co: addDaysIso(bIn.checkout, 1), acChoice: isDual ? acChoice : undefined })}><i className="ti ti-calendar-plus" /> Reserve future dates for room {room.number}</button>
          </div>
        </>)}

        {!bIn && bRes && (<>
          <div style={{ background:"#fffbee", border:"2px solid var(--gold)", borderRadius:9, padding:14, marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#8a6200", textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}><i className="ti ti-calendar-check" /> Reserved — Awaiting Check-In</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, fontSize:12, marginBottom:10 }}>
              {[["Guest",bRes.guest],["Mobile",bRes.phone],["Check-in",bRes.checkin],["Check-out",bRes.checkout],["Nights",bRes.nights],["Total",money(bRes.invoiceTotal??bRes.amount)],["Advance Paid",money(bRes.advance||0)],["Balance Due",money(getHotelDue(bRes))]].map(([l,v]) => (
                <div key={l}><div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>{l}</div><strong>{v}</strong></div>
              ))}
            </div>
            {bRes.notes && <div style={{ fontSize:11, color:"var(--text3)", paddingTop:6, borderTop:"1px solid rgba(201,168,76,.2)" }}>{bRes.notes}</div>}
            <button className="btn primary" style={{ width:"100%", marginTop:12, background:"#1a7040", border:"none", fontWeight:800 }}
              onClick={() => { setPendingCompleteId(bRes.id); setActiveTab("bookings"); onClose(); }}>
              <i className="ti ti-login" /> Complete Check-In (add remaining details)
            </button>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginTop:9 }}>
              {getHotelDue(bRes) > 0 && <button className="rm-act" style={actBtn("#c0392b","#7a1e14")} onClick={() => onCollect && onCollect(bRes)}><i className="ti ti-cash" /> Collect {money(getHotelDue(bRes))}</button>}
              <button className="rm-act" style={{ ...actBtn("#1a5a8a","#0e3554"), gridColumn:getHotelDue(bRes) > 0 ? "auto" : "1/-1" }} onClick={() => onInvoice && onInvoice(bRes)}><i className="ti ti-file-invoice" /> Invoice</button>
            </div>
          </div>
          {future.length > 0 && <><div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Other Upcoming</div>{future.map(b => <FRow key={b.id} b={b} />)}</>}
          <div style={{ borderTop:"1px dashed var(--border)", margin:"12px 0 10px" }} />
          <button className="rm-act" style={{ ...actBtn("#1a7040","#0d3d22"), width:"100%", padding:"12px" }}
            onClick={() => onNewBooking && onNewBooking({ room: room.number, ci: bRes.checkout, co: addDaysIso(bRes.checkout, 1), acChoice: isDual ? acChoice : undefined })}>
            <i className="ti ti-calendar-plus" /> Reserve future dates for room {room.number}
          </button>
          <div className="modal-actions" style={{ marginTop:12 }}>
            {curRole === "admin" && <button className="btn danger" style={{ marginRight:"auto" }} onClick={() => cancelRes(bRes.id)}><i className="ti ti-calendar-x" /> Cancel Current</button>}
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </>)}

        {!bIn && !bRes && (<>
          {future.length > 0 && <><div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Upcoming Reservations</div>{future.map(b => <FRow key={b.id} b={b} />)}<div style={{ borderTop:"1px dashed var(--border)", margin:"12px 0 10px" }} /></>}
          <div style={{ fontSize:12, color:"var(--text3)", marginBottom:10 }}>This room is free. Book or reserve it — the full booking form opens with room {room.number} already selected.</div>
          <button className="rm-act" style={{ ...actBtn("#1a7040","#0d3d22"), width:"100%", padding:"13px" }}
            onClick={() => onNewBooking && onNewBooking({ room: room.number, ci: today, co: addDaysIso(today, 1), acChoice: isDual ? acChoice : undefined })}>
            <i className="ti ti-calendar-plus" /> New booking / reserve room {room.number}
          </button>
          <div className="modal-actions" style={{ marginTop:12 }}>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Checkout Confirmation Modal ────────────────────────────────────────────
function CheckoutModal({ b, onConfirm, onClose }) {
  const out = getHotelDue(b);
  const hasBal = out > 0;

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:480 }}>
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-logout" style={{ color:"#C62828" }} /> Check Out — Rm {b.room}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {/* Guest summary */}
        <div style={{ background:"var(--bg3)", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontSize:13 }}>
          {[["Guest",b.guest],["Phone",b.phone||"—"],["Check-in",b.checkin],["Check-out",b.checkout],["Nights",b.nights],["Room Rate",money(b.amount)]].map(([l,v])=>(
            <div key={l}><div style={{ fontSize:10, color:"var(--text3)", marginBottom:2, fontWeight:700, textTransform:"uppercase" }}>{l}</div><strong>{v}</strong></div>
          ))}
        </div>

        {/* Balance alert */}
        {hasBal ? (
          <div style={{ background:"#FFF0F0", border:"2.5px solid #C62828", borderRadius:12, padding:"18px 20px", marginBottom:18, textAlign:"center" }}>
            <div style={{ fontSize:13, fontWeight:800, color:"#C62828", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize:18, marginRight:6 }} />Outstanding Balance
            </div>
            <div style={{ fontSize:42, fontWeight:900, color:"#C62828", lineHeight:1, marginBottom:6 }}>{money(out)}</div>
            <div style={{ fontSize:12, color:"#7a1a1a" }}>Please collect this amount before checking out the guest.</div>
          </div>
        ) : (
          <div style={{ background:"var(--green-bg)", border:"2px solid var(--green-bd)", borderRadius:12, padding:"14px 20px", marginBottom:18, textAlign:"center" }}>
            <i className="ti ti-circle-check" style={{ fontSize:28, color:"var(--green)", display:"block", marginBottom:6 }} />
            <div style={{ fontSize:14, fontWeight:800, color:"var(--green)" }}>All Paid — No Balance Due</div>
          </div>
        )}

        <div className="modal-actions" style={{ gap:10 }}>
          <button className="btn" onClick={onClose}>Cancel</button>

          <button onClick={() => onConfirm(b.id, hasBal)} style={{ padding:"10px 22px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:800, fontSize:14, fontFamily:"inherit",
            background:"linear-gradient(135deg,#C62828,#7a1a1a)", color:"#fff", boxShadow:"0 3px 14px rgba(198,40,40,.4)" }}>
            <i className="ti ti-logout" /> {hasBal ? "Collect & Check Out" : "Confirm Check Out"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Post-Checkout Options Modal ────────────────────────────────────────────
function PostCheckoutModal({ booking, onSurvey, onClose }) {
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:440 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">🌟 Checkout Complete</div>
            <div className="modal-sub">{booking.guest} · Room {booking.room}</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:18 }}>

          {/* Survey option — highlighted */}
          <div onClick={onSurvey} style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", background:"linear-gradient(135deg,#fef9e7,#fdf6d3)", border:"2px solid var(--gold)", borderRadius:12, cursor:"pointer" }}>
            <div style={{ fontSize:26, flexShrink:0 }}>⭐</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, fontSize:14, color:"var(--navy)" }}>Guest Survey — Turn Screen to Guest</div>
              <div style={{ fontSize:12, color:"var(--text2)", marginTop:2 }}>Full-screen star rating. Guest taps stars. Auto-saves to Insights.</div>
            </div>
            <i className="ti ti-chevron-right" style={{ color:"var(--gold2)", fontSize:16 }} />
          </div>

          {/* Google Review */}
          <a href="https://g.page/r/review" target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", background:"#fff", border:"1.5px solid #dadce0", borderRadius:12, textDecoration:"none", color:"#1a1a1a", cursor:"pointer" }}>
            <svg width="20" height="20" viewBox="0 0 48 48" style={{ flexShrink:0 }}><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.32-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.68 28.18A13.9 13.9 0 0 1 10.8 24c0-1.45.25-2.86.68-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.86.92 7.52 2.56 10.74l7.12-5.56z"/><path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.26l7.34 5.7C13.42 13.62 18.27 9.75 24 9.75z"/></svg>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13 }}>Leave a Google Review</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>Help others find Hotel The Grand Alayna</div>
            </div>
            <i className="ti ti-external-link" style={{ color:"#4285F4", fontSize:14 }} />
          </a>

          {/* Facebook */}
          <a href="https://facebook.com/hotelthegrandalayna" target="_blank" rel="noreferrer" style={{ display:"flex", alignItems:"center", gap:12, padding:"13px 16px", background:"#fff", border:"1.5px solid #dadce0", borderRadius:12, textDecoration:"none", color:"#1a1a1a", cursor:"pointer" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2" style={{ flexShrink:0 }}><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13 }}>Like Our Facebook Page</div>
              <div style={{ fontSize:11, color:"var(--text3)" }}>Follow us for special offers &amp; updates</div>
            </div>
            <i className="ti ti-external-link" style={{ color:"#1877F2", fontSize:14 }} />
          </a>
        </div>

        <button onClick={onClose} style={{ width:"100%", padding:"10px 0", borderRadius:9, border:"none", background:"var(--navy)", color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ── Desk Invoice Preview Modal ─────────────────────────────────────────────
function DeskInvoiceModal({ booking, rooms, onClose, onPrint, onPrintTC }) {
  const html = buildInvoiceHTML(booking, rooms, booking.invoiceExtras || [], "room");
  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && onClose()} style={{ zIndex:9999 }}>
      <div style={{ background:"#fff", borderRadius:12, width:"96vw", maxWidth:820,
        maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,.22)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 18px", background:"var(--navy)", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
          <span style={{ color:"#fff", fontWeight:800, fontSize:14 }}>
            <i className="ti ti-file-invoice" style={{ marginRight:7, color:"var(--gold)" }} />
            Invoice — {booking.guest} · {roomLabel(booking)}
          </span>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onPrint} style={{ background:"var(--gold)", color:"var(--navy)", border:"none",
              borderRadius:8, padding:"7px 18px", fontWeight:800, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-printer" /> Print
            </button>
            <button onClick={onPrintTC} style={{ background:"rgba(255,255,255,.15)", color:"#fff", border:"1px solid rgba(255,255,255,.3)",
              borderRadius:8, padding:"7px 14px", fontWeight:700, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-printer" /> Print + T&amp;C
            </button>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", color:"#fff",
              border:"none", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontSize:16 }}>
              <i className="ti ti-x" />
            </button>
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:20 }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ── Collect Payment Modal (from Desk) ─────────────────────────────────────
function DeskCollectPayModal({ booking, onConfirm, onClose }) {
  const [amt, setAmt] = useState("");
  const [mtd, setMtd] = useState("Cash");
  const [txn, setTxn] = useState("");
  const [note, setNote] = useState("");
  const due = getHotelDue(booking);
  const needsTxn = ["bKash","Nagad"].includes(mtd);
  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && onClose()} style={{ zIndex:9999 }}>
      <div className="modal-box" style={{ maxWidth:400 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color:"#c0392b" }}>
            <i className="ti ti-currency-taka" /> Collect Payment — {booking.guest}
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div style={{ background:"#fff5f5", border:"1.5px solid #f5c6c6", borderRadius:9, padding:"11px 14px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--text2)", marginBottom:4 }}>
            <span>Total invoice</span><span style={{ fontWeight:700 }}>{money(booking.invoiceTotal ?? booking.amount ?? 0)}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--green)" }}>
            <span>Already paid</span><span style={{ fontWeight:700 }}>-{money((booking.advance||0)+(booking.restPayment||0)+(booking.extrasAdvance||0))}</span>
          </div>
          <div style={{ borderTop:"1px solid #f5c6c6", marginTop:8, paddingTop:8, display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:800, color:"#c0392b" }}>
            <span>Balance due</span><span>{money(due)}</span>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Amount (৳)</label>
            <input type="number" value={amt} min={1} onChange={e=>setAmt(e.target.value)} placeholder={String(due)} autoFocus />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Method</label>
            <select value={mtd} onChange={e=>{setMtd(e.target.value);setTxn("");}}>
              {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {needsTxn && (
          <div className="form-group" style={{ marginBottom:10 }}>
            <label style={{ color:"#c0392b" }}>Transaction No. *</label>
            <input value={txn} onChange={e=>setTxn(e.target.value)} placeholder="e.g. TrxID from bKash" />
          </div>
        )}
        <div className="form-group" style={{ marginBottom:14 }}>
          <label>Note (optional)</label>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. balance settled" />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button onClick={() => { if(needsTxn&&!txn.trim()){return;} onConfirm(parseFloat(amt)||0,mtd,txn,note); }}
            style={{ padding:"9px 22px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:800, fontSize:14, fontFamily:"inherit",
              background:"#1a7040", color:"#fff" }}>
            <i className="ti ti-check" /> Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Service Modal (from Desk) ─────────────────────────────────────────
function DeskServiceModal({ booking, onConfirm, onClose }) {
  const [desc, setDesc] = useState("");
  const [amt, setAmt]   = useState("");
  const [date, setDate] = useState(todayStr());
  const currentDue = getHotelDue(booking);
  const newCharge  = parseFloat(amt) > 0 ? parseFloat(amt) : 0;
  const totalPaid  = (booking.advance||0) + (booking.restPayment||0) + (booking.extrasAdvance||0);
  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && onClose()} style={{ zIndex:9999 }}>
      <div className="modal-box" style={{ maxWidth:400 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color:"#b07800" }}>
            <i className="ti ti-sparkles" /> Add Service Charge — {booking.guest}
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div style={{ background:"#fffbf0", border:"1.5px solid #e8c96a", borderRadius:9, padding:"11px 14px", marginBottom:14, fontSize:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", color:"var(--text2)", marginBottom:3 }}>
            <span>Room invoice total</span><span style={{ fontWeight:700 }}>{money(booking.invoiceTotal ?? booking.amount ?? 0)}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", color:"var(--green)", marginBottom:3 }}>
            <span>Already paid</span><span style={{ fontWeight:700 }}>-{money(totalPaid)}</span>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", color:"#b07800", borderTop:"1px solid #e8c96a", paddingTop:6, marginTop:4 }}>
            <span>Current balance due</span><span style={{ fontWeight:800 }}>{money(currentDue)}</span>
          </div>
          {newCharge > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between", color:"#c0392b", borderTop:"1px solid #e8c96a", paddingTop:6, marginTop:4, fontWeight:800 }}>
              <span>After this charge</span><span>{money(currentDue + newCharge)}</span>
            </div>
          )}
        </div>
        <div className="form-group"><label>Description *</label>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Restaurant, Laundry, Room service" autoFocus />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div className="form-group" style={{ marginBottom:0 }}><label>Amount (৳) *</label>
            <input type="number" value={amt} min={1} onChange={e=>setAmt(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}><label>Date</label>
            <DateDMY value={date} onChange={v => setDate(v)} />
          </div>
        </div>
        <div className="modal-actions" style={{ marginTop:16 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button onClick={() => { if(!desc.trim()||!(parseFloat(amt)>0)) return; onConfirm(desc.trim(),parseFloat(amt),date); }}
            style={{ padding:"9px 22px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:800, fontSize:14, fontFamily:"inherit",
              background:"#b07800", color:"#fff" }}>
            <i className="ti ti-plus" /> Add to Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Extend Stay Modal ─────────────────────────────────────────────────────
const CLEAN_CHECKLIST = [
  "Bed made / linen changed",
  "Toilet cleaned",
  "Floor cleaned",
  "TV and surfaces wiped",
  "Fresh towels placed",
  "Water bottles placed",
];

function CleaningModal({ room, info, onConfirm, onClose }) {
  const [checked, setChecked] = useState(() => CLEAN_CHECKLIST.map(() => false));
  const allDone = checked.every(Boolean);
  const toggle = i => setChecked(prev => prev.map((v, j) => j === i ? !v : v));
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="ti ti-spray" style={{ color:"#CA8A04" }} /> Clean Room {room.number}</div>
            <div className="modal-sub">{info?.guest ? `Left by ${info.guest}` : "Awaiting cleaning"} — tick each item</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div style={{ padding:"4px 2px 10px" }}>
          {CLEAN_CHECKLIST.map((item, i) => (
            <label key={i} onClick={()=>toggle(i)} style={{ display:"flex", alignItems:"center", gap:11, padding:"11px 12px", border:"1.5px solid "+(checked[i]?"#86EFB0":"var(--border)"), background:checked[i]?"#F0FBF2":"transparent", borderRadius:10, marginBottom:8, cursor:"pointer" }}>
              <span style={{ width:22, height:22, borderRadius:6, border:"2px solid "+(checked[i]?"#1B7A33":"#bbb"), background:checked[i]?"#1B7A33":"#fff", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:14, fontWeight:900 }}>{checked[i]?"✓":""}</span>
              <span style={{ fontSize:14, fontWeight:600, color:checked[i]?"#1a5c2a":"var(--text2)" }}>{item}</span>
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!allDone}
            onClick={() => allDone && onConfirm(CLEAN_CHECKLIST.filter((_,i)=>checked[i]))}
            style={{ background: allDone ? "#1a7040" : "#9ca3af", borderColor:"transparent", cursor: allDone?"pointer":"not-allowed" }}>
            <i className="ti ti-circle-check" /> {allDone ? "Confirm Room Cleaned" : "Tick all items"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExtendStayModal({ booking, rooms, onConfirm, onClose }) {
  const [newCheckout, setNewCheckout] = useState(() => addDaysIso(booking.checkout, 1));
  const [discType,   setDiscType]     = useState("none");
  const [discVal,    setDiscVal]      = useState("");
  const [advance,    setAdvance]      = useState("");
  const [method,     setMethod]       = useState("Cash");
  const [txn,        setTxn]          = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [acChoice,   setAcChoice]     = useState(booking.acChoice || "AC");

  const roomNumber = booking.room;
  const selectedRoom = rooms.find(r => r.number === roomNumber);
  const hasNonAc = selectedRoom && selectedRoom.nonAcRate > 0;
  const rate = selectedRoom
    ? (acChoice === "Non-AC" && selectedRoom.nonAcRate ? selectedRoom.nonAcRate : (selectedRoom.acRate || selectedRoom.rate || 0))
    : (booking.roomRate || booking.amount / (booking.nights || 1));

  const extraNights = (() => {
    if (!newCheckout || newCheckout <= booking.checkout) return 0;
    return Math.round((new Date(newCheckout) - new Date(booking.checkout)) / 86400000);
  })();

  const subtotal  = extraNights * rate;
  const discAmt   = discType === "pct" ? subtotal * (parseFloat(discVal) || 0) / 100
                  : discType === "fixed" ? parseFloat(discVal) || 0 : 0;
  const extTotal  = Math.max(0, subtotal - discAmt);
  const adv       = parseFloat(advance) || 0;
  const needsTxn  = ["bKash","Nagad"].includes(method);
  const canPreview = extraNights > 0 && !(needsTxn && adv > 0 && !txn.trim());

  // Build what the booking will look like after extension — for preview only
  const previewBooking = {
    ...booking,
    checkout: newCheckout,
    nights: (booking.nights || 0) + extraNights,
    invoiceTotal: (booking.invoiceTotal ?? booking.amount ?? 0) + extTotal,
    discAmt: (booking.discAmt || 0) + discAmt,
    restPayment: (booking.restPayment || 0) + adv,
    paymentHistory: adv > 0
      ? [...(booking.paymentHistory || []), { ts: new Date().toISOString(), amount: adv, method, txnNumber: txn || "", note: `Extend stay +${extraNights} night${extraNights > 1 ? "s" : ""}`, type: "room" }]
      : (booking.paymentHistory || []),
  };

  if (showPreview) {
    const previewHTML = buildInvoiceHTML(previewBooking, rooms, booking.invoiceExtras || [], "room");
    return (
      <div className="modal-overlay open" style={{ zIndex:10000 }}>
        <div className="modal-box" style={{ maxWidth:860, padding:0, overflow:"hidden" }}>
          <div style={{ background:"#1a1a2e", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ color:"#C9A84C", fontWeight:800, fontSize:16 }}>
                <i className="ti ti-file-invoice" /> Invoice Preview — {booking.guest} · Rm {booking.room}
              </div>
              <div style={{ color:"rgba(255,255,255,.6)", fontSize:12, marginTop:2 }}>
                Extended to {newCheckout} · +{extraNights} night{extraNights > 1 ? "s" : ""} · ৳{extTotal.toLocaleString()}
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" onClick={() => setShowPreview(false)} style={{ fontSize:13 }}>
                <i className="ti ti-edit" /> Edit
              </button>
              <button onClick={() => onConfirm({ newCheckout, extTotal, discAmt, advance: adv, method, txn, acChoice })}
                style={{ padding:"9px 20px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:800, fontSize:13, fontFamily:"inherit", background:"#4a2ea8", color:"#fff", display:"flex", alignItems:"center", gap:6 }}>
                <i className="ti ti-calendar-plus" /> Confirm Extension
              </button>
            </div>
          </div>
          <div style={{ maxHeight:"75vh", overflowY:"auto", background:"#fafaf8" }}>
            <div dangerouslySetInnerHTML={{ __html: previewHTML }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && onClose()} style={{ zIndex:9999 }}>
      <div className="modal-box" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ color:"#4a2ea8" }}>
              <i className="ti ti-calendar-plus" /> Extend Stay — {booking.guest}
            </div>
            <div className="modal-sub">Rm {booking.room} · Currently checking out {booking.checkout}</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {/* New checkout */}
        <div className="form-row">
          <div className="form-group">
            <label>New Check-out Date *</label>
            <DateDMY value={newCheckout} min={addDaysIso(booking.checkout, 1)}
              onChange={v => setNewCheckout(v)} />
          </div>
          <div className="form-group">
            <label>Additional Nights</label>
            <input readOnly value={extraNights > 0 ? extraNights + " night" + (extraNights > 1 ? "s" : "") : "—"} style={{ background:"var(--bg3)", color:"var(--text2)" }} />
          </div>
        </div>

        {/* Pricing summary */}
        <div style={{ background:"#f0ebff", border:"1.5px solid #c4b5f4", borderRadius:10, padding:"12px 14px", marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--text2)", marginBottom:4 }}>
            <span>{extraNights} night{extraNights !== 1 ? "s" : ""} × ৳{rate.toLocaleString()}</span>
            <span style={{ fontWeight:700 }}>৳{subtotal.toLocaleString()}</span>
          </div>
          {discAmt > 0 && (
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, color:"var(--green)", marginBottom:4 }}>
              <span>Discount</span><span>−৳{discAmt.toLocaleString()}</span>
            </div>
          )}
          <div style={{ borderTop:"1px solid #c4b5f4", paddingTop:8, marginTop:4, display:"flex", justifyContent:"space-between", fontSize:15, fontWeight:800, color:"#4a2ea8" }}>
            <span>Extension Total</span><span>৳{extTotal.toLocaleString()}</span>
          </div>
        </div>

        {/* AC / Non-AC toggle */}
        {hasNonAc && (
          <div style={{ display:"flex", gap:0, borderRadius:8, overflow:"hidden", border:"1.5px solid #4a2ea8", marginBottom:12 }}>
            {["AC","Non-AC"].map(opt => (
              <button key={opt} type="button" onClick={() => setAcChoice(opt)}
                style={{ flex:1, padding:"9px 6px", fontWeight:800, fontSize:13, cursor:"pointer", border:"none",
                  borderRight: opt==="AC" ? "1.5px solid #4a2ea8" : "none",
                  background: acChoice===opt ? "#4a2ea8" : "#f3eeff",
                  color: acChoice===opt ? "#fff" : "#4a2ea8" }}>
                {opt === "AC" ? "❄️ AC" : "🌬️ Non-AC"}
              </button>
            ))}
          </div>
        )}

        {/* Discount */}
        <div className="form-row">
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Discount</label>
            <select value={discType} onChange={e => { setDiscType(e.target.value); setDiscVal(""); }}>
              <option value="none">No discount</option>
              <option value="pct">Percentage (%)</option>
              <option value="fixed">Fixed amount (৳)</option>
            </select>
          </div>
          {discType !== "none" && (
            <div className="form-group" style={{ marginBottom:0 }}>
              <label>{discType === "pct" ? "Discount %" : "Amount (৳)"}</label>
              <input type="number" value={discVal} min={0} onChange={e => setDiscVal(e.target.value)}
                placeholder={discType === "pct" ? "e.g. 10" : "e.g. 500"} />
            </div>
          )}
        </div>

        <div style={{ height:12 }} />

        {/* Advance */}
        <div className="form-row">
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Collect Advance (৳)</label>
            <input type="number" value={advance} min={0} onChange={e => setAdvance(e.target.value)} placeholder="0 (optional)" />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Payment Method</label>
            <select value={method} onChange={e => { setMethod(e.target.value); setTxn(""); }}>
              {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {needsTxn && (
          <div className="form-group" style={{ marginTop:10 }}>
            <label style={{ color:"#4a2ea8" }}>Transaction No. *</label>
            <input value={txn} onChange={e => setTxn(e.target.value)} placeholder="Transaction ID" />
          </div>
        )}

        <div className="modal-actions" style={{ marginTop:16 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            disabled={!canPreview}
            onClick={() => canPreview && setShowPreview(true)}
            style={{ padding:"9px 22px", borderRadius:8, border:"none", cursor: canPreview ? "pointer" : "not-allowed",
              fontWeight:800, fontSize:14, fontFamily:"inherit",
              background: canPreview ? "#4a2ea8" : "#ccc", color:"#fff" }}>
            <i className="ti ti-eye" /> Preview & Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Check-In Preview Modal (Option A flow) ────────────────────────────────
function CheckInPreviewModal({ booking, rooms, onConfirm, onEdit, onClose }) {
  const html = buildInvoiceHTML(booking, rooms, [], "room");
  const tcEnabled = localStorage.getItem("ga_tc_enabled") !== "false";
  const willPrintTC = tcEnabled && !booking.tcPrinted;
  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && onClose()} style={{ zIndex:9999 }}>
      <div style={{ background:"#fff", borderRadius:14, width:"96vw", maxWidth:860,
        maxHeight:"94vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 10px 48px rgba(0,0,0,.28)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 20px", background:"var(--navy)" }}>
          <div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>
              <i className="ti ti-login" style={{ marginRight:8, color:"var(--gold)" }} />
              Check-In Preview — {booking.guest} · Rm {booking.room}
            </div>
            <div style={{ color:"rgba(255,255,255,.6)", fontSize:12, marginTop:2 }}>
              Review invoice before confirming check-in
              {willPrintTC && <span style={{ marginLeft:8, background:"rgba(255,255,255,.15)", borderRadius:6, padding:"2px 8px", fontSize:11 }}>T&C will print on first check-in</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onEdit} style={{ background:"rgba(255,255,255,.15)", color:"#fff", border:"1.5px solid rgba(255,255,255,.3)",
              borderRadius:8, padding:"7px 16px", fontWeight:700, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-edit" /> Edit / Go Back
            </button>
            <button onClick={onConfirm} style={{ background:"var(--gold)", color:"var(--navy)", border:"none",
              borderRadius:8, padding:"8px 20px", fontWeight:800, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-login" /> Confirm Check-In & Print
            </button>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", color:"#fff",
              border:"none", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontSize:16 }}>
              <i className="ti ti-x" />
            </button>
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:20 }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

function EditReservationModal({ booking, rooms, bookings, onClose, onSave }) {
  const isMulti = !!(booking.isMultiRoomBooking && (booking.multiRooms || []).length);
  const [newCi, setNewCi] = useState(booking.checkin);
  const [newCo, setNewCo] = useState(booking.checkout);
  const [newRoom, setNewRoom] = useState(String(booking.room || ""));

  const nights = newCi && newCo && new Date(newCo) > new Date(newCi)
    ? Math.round((new Date(newCo) - new Date(newCi)) / 86400000) : 0;

  // Rooms available for the chosen dates (single-room only). Always include the current room.
  const availRooms = rooms.filter(r =>
    String(r.number) === String(booking.room) ||
    !bookingConflicts(r.number, newCi, newCo, booking.id, bookings));

  // Live conflict flag for the currently chosen room/dates
  const conflict = isMulti
    ? booking.multiRooms.some(mr => bookingConflicts(mr.number, newCi, newCo, booking.id, bookings))
    : bookingConflicts(newRoom || booking.room, newCi, newCo, booking.id, bookings);

  const log = booking.changeLog || [];

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex:10001 }}>
      <div className="modal-box" style={{ maxWidth:540, padding:0, overflow:"hidden" }}>
        <div style={{ background:"var(--navy)", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:"#fff", fontWeight:800, fontSize:15 }}>
            <i className="ti ti-edit" style={{ marginRight:8, color:"var(--gold)" }} />
            Edit Reservation — {booking.guest} · Rm {booking.room}
          </span>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", color:"#fff", border:"none", borderRadius:8, padding:"6px 11px", cursor:"pointer", fontSize:16 }}><i className="ti ti-x" /></button>
        </div>

        <div style={{ padding:"18px 20px", maxHeight:"72vh", overflowY:"auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:"var(--text3)", display:"block", marginBottom:5 }}>Check-in</label>
              <DateDMY value={newCi} min={todayStr()} onChange={v => { setNewCi(v); if (new Date(newCo) <= new Date(v)) setNewCo(addDaysIso(v, 1)); }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:700, color:"var(--text3)", display:"block", marginBottom:5 }}>Check-out</label>
              <DateDMY value={newCo} min={addDaysIso(newCi, 1)} onChange={setNewCo} />
            </div>
          </div>

          {!isMulti ? (
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"var(--text3)", display:"block", marginBottom:5 }}>Room <span style={{ color:"var(--green)", fontWeight:600 }}>— only available rooms shown</span></label>
              <select value={newRoom} onChange={e => setNewRoom(e.target.value)}
                style={{ width:"100%", padding:"9px 10px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:14, fontWeight:700, background:"var(--bg2)" }}>
                {availRooms.map(r => (
                  <option key={r.number} value={r.number}>{r.number}{r.name ? " — " + r.name : ""} · {r.type}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginBottom:14, fontSize:12, color:"var(--text3)", background:"var(--bg3)", borderRadius:8, padding:"9px 12px" }}>
              Multi-room reservation ({booking.multiRooms.map(m => m.number).join(", ")}) — dates apply to all rooms. Room numbers can't be swapped here.
            </div>
          )}

          <div style={{ fontSize:12.5, color:"var(--text2)", marginBottom:14 }}>
            <strong>{nights || "—"}</strong> night{nights === 1 ? "" : "s"} · new stay {newCi.split("-").reverse().join("/")} → {newCo.split("-").reverse().join("/")}
          </div>

          {conflict && (
            <div style={{ background:"#fff1f2", border:"1.5px solid #f04444", borderRadius:9, padding:"9px 13px", marginBottom:14, color:"#a11", fontSize:12.5, fontWeight:700, display:"flex", alignItems:"center", gap:7 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize:17 }} /> That room isn't available for the selected dates. Pick another room or dates.
            </div>
          )}

          {log.length > 0 && (
            <div style={{ borderTop:"1px dashed var(--border)", paddingTop:12, marginBottom:6 }}>
              <div style={{ fontSize:10.5, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", letterSpacing:1, marginBottom:7 }}>
                <i className="ti ti-history" style={{ marginRight:5 }} />Change History
              </div>
              {log.slice().reverse().map((c, i) => (
                <div key={i} style={{ fontSize:11.5, color:"var(--text2)", padding:"3px 0", display:"flex", gap:6 }}>
                  <span style={{ color:"var(--text3)", minWidth:64 }}>{formatDate(c.at)}</span>
                  <span><strong>{c.field}:</strong> {c.field.includes("date") || c.field.includes("heck") ? formatDate(c.from) + " → " + formatDate(c.to) : c.from + " → " + c.to} <span style={{ color:"var(--text3)" }}>· by {c.by}</span></span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:10, padding:"14px 20px", borderTop:"1px solid var(--border)", background:"var(--bg2)" }}>
          <button onClick={onClose} style={{ flex:"0 0 auto", padding:"10px 18px", borderRadius:8, border:"1.5px solid var(--border)", background:"transparent", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
          <button disabled={!nights || conflict} onClick={() => onSave({ newCi, newCo, newRoom })}
            style={{ flex:1, padding:"10px 18px", borderRadius:8, border:"none", cursor: (!nights || conflict) ? "not-allowed" : "pointer", opacity: (!nights || conflict) ? .5 : 1, fontWeight:800, fontFamily:"inherit", background:"#1a7040", color:"#fff", fontSize:14 }}>
            <i className="ti ti-device-floppy" style={{ marginRight:6 }} />Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Desk() {
  const { curRole, curUser, rooms, bookings, revenues, expenses, expTypes, tasks, taskDone, setTaskDone, dirtyRooms, setDirtyRooms, cleaningLog, setCleaningLog, updateBookings, updateRevenues, notify, setActiveTab, setPendingInvoiceId } = useApp();
  const isMobile = useIsMobile();
  const [sel, setSel] = useState(null);
  const [newBooking, setNewBooking] = useState(null);          // prefill for the full New Booking form
  const [confirmRes, setConfirmRes] = useState(null);          // reservation to open as invoice for check-in confirmation
  const [completeBooking, setCompleteBooking] = useState(null); // reservation being completed (prefilled form)
  const [editResTarget, setEditResTarget] = useState(null);    // reservation being edited (dates / room)
  const [pnlDate, setPnlDate] = useState(() => todayStr());    // which day the P&L panel shows
  const [pnlRevOpen, setPnlRevOpen] = useState(false);         // revenue breakdown expanded
  const [pnlExpOpen, setPnlExpOpen] = useState(false);         // expenses breakdown expanded
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [postCheckout, setPostCheckout] = useState(null);
  const [surveyBooking, setSurveyBooking] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);        // booking id of expanded in-house row
  const [invoiceTarget, setInvoiceTarget] = useState(null);    // booking to show invoice for
  const [collectTarget, setCollectTarget] = useState(null);    // booking to collect payment for
  const [serviceTarget, setServiceTarget] = useState(null);    // booking to add service to
  const [checkinPreview, setCheckinPreview] = useState(null);  // booking preview before check-in
  const [extendTarget, setExtendTarget] = useState(null);      // booking to extend stay for
  const [cleanTarget, setCleanTarget] = useState(null);        // room to clean (checklist)
  const [showRevDetail, setShowRevDetail] = useState(false);
  const today = todayStr();

  // Bangladesh Standard Time = UTC+6. Checkout alert fires after 12:00 PM BST.
  const isPast12pmBST = (() => {
    const nowUTC = new Date();
    const bstHour = (nowUTC.getUTCHours() + 6) % 24;
    return bstHour >= 12;
  })();

  // Guests whose checkout date has arrived but are still checked-in (overdue checkouts)
  const overdueCheckouts = bookings.filter(b =>
    b.status === "checked-in" &&
    b.checkout <= today &&
    isPast12pmBST
  );

  // Classify a payment into a plain revenue type for the P&L breakdown
  function revKind(note, type, status) {
    const n = (note || "").toLowerCase();
    if (/extend/.test(n)) return "Extension";
    if (type === "service" || /service|restaurant|extra service/.test(n)) return "Service";
    if (/check-in/.test(n)) return "Balance at check-in";
    if (/advance/.test(n)) return status === "confirmed" ? "Reservation deposit" : "New booking advance";
    if (/balance|rest|collect/.test(n)) return "Balance collected";
    return "Payment";
  }

  // Derive revenue from booking paymentHistory (same as Admin Finance) — avoids test/orphan entries
  const bookingRevEntries = useMemo(() => {
    const entries = [];
    bookings.forEach(b => {
      if (b.status === "cancelled") return;
      const history = b.paymentHistory || [];
      if (history.length > 0) {
        history.forEach(p => {
          const date = p.ts ? p.ts.split("T")[0] : b.checkin;
          entries.push({ date, amount: parseFloat(p.amount) || 0, bookingId: b.id, room: b.room,
            method: p.method || "Cash", kind: revKind(p.note, p.type, b.status),
            note: `${p.note||p.type||"payment"} (${p.method||"Cash"})` });
        });
      } else {
        const totalPaid = (parseFloat(b.advance)||0) + (parseFloat(b.restPayment)||0) + (parseFloat(b.extrasAdvance)||0);
        if (totalPaid > 0) entries.push({ date: b.checkin, amount: totalPaid, bookingId: b.id, room: b.room,
          method: b.paymentMethod || "Cash", kind: b.status === "confirmed" ? "Reservation deposit" : "New booking advance",
          note: `advance payment (${b.paymentMethod||"Cash"})` });
      }
    });
    return entries;
  }, [bookings]);
  const manualRevEntries = revenues.filter(r => !r.bookingId && !r.fromBooking);
  const allRevEntries = [...bookingRevEntries, ...manualRevEntries];

  // Profit/cost figures count only business expenses — non-business transfers
  // (owner withdrawal, bank transfer, etc.) never reduce profit
  const bizExpenses = hotelBusinessOnly(expenses, expTypes || {});
  const dRev  = allRevEntries.filter(r => r.date === today).reduce((s,r) => s+r.amount, 0);
  const dExp  = bizExpenses.filter(e => e.date === today).reduce((s,e) => s+e.amount, 0);
  const thisMonth = today.slice(0, 7); // "YYYY-MM"
  const tRev  = allRevEntries.reduce((s,r) => s+r.amount, 0);
  const tExp  = bizExpenses.reduce((s,e) => s+e.amount, 0);
  // Month figures from the shared source of truth (check-in / stay basis) so the
  // Desk KPIs match Admin Invoices, Admin Finance and Expenses & Cash exactly.
  const mMoney = monthMoney({ bookings, revenues, expenses: bizExpenses, month: thisMonth });
  const mRev  = mMoney.collected;
  const mExp  = mMoney.expenses;
  const inhouse    = bookings.filter(b => b.status === "checked-in");
  const arrivals   = bookings.filter(b => b.checkin === today && (b.status === "confirmed" || b.status === "checked-in"));
  const departures = bookings.filter(b => b.checkout === today && b.status === "checked-in");
  const extensions = bookings.filter(b => (b.extensions || []).some(e => e.at === today));
  const tomorrowStr = addDaysIso(today, 1);
  const upcoming   = bookings
    .filter(b => b.status === "confirmed" && b.checkin > today)
    .sort((a, b) => a.checkin < b.checkin ? -1 : a.checkin > b.checkin ? 1 : 0);
  const toConfirm  = upcoming.filter(b => b.checkin === tomorrowStr); // arriving tomorrow — call to confirm
  // Every room number in a booking (multi-room bookings expand to all their rooms)
  const roomsOf = (b) => b.multiRooms && b.multiRooms.length
    ? b.multiRooms.map(m => String(m.number))
    : [String(b.room), ...((b.extraRooms || []).map(r => String(r.number)))];
  const pendingT   = pendingTasks(tasks, taskDone, today);
  function quickDoneTask(task, due) {
    setTaskDone(prev => ({ ...prev, [`${task.id}_${due}`]: { by: curUser || "staff", at: new Date().toISOString(), hasPhoto: false } }));
    notify(`"${task.title}" marked done ✓`, "success");
  }
  const occ = rooms.filter(r => getRoomDisplayStatus(r, bookings, today) === "occupied").length;
  const occPct = rooms.length ? Math.round(occ/rooms.length*100) : 0;

  const pendingBal = bookings.filter(b => ["confirmed","checked-in"].includes(b.status)).map(b => {
    const due = getHotelDue(b);
    return { ...b, due };
  }).filter(b => b.due > 0).sort((a,b) => b.due - a.due);

  // Collect payment from Desk
  function handleCollectPayment(b, amt, mtd, txn, note) {
    if (amt <= 0) { notify("Enter a valid amount","error"); return; }
    const entry = { ts:new Date().toISOString(), amount:amt, method:mtd, txnNumber:txn||"", note:note||"", type:"room", by:curUser||"staff" };
    const updated = { ...b,
      restPayment: (b.restPayment||0) + amt,
      dueAmount: Math.max(0, getHotelDue(b) - amt),
      paymentHistory: [...(b.paymentHistory||[]), entry],
    };
    updateBookings(prev => prev.map(x => x.id===b.id ? updated : x));
    updateRevenues(prev => [...prev, { id:maxId(prev), source:"Room Rent", amount:amt, date:today, note:b.guest+" Rm "+b.room+" - payment ("+mtd+")", bookingId:b.id }]);
    void persistHotelBookingBundle(updated).catch(()=>{});
    notify("Payment of "+money(amt)+" recorded","success");
    setCollectTarget(null);
    setExpandedRow(null);
  }

  // Add service charge from Desk
  function handleAddService(b, desc, amt, date) {
    const newExtra = { desc, qty:1, rate:amt, date };
    const extras = [...(b.invoiceExtras||[]), newExtra];
    const newTotal = (b.invoiceTotal ?? b.amount ?? 0) + amt;
    const newDue = getHotelDue(b) + amt;
    const updated = { ...b, invoiceExtras: extras, invoiceTotal: newTotal, dueAmount: newDue };
    updateBookings(prev => prev.map(x => x.id===b.id ? updated : x));
    void persistHotelBookingBundle(updated).catch(()=>{});
    notify("Service charge added to invoice","success");
    setServiceTarget(null);
  }

  // Extend stay from Desk popup
  function handleExtendStay(b, { newCheckout, extTotal, discAmt: extDiscAmt, advance, method, txn, acChoice }) {
    const extraNights = Math.round((new Date(newCheckout) - new Date(b.checkout)) / 86400000);
    const totalNights = (b.nights || 0) + extraNights;

    const extPayEntry = advance > 0 ? [{
      ts: new Date().toISOString(), amount: advance, method, txnNumber: txn||"",
      note: `Extend stay +${extraNights} night${extraNights>1?"s":""}`, type: "room", by: curUser||"staff",
    }] : [];
    const origTotal = b.invoiceTotal ?? b.amount ?? 0;
    const updated = {
      ...b,
      checkout: newCheckout,
      nights: totalNights,
      invoiceTotal: origTotal + extTotal,
      discAmt: (b.discAmt || 0) + (extDiscAmt || 0),
      ...(acChoice ? { acChoice } : {}),
      restPayment: (b.restPayment || 0) + advance,
      paymentHistory: [...(b.paymentHistory||[]), ...extPayEntry],
      // Track each extension so the room popup can show original → extension → total
      extensions: [...(b.extensions || []), { nights: extraNights, amount: extTotal, from: b.checkout, to: newCheckout, at: today }],
    };

    updateBookings(prev => prev.map(x => x.id === b.id ? updated : x));
    if (advance > 0) {
      updateRevenues(prev => [...prev, {
        id: maxId(prev), source: "Room Rent", amount: advance, date: today,
        note: b.guest + " Rm " + b.room + " - extension advance (" + method + ")", bookingId: b.id,
      }]);
    }
    void persistHotelBookingBundle(updated).catch(() => {});
    sendNtfyAlert(
      `STAY EXTENDED — ${b.guest}`,
      `${b.guest}\nRoom ${b.room}\n\nNew Check-out: ${newCheckout}\nExtra Nights: ${extraNights}\nExtension Total: ৳${extTotal.toLocaleString()}${advance > 0 ? `\nCollected: ৳${advance.toLocaleString()} (${method})` : ""}`,
      undefined,
      { tags: "orange_circle", priority: "default" }
    ).catch(() => {});
    notify(b.guest + " extended to " + newCheckout + (advance > 0 ? " · Advance ৳" + advance.toLocaleString() : ""), "success");
    setExtendTarget(null);
    setExpandedRow(null);
  }

  // Edit a reservation's dates / room (managers + admins). Only saves if the target room is free.
  function handleEditReservation(b, { newCi, newCo, newRoom }) {
    const isMulti = !!(b.isMultiRoomBooking && (b.multiRooms || []).length);
    const nights = Math.max(1, Math.round((new Date(newCo) - new Date(newCi)) / 86400000));
    const changes = [];
    const stamp = { at: today, by: curUser || "staff", ts: new Date().toISOString() };

    // Conflict checks (exclude this booking itself)
    if (isMulti) {
      for (const mr of b.multiRooms) {
        if (bookingConflicts(mr.number, newCi, newCo, b.id, bookings)) {
          notify(`Room ${mr.number} is not available for ${newCi.split("-").reverse().join("/")}–${newCo.split("-").reverse().join("/")}`, "error");
          return false;
        }
      }
    } else {
      const roomNum = newRoom || b.room;
      if (bookingConflicts(roomNum, newCi, newCo, b.id, bookings)) {
        notify(`Room ${roomNum} is not available for those dates`, "error");
        return false;
      }
    }

    // Build change log entries
    if (b.checkin !== newCi)  changes.push({ ...stamp, field: "Check-in",  from: b.checkin, to: newCi });
    if (b.checkout !== newCo) changes.push({ ...stamp, field: "Check-out", from: b.checkout, to: newCo });
    if (!isMulti && newRoom && String(newRoom) !== String(b.room))
      changes.push({ ...stamp, field: "Room", from: String(b.room), to: String(newRoom) });

    if (!changes.length) { notify("No changes made", "info"); return false; }

    let updated;
    if (isMulti) {
      // Shift every room to the new common window; recompute each room's net from its own rate
      const newRooms = b.multiRooms.map(mr => {
        const r = rooms.find(x => String(x.number) === String(mr.number)) || {};
        const dual = !!(r.acRate && r.nonAcRate);
        const rate = dual ? (mr.acChoice === "AC" ? r.acRate : r.nonAcRate) : (r.rate || mr.rate || 0);
        const gross = nights * rate;
        const disc = Math.min(parseFloat(mr.discAmt) || 0, gross);
        return { ...mr, checkin: newCi, checkout: newCo, rate, amount: Math.max(0, gross - disc) };
      });
      const newTotal = newRooms.reduce((s, r) => s + (r.amount || 0), 0);
      updated = { ...b, checkin: newCi, checkout: newCo, nights, multiRooms: newRooms,
        amount: newTotal, invoiceTotal: newTotal,
        changeLog: [...(b.changeLog || []), ...changes] };
    } else {
      const roomNum = newRoom || b.room;
      const r = rooms.find(x => String(x.number) === String(roomNum)) || {};
      const dual = !!(r.acRate && r.nonAcRate);
      const rate = dual ? (b.acChoice === "AC" ? r.acRate : r.nonAcRate) : (r.rate || b.roomRate || 0);
      const gross = nights * rate;
      const disc = Math.min(b.discAmt || 0, gross);
      const newTotal = Math.max(0, gross - disc) + (b.extraPersonCharge?.total || 0);
      updated = { ...b, checkin: newCi, checkout: newCo, nights,
        room: String(roomNum), type: r.type || b.type, roomRate: rate,
        baseAmount: gross, amount: newTotal, invoiceTotal: newTotal,
        dueAmount: Math.max(0, newTotal - (parseFloat(b.advance) || 0)),
        changeLog: [...(b.changeLog || []), ...changes] };
    }

    updateBookings(prev => prev.map(x => x.id === b.id ? updated : x));
    void persistHotelBookingBundle(updated).catch(() => {});
    notify("Reservation updated · " + changes.map(c => c.field).join(", ") + " changed", "success");
    setEditResTarget(null);
    setConfirmRes(null);
    return true;
  }

  // Print invoice from Desk
  function handlePrintInvoice(b) {
    const invHtml = buildInvoiceHTML(b, rooms, b.invoiceExtras||[], "room");
    hotelPrint(invHtml, null);
  }

  // Print invoice + T&C (force reprint T&C regardless of tcPrinted flag)
  function handlePrintWithTC(b) {
    const invHtml = buildInvoiceHTML(b, rooms, b.invoiceExtras||[], "room");
    hotelPrint(invHtml, buildTCHtml(b));
  }

  // Check-in: show preview first (Option A)
  function initiateCheckin(b) {
    setCheckinPreview(b);
    setSel(null);
  }

  // Confirm check-in after preview — sets status, prints invoice + T&C if first time
  function confirmCheckin(b) {
    const tcEnabled = localStorage.getItem("ga_tc_enabled") !== "false";
    const willPrintTC = tcEnabled && !b.tcPrinted;
    const updated = { ...b, status:"checked-in", tcPrinted: willPrintTC ? true : (b.tcPrinted || false) };
    updateBookings(prev => prev.map(x => x.id===b.id ? updated : x));
    void persistHotelBookingBundle(updated).catch(()=>{});
    const invHtml = buildInvoiceHTML(updated, rooms, [], "room");
    const tcHtml  = willPrintTC ? buildTCHtml(updated) : null;
    hotelPrint(invHtml, tcHtml);
    notify(b.guest+" checked in ✓"+(willPrintTC?" — T&C printed":""),"success");
    setCheckinPreview(null);
  }

  // Navigate to Invoice tab for extend stay
  function goToInvoiceTab(b) {
    setPendingInvoiceId(b.id);
    setActiveTab("invoice");
    setExpandedRow(null);
  }

  // Open the styled checkout confirmation modal instead of window.confirm
  function chkOut(bid) {
    const b = bookings.find(x => x.id === bid); if (!b) return;
    setCheckoutTarget(b);
    setSel(null); // close room modal if open
  }

  // Called from the CleaningModal when a room's checklist is confirmed
  function markRoomClean(room, checklist) {
    const rn = String(room.number);
    const info = (dirtyRooms || {})[rn] || {};
    setDirtyRooms(prev => { const next = { ...prev }; delete next[rn]; return next; });
    setCleaningLog(prev => [...(prev || []), {
      room: rn, guest: info.guest || "", by: curUser || "staff",
      at: new Date().toISOString(), checklist,
    }]);
    notify(`Room ${rn} marked clean ✓ — now available`, "success");
    setCleanTarget(null);
  }

  // Called from CheckoutModal when staff confirms
  function doCheckout(bid, collectBalance) {
    const b = bookings.find(x => x.id === bid); if (!b) return;
    const out = getHotelDue(b);
    if (collectBalance && out > 0)
      updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: out, date: today, note: b.guest + " Rm " + b.room + " - collected at checkout", bookingId: bid }]);
    const updatedBooking = {
      ...b,
      status: "checked-out",
      restPayment: (parseFloat(b.restPayment) || 0) + (collectBalance ? out : 0),
      dueAmount: collectBalance ? 0 : getHotelDue(b),
    };
    updateBookings(bookings.map(x => x.id === bid ? updatedBooking : x));
    // Mark the room(s) as needing cleaning — turns them yellow until confirmed clean
    const roomsToClean = b.isMultiRoomBooking && b.multiRooms?.length
      ? b.multiRooms.map(r => String(r.number))
      : [String(b.room), ...((b.extraRooms||[]).map(r => String(r.number)))];
    setDirtyRooms(prev => {
      const next = { ...prev };
      roomsToClean.forEach(rn => { if (rn) next[rn] = { since: today, guest: b.guest, bookingId: b.id }; });
      return next;
    });
    void persistHotelBookingBundle(updatedBooking).catch((err) => {
      console.error("Failed to sync checkout to Supabase:", err);
      notify("Checkout saved on this device — cloud sync failed: " + (err?.message || "connection issue") + ". It will retry automatically.", "error");
    });
    sendNtfyAlert(
      `CHECK-OUT — ${b.guest}`,
      `${b.guest}\nRoom ${b.room}\n\nCheck-in: ${b.checkin}\nCheck-out: ${today}\nTotal: ৳${((b.invoiceTotal ?? b.amount) || 0).toLocaleString()}${collectBalance && out > 0 ? `\nCollected at checkout: ৳${out.toLocaleString()}` : ""}`,
      undefined,
      { tags: "red_circle", priority: "high" }
    ).catch(() => {});
    notify(b.guest + " checked out successfully", "success");
    setCheckoutTarget(null);
    setPostCheckout(b); // show post-checkout options (survey / review)
  }

  function GuestRow({ b, showIn, showOut }) {
    // Compact, stacked layout so it stays tidy in the narrow half-width panels:
    // row 1 = room chip + guest name (truncated); row 2 = phone · nights + action
    return (
      <div style={{ padding:"7px 10px", borderBottom:"1px solid var(--border)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:24, height:24, borderRadius:6, background:"var(--navy)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontSize:10, fontWeight:800, color:"var(--gold2)" }}>{b.room}</span>
          </div>
          <div style={{ flex:1, minWidth:0, fontWeight:700, fontSize:12, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.guest}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:6, marginTop:5, paddingLeft:31 }}>
          <span style={{ fontSize:10, color:"var(--text3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.phone} · {b.nights}n</span>
          {showIn  && <button className="btn sm primary" style={{ fontSize:11, padding:"3px 10px", flexShrink:0 }} onClick={() => initiateCheckin(b)}><i className="ti ti-login" /> In</button>}
          {showOut && <button className="btn sm gold"    style={{ fontSize:11, padding:"3px 10px", flexShrink:0 }} onClick={() => chkOut(b.id)}><i className="ti ti-logout" /> Out</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"14px 20px 18px", boxSizing:"border-box" }}>

      {/* ── Overdue Checkout Alert ── */}
      {overdueCheckouts.length > 0 && (
        <div style={{
          background:"#c0392b", borderRadius:12, padding:"14px 18px",
          marginBottom:14, border:"3px solid #922b21",
          boxShadow:"0 4px 20px rgba(192,57,43,.4)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <span style={{ fontSize:22 }}>🚨</span>
            <div>
              <div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>
                CHECKOUT OVERDUE — {overdueCheckouts.length} guest{overdueCheckouts.length>1?"s":""} must check out now!
              </div>
              <div style={{ color:"rgba(255,255,255,.8)", fontSize:12, marginTop:2 }}>
                It is past 12:00 PM Bangladesh time. The following guest{overdueCheckouts.length>1?"s have":""} has not been checked out.
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {overdueCheckouts.map(b => (
              <div key={b.id} style={{
                background:"rgba(0,0,0,.25)", borderRadius:8,
                padding:"10px 14px", display:"flex", alignItems:"center", gap:12,
              }}>
                <div style={{ background:"#fff", borderRadius:6, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontWeight:900, fontSize:13, color:"#c0392b" }}>{b.room}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#fff", fontWeight:700, fontSize:13 }}>{b.guest}</div>
                  <div style={{ color:"rgba(255,255,255,.7)", fontSize:11 }}>
                    📅 Checkout: {formatDate(b.checkout)} · {b.phone}
                    {b.extraRooms?.length > 0 && ` · Also Rm ${b.extraRooms.map(r=>r.number).join(", ")}`}
                  </div>
                </div>
                <button
                  onClick={() => chkOut(b.id)}
                  style={{
                    background:"#fff", color:"#c0392b", border:"none", borderRadius:8,
                    padding:"8px 16px", fontWeight:800, fontSize:13, cursor:"pointer",
                    fontFamily:"inherit", flexShrink:0,
                  }}>
                  ✓ Check Out Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stat bar ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(2,1fr)" : (curRole==="admin" ? "repeat(6,1fr)" : "repeat(4,1fr)"), gap:6, marginBottom:14 }}>
        {[
          { label:"Occupancy",    value:occPct+"%",           sub:occ+" of "+rooms.length+" rooms", icon:"ti-percentage",    color:"var(--navy)" },
          { label:"In-House",     value:inhouse.length,       sub:"guests staying",                  icon:"ti-users",         color:"#5b3fa0" },
          { label:"Today Revenue",value:money(dRev),          sub:"tap to see breakdown",             icon:"ti-currency-taka", color:"var(--gold2)", onClick:()=>setShowRevDetail(true) },
          curRole==="admin"
            ? { label:"This Month Revenue", value:money(mRev), sub:"month to date",                 icon:"ti-currency-taka", color:"var(--gold2)" }
            : { label:"Pending Balance", value:pendingBal.length, sub:"guests with balance due",    icon:"ti-alert-circle",  color:pendingBal.length>0?"var(--red2)":"var(--green)" },
          ...(curRole==="admin" ? [
            { label:"This Month Cost",   value:money(mExp),     sub:"month to date",                icon:"ti-receipt",       color:"var(--red2)" },
            { label:"This Month Profit", value:money(mRev-mExp), sub:"month to date",               icon:"ti-trending-up",   color:(mRev-mExp)>=0?"var(--green)":"var(--red2)" },
          ] : []),
        ].map(s => {
          const vc = /Revenue|Profit/.test(s.label) ? "var(--green)" : /Cost|Balance/.test(s.label) ? "var(--red2)" : "var(--text)";
          return (
          <div key={s.label} onClick={s.onClick} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:"11px 13px", cursor:s.onClick?"pointer":"default" }}>
            <div style={{ fontSize:9, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:.7 }}>{s.label}</div>
            <div style={{ fontSize:(curRole==="admin"&&!isMobile)?16:18, fontWeight:600, color:vc, lineHeight:1.15, marginTop:3, fontVariantNumeric:"tabular-nums" }}>{s.value}</div>
            <div style={{ fontSize:9, color:"var(--text3)", marginTop:2 }}>{s.sub}</div>
          </div>
          );
        })}
      </div>

      {/* ── Front-desk strip: the common tabs, side by side, right above the room map ── */}
      <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap:8, marginBottom:14, alignItems:"stretch" }}>
        {[
          { title:"Today's Arrivals",   icon:"ti-login",         list:arrivals,   color:"var(--green)", bg:"var(--green-bg)" },
          { title:"Today's Departures", icon:"ti-logout",        list:departures, color:"var(--red2)",  bg:"var(--red-bg)" },
          { title:"Today's Extensions", icon:"ti-calendar-plus", list:extensions, color:"#7a4dd6",      bg:"#efe9fb" },
        ].map(sec => (
          <div className="panel" key={sec.title} style={{ margin:0, border:"1px solid var(--border)", borderRadius:12 }}>
            <div className="panel-header" style={{ padding:"11px 13px" }}>
              <div className="panel-title" style={{ fontSize:12, gap:8, minWidth:0, flex:1, alignItems:"center" }}>
                <span style={{ width:24, height:24, borderRadius:7, background:sec.bg, display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><i className={"ti "+sec.icon} style={{ color:sec.color, fontSize:14 }} /></span>
                <span style={{ fontWeight:600, fontSize:10.5, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{sec.title}</span>
                <span style={{ marginLeft:"auto", flexShrink:0, background:sec.bg, color:sec.color, fontWeight:600, fontSize:10.5, padding:"1px 8px", borderRadius:20 }}>{sec.list.reduce((n,b)=>n+roomsOf(b).length,0)}</span>
              </div>
            </div>
            {sec.list.length ? (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"4px 13px 12px" }}>
                {sec.list.flatMap(b => roomsOf(b).map(rm => (
                  <span key={b.id+"-"+rm} style={{ minWidth:36, textAlign:"center", background:"var(--bg2)", color:sec.color, border:"1px solid "+sec.color, borderRadius:8, padding:"5px 10px", fontWeight:600, fontSize:14, lineHeight:1, fontVariantNumeric:"tabular-nums" }}>{rm}</span>
                )))}
              </div>
            ) : (
              <div style={{ color:"var(--text3)", fontSize:11.5, textAlign:"center", padding:"6px 4px 14px" }}>None today</div>
            )}
          </div>
        ))}

        {/* Upcoming Reservations — room + arrival date; call-to-confirm folded in */}
        <div className="panel" style={{ margin:0, borderRadius:12, border:"1px solid "+(toConfirm.length ? "var(--gold2)" : "var(--border)") }}>
          <div className="panel-header" style={{ padding:"11px 13px" }}>
            <div className="panel-title" style={{ fontSize:12, gap:8, minWidth:0, flex:1, alignItems:"center" }}>
              <span style={{ width:24, height:24, borderRadius:7, background:"#eef2f7", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><i className="ti ti-calendar-event" style={{ color:"#3a6ea5", fontSize:14 }} /></span>
              <span style={{ fontWeight:600, fontSize:10.5, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>Upcoming</span>
              <span style={{ marginLeft:"auto", flexShrink:0, background:"#eef2f7", color:"#3a6ea5", fontWeight:600, fontSize:10.5, padding:"1px 8px", borderRadius:20 }}>{upcoming.reduce((n,b)=>n+roomsOf(b).length,0)}</span>
            </div>
          </div>
          {toConfirm.length > 0 && (
            <div style={{ background:"#fbf6e7", borderTop:"1px solid var(--border)", borderBottom:"1px solid var(--border)", padding:"7px 13px", fontSize:10.5, fontWeight:600, color:"#8a6200", display:"flex", alignItems:"center", gap:6, letterSpacing:.3 }}>
              <i className="ti ti-phone-call" style={{ fontSize:14 }} /> Call to confirm — arriving tomorrow
            </div>
          )}
          {upcoming.length ? (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, padding:"4px 13px 12px" }}>
              {upcoming.flatMap(b => {
                const soon = b.checkin === tomorrowStr;
                return roomsOf(b).map(rm => (
                  <button key={b.id+"-"+rm} type="button" title={(b.guest || "")+" — click to confirm check-in"} onClick={() => setConfirmRes(b)}
                    style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:1, minWidth:44, cursor:"pointer", fontFamily:"inherit", background:"var(--bg2)", color: soon ? "#8a6200" : "#3a6ea5", border:"1px solid "+(soon ? "var(--gold2)" : "#3a6ea5"), borderRadius:8, padding:"5px 10px", lineHeight:1.15 }}>
                    <span style={{ fontWeight:600, fontSize:14, fontVariantNumeric:"tabular-nums" }}>{rm}</span>
                    <span style={{ fontSize:9.5, fontWeight:500, color:"var(--text3)" }}>{shortDate(roomBookingWindow(b, rm).checkin)}</span>
                  </button>
                ));
              })}
            </div>
          ) : (
            <div style={{ color:"var(--text3)", fontSize:11.5, textAlign:"center", padding:"6px 4px 14px" }}>None</div>
          )}
        </div>
      </div>

      {/* ── Room map (full width) ── */}
      <div style={{ minWidth:0 }}>
        <div>
          {/* Room map */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9, flexWrap:"wrap" }}>
            <span style={{ fontSize:10.5, fontWeight:600, color:"var(--text2)", textTransform:"uppercase", letterSpacing:1 }}>Room Map</span>
            <div style={{ display:"flex", gap:10, marginLeft:"auto" }}>
              {[["#5AA82F","Vacant"],["#E24B4A","Occupied"],["#7F77DD","Reserved"],["#E0A400","Cleaning"]].map(([c,l])=>(
                <span key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"var(--text3)", fontWeight:600 }}>
                  <span style={{ width:10, height:10, borderRadius:"50%", background:c, display:"inline-block" }} />{l}
                </span>
              ))}
            </div>
          </div>
          <style>{ROOM_MAP_CSS}</style>
          <div style={{ display:"grid", gridTemplateColumns:isMobile ? "repeat(2,minmax(0,1fr))" : `repeat(${Math.min(rooms.length, 12)},minmax(0,1fr))`, gap:isMobile?14:10, marginBottom:14 }}>
            {rooms.map(r => {
              const rawDs = getRoomDisplayStatus(r, bookings, today);
              // A vacant room that was just checked out shows "needs cleaning"
              const needsClean = dirtyRooms && dirtyRooms[String(r.number)];
              const ds = (rawDs === "vacant" && needsClean) ? "cleaning" : rawDs;
              const st = STATUS_STYLE[ds] || STATUS_STYLE.vacant;
              const fc = bookings.filter(b => b.status === "confirmed" && bookingCoversRoom(b, r.number) && roomBookingWindow(b, r.number).checkin > today).length;
              const bIn  = bookings.find(b => b.status === "checked-in" && bookingCoversRoom(b, r.number) && roomBookingWindow(b, r.number).checkout >= today);
              const bRes = bookings.find(b => { if (b.status !== "confirmed" || !bookingCoversRoom(b, r.number)) return false; const w = roomBookingWindow(b, r.number); return w.checkin <= today && w.checkout > today; });
              const bk = bIn || bRes;
              const statusIcon = ds === "occupied" ? "ti-user" : ds === "reserved" ? "ti-calendar" : ds === "cleaning" ? "ti-spray" : "ti-bed";
              // Ribbon note: checkout for active rooms, "N ahead" heads-up for a free room with future reservations
              let ribbonNote = "";
              if (ds === "cleaning") ribbonNote = "tap to start";
              else if (bk) ribbonNote = "out " + shortDate(roomBookingWindow(bk, r.number).checkout);
              else if (fc > 0) ribbonNote = fc + " ahead";
              // This room's own share of the booking (never the whole-booking total)
              let rn = 0, total = 0, paid = 0, due = 0, isCombined = false, roomList = [], isExtended = false;
              if (bk) {
                const w = roomBookingWindow(bk, r.number);
                rn = Math.max(1, Math.round((new Date(w.checkout+"T00:00:00") - new Date(w.checkin+"T00:00:00")) / 86400000));
                const hasMulti = !!(bk.multiRooms && bk.multiRooms.length);
                const hasExtra = !!(bk.extraRooms && bk.extraRooms.length);
                isCombined = hasMulti || hasExtra;
                if (hasMulti) { const mr = bk.multiRooms.find(m => String(m.number) === String(r.number)); total = mr ? (mr.amount ?? mr.net ?? 0) : 0; }
                else if (hasExtra) {
                  const er = bk.extraRooms.find(x => String(x.number) === String(r.number));
                  if (er) total = er.amount ?? er.grossAmt ?? 0;
                  else { const extrasSum = bk.extraRooms.reduce((s,x)=>s+(x.amount ?? x.grossAmt ?? 0),0); total = Math.max(0, (bk.invoiceTotal ?? bk.amount ?? 0) - extrasSum); }
                } else total = bk.invoiceTotal ?? bk.amount ?? 0;
                roomList = hasMulti ? bk.multiRooms.map(m=>m.number) : hasExtra ? [bk.room, ...bk.extraRooms.map(x=>x.number)] : [bk.room];
                paid = (parseFloat(bk.advance)||0) + (parseFloat(bk.restPayment)||0) + (parseFloat(bk.extrasAdvance)||0);
                due  = Math.max(0, (bk.invoiceTotal ?? bk.amount ?? 0) - paid);
                isExtended = !!(bk.extensions && bk.extensions.length) || (bk.paymentHistory || []).some(p => /extend/i.test(p.note || ""));
              }
              return (
                <div key={r.id} className="rm-card" onClick={() => ds === "cleaning" ? setCleanTarget(r) : setSel(r)}>
                  {/* Soft tinted status strip */}
                  <div style={{ background:st.tint, color:st.stripTx, fontSize:11, padding:"6px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:6 }}>
                    <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      <span style={{ display:"inline-block", width:7, height:7, borderRadius:"50%", background:st.dot, marginRight:6, verticalAlign:"1px" }} />{st.label}
                    </span>
                    {ribbonNote && <span className={(!bk && fc>0) ? "rm-ahead" : ""} style={{ whiteSpace:"nowrap" }}>{ribbonNote}</span>}
                  </div>
                  {/* Body */}
                  <div style={{ padding:"12px 13px 13px" }}>
                    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", gap:6 }}>
                      <span style={{ fontSize:26, fontWeight:500, color:"var(--text)", letterSpacing:-.5, lineHeight:1 }}>{r.number}</span>
                      <span style={{ fontSize:11, color:"var(--text3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"60%" }}>{r.name || r.type}</span>
                    </div>
                    {ds === "cleaning" ? (
                      <div style={{ fontSize:14, color:"var(--text2)", marginTop:6 }}>Needs cleaning</div>
                    ) : bk ? (<>
                      <div style={{ fontSize:14, color:"var(--text)", marginTop:6, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{bk.guest}</div>
                      <div style={{ fontSize:12, color:"var(--text3)", marginTop:3 }}>{rn} night{rn>1?"s":""}</div>
                      <div style={{ marginTop:9, display:"flex", gap:6, flexWrap:"wrap" }}>
                        {due > 0
                          ? <span style={{ fontSize:11, background:"#FBD3D3", color:"#8f2323", padding:"2px 9px", borderRadius:20 }}>due {money(due)}</span>
                          : <span style={{ fontSize:11, background:"#D6EEC6", color:"#356010", padding:"2px 9px", borderRadius:20 }}>paid <i className="ti ti-check" style={{ fontSize:11 }} /></span>}
                        {isExtended && <span style={{ fontSize:11, background:"#DAD4F8", color:"#332b7a", padding:"2px 9px", borderRadius:20 }}><i className="ti ti-arrow-up-right" style={{ fontSize:11 }} /> extended</span>}
                      </div>
                    </>) : (<>
                      <div style={{ fontSize:14, color:"var(--text2)", marginTop:6 }}>Available now</div>
                      <div style={{ marginTop:9 }}>
                        <span style={{ fontSize:11, background:"var(--bg3)", color:"var(--text3)", padding:"2px 9px", borderRadius:20 }}>tap to book</span>
                      </div>
                    </>)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Today's Tasks — big, prominent panel under the room map & guests.
              Flashes gold when due today, red when overdue, so it can't be missed. */}
          <div className={pendingT.length ? (pendingT.some(p=>p.overdue) ? "task-flash-red" : "task-flash-gold") : ""}
            style={{ background:"#fff", border:`2px solid ${pendingT.some(p=>p.overdue)?"var(--red2)":(pendingT.length?"var(--gold2)":"#86EFB0")}`, borderRadius:14, padding:"14px 16px", marginTop:14 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, marginBottom:pendingT.length?12:0 }}>
              <div style={{ fontSize:15, fontWeight:600, color:"var(--navy)", display:"flex", alignItems:"center", gap:9 }}>
                <span style={{ width:26, height:26, borderRadius:8, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><i className="ti ti-checklist" style={{ color:"var(--gold2)", fontSize:16 }} /></span> Today's Tasks
                <span style={{ background:pendingT.length?"var(--red-bg)":"var(--green-bg)", color:pendingT.length?"var(--red2)":"var(--green)", fontWeight:600, fontSize:11, padding:"1px 9px", borderRadius:20 }}>{pendingT.length ? `${pendingT.length} to do` : "All done"}</span>
              </div>
              <button onClick={()=>setActiveTab("tasks")} style={{ fontSize:12, fontWeight:700, background:"transparent", border:"1.5px solid var(--border)", borderRadius:8, padding:"6px 12px", color:"var(--navy)", cursor:"pointer" }}>Open all ▸</button>
            </div>
            {pendingT.length ? (
              <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
                {pendingT.map(({task,due,overdue}) => (
                  <div key={task.id+"_"+due} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"11px 13px", border:`1.5px solid ${overdue?"#fca5a5":"#e5e3de"}`, background:overdue?"#fff5f5":"#fafaf9", borderRadius:10 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:800, fontSize:14, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{task.title}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:overdue?"var(--red2)":"var(--green)", marginTop:2 }}>{overdue ? "⚠ OVERDUE" : "Due today"} <span style={{ color:"var(--text3)", fontWeight:400 }}>· {freqLabel(task)}</span></div>
                    </div>
                    <button onClick={()=>quickDoneTask(task,due)} style={{ flexShrink:0, padding:"9px 15px", borderRadius:9, border:"none", background:"var(--green)", color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13 }}>✓ Done</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color:"var(--green)", fontSize:13, fontWeight:700, padding:"6px 0 2px" }}>🎉 All tasks done for today</div>
            )}
          </div>
        </div>

        {/* Below the map: less-used panels in a row (off the main scroll path) */}
        <div style={{ display:"grid", gridTemplateColumns:isMobile ? "minmax(0,1fr)" : "repeat(3,minmax(0,1fr))", gap:12, marginTop:14, alignItems:"stretch" }}>

          {/* Pending Balances */}
          {pendingBal.length > 0 && (
            <div className="panel" style={{ margin:0, border:"1px solid var(--border)", borderRadius:12 }}>
              <div className="panel-header" style={{ padding:"12px 14px" }}>
                <div className="panel-title" style={{ fontSize:12, gap:8, alignItems:"center" }}>
                  <span style={{ width:24, height:24, borderRadius:7, background:"var(--red-bg)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><i className="ti ti-alert-circle" style={{ color:"var(--red2)", fontSize:14 }} /></span>
                  <span style={{ fontWeight:600, fontSize:10.5, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" }}>Pending Balances</span>
                  <span style={{ marginLeft:"auto", background:"var(--red-bg)", color:"var(--red2)", fontWeight:600, fontSize:10.5, padding:"1px 8px", borderRadius:20 }}>{pendingBal.length}</span>
                </div>
              </div>
              {pendingBal.slice(0,5).map(b => (
                <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, padding:"9px 14px", borderTop:"1px solid var(--border)", fontSize:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, minWidth:0 }}>
                    <span style={{ width:28, height:28, borderRadius:"50%", background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, color:"var(--text2)", flexShrink:0 }}>{(b.guest||"?").split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase()}</span>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{b.guest}</div>
                      <div style={{ fontSize:10, color:"var(--text3)", textTransform:"capitalize" }}>Room {b.room} · {b.status}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight:600, color:"var(--red2)", fontSize:13, fontVariantNumeric:"tabular-nums", flexShrink:0 }}>{money(b.due)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Day P&L — plain by default; tap Revenue/Expenses to see the breakdown; date arrows to see past days */}
          {(() => {
            const pRev = allRevEntries.filter(r => r.date === pnlDate);
            const pExp = bizExpenses.filter(e => e.date === pnlDate);
            const pRevTot = pRev.reduce((s,r)=>s+r.amount, 0);
            const pExpTot = pExp.reduce((s,e)=>s+e.amount, 0);
            const isToday = pnlDate === today;
            const minDate = addDaysIso(today, -30);
            const canBack = pnlDate > minDate;
            return (
              <div className="panel" style={{ margin:0, border:"1px solid var(--border)", borderRadius:12 }}>
                <div className="panel-header" style={{ padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                  <div className="panel-title" style={{ fontSize:12, gap:8, alignItems:"center", minWidth:0 }}>
                    <span style={{ width:24, height:24, borderRadius:7, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><i className="ti ti-chart-pie" style={{ color:"var(--gold2)", fontSize:14 }} /></span>
                    <span style={{ fontWeight:600, fontSize:10.5, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" }}>{isToday ? "Today P&L" : "Day P&L"}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:2, background:"var(--bg3)", borderRadius:8, padding:"2px 3px", flexShrink:0 }}>
                    <button type="button" disabled={!canBack} onClick={() => canBack && setPnlDate(addDaysIso(pnlDate,-1))}
                      style={{ background:"none", border:"none", cursor:canBack?"pointer":"default", opacity:canBack?1:.3, color:"var(--text2)", padding:"2px 4px", lineHeight:1 }}><i className="ti ti-chevron-left" style={{ fontSize:15 }} /></button>
                    <span style={{ fontSize:11, fontWeight:600, minWidth:42, textAlign:"center", color:"var(--text)" }}>{isToday ? "Today" : shortDate(pnlDate)}</span>
                    <button type="button" disabled={isToday} onClick={() => !isToday && setPnlDate(addDaysIso(pnlDate,1))}
                      style={{ background:"none", border:"none", cursor:isToday?"default":"pointer", opacity:isToday?.3:1, color:"var(--text2)", padding:"2px 4px", lineHeight:1 }}><i className="ti ti-chevron-right" style={{ fontSize:15 }} /></button>
                  </div>
                </div>
                <div style={{ padding:"5px 12px 8px" }}>
                  {/* Revenue row */}
                  <div onClick={() => setPnlRevOpen(o=>!o)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", fontSize:12.5, cursor:"pointer" }}>
                    <span style={{ color:"var(--text2)", display:"flex", alignItems:"center", gap:4 }}><i className={"ti "+(pnlRevOpen?"ti-chevron-down":"ti-chevron-right")} style={{ fontSize:14, color:pnlRevOpen?"var(--green)":"var(--text3)" }} /> Revenue</span>
                    <span style={{ fontWeight:600, color:"var(--green)", fontVariantNumeric:"tabular-nums" }}>{money(pRevTot)}</span>
                  </div>
                  {pnlRevOpen && (
                    <div style={{ background:"#f7faf7", borderRadius:8, padding:"2px 10px", marginBottom:4 }}>
                      {pRev.length ? pRev.map((r,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:i<pRev.length-1?"1px solid #eef3ee":"none", fontSize:12 }}>
                          <span style={{ minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            {r.room ? <span style={{ fontWeight:800, color:"#356010" }}>Rm {r.room}</span> : <span style={{ fontWeight:800, color:"#356010" }}>Other</span>}
                            <span style={{ color:"var(--text3)", fontSize:11 }}> · {r.kind || r.source || "revenue"}</span>
                          </span>
                          <span style={{ fontWeight:700, color:"var(--green)", flexShrink:0, marginLeft:8 }}>{money(r.amount)}</span>
                        </div>
                      )) : <div style={{ color:"var(--text3)", fontSize:11.5, textAlign:"center", padding:"8px 0" }}>No revenue this day</div>}
                    </div>
                  )}
                  {/* Expenses row */}
                  <div onClick={() => setPnlExpOpen(o=>!o)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", fontSize:12.5, cursor:"pointer", borderTop:"1px solid var(--border)", borderBottom:"1.5px solid var(--border)" }}>
                    <span style={{ color:"var(--text2)", display:"flex", alignItems:"center", gap:4 }}><i className={"ti "+(pnlExpOpen?"ti-chevron-down":"ti-chevron-right")} style={{ fontSize:14, color:pnlExpOpen?"var(--red2)":"var(--text3)" }} /> Expenses</span>
                    <span style={{ fontWeight:600, color:"var(--red)", fontVariantNumeric:"tabular-nums" }}>{money(pExpTot)}</span>
                  </div>
                  {pnlExpOpen && (
                    <div style={{ background:"#fdf6f5", borderRadius:8, padding:"2px 10px", margin:"4px 0" }}>
                      {pExp.length ? pExp.map((e,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:i<pExp.length-1?"1px solid #f5e6e4":"none", fontSize:12 }}>
                          <span style={{ minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                            <span style={{ fontWeight:800, color:"#8f2323" }}>{e.type || e.category || "Expense"}</span>
                            {e.note && <span style={{ color:"var(--text3)", fontSize:11 }}> · {e.note}</span>}
                          </span>
                          <span style={{ fontWeight:700, color:"var(--red)", flexShrink:0, marginLeft:8 }}>{money(e.amount)}</span>
                        </div>
                      )) : <div style={{ color:"var(--text3)", fontSize:11.5, textAlign:"center", padding:"8px 0" }}>No expenses this day</div>}
                    </div>
                  )}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0 1px", marginTop:5, borderTop:"1.5px solid var(--border)", fontSize:14, fontWeight:600 }}><span>Net</span><span style={{ color:pRevTot-pExpTot>=0?"var(--green)":"var(--red2)", fontSize:16, fontVariantNumeric:"tabular-nums" }}>{money(pRevTot-pExpTot)}</span></div>
                </div>
              </div>
            );
          })()}

          {/* Cleaning log — admin oversight of who cleaned which room, when */}
          {curRole === "admin" && (
            <div className="panel" style={{ margin:0, border:"1px solid var(--border)", borderRadius:12 }}>
              <div className="panel-header" style={{ padding:"12px 14px" }}>
                <div className="panel-title" style={{ fontSize:12, gap:8, alignItems:"center" }}>
                  <span style={{ width:24, height:24, borderRadius:7, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><i className="ti ti-spray" style={{ color:"#a6832c", fontSize:14 }} /></span>
                  <span style={{ fontWeight:600, fontSize:10.5, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" }}>Cleaning Log</span>
                </div>
              </div>
              {(!cleaningLog || cleaningLog.length === 0) ? (
                <div style={{ color:"var(--text3)", fontSize:12, textAlign:"center", padding:"12px 0" }}>No cleanings recorded yet</div>
              ) : [...cleaningLog].slice(-6).reverse().map((c,i) => (
                <div key={i} style={{ padding:"9px 14px", borderTop:"1px solid var(--border)", fontSize:11.5 }}>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontWeight:600 }}>Room {c.room}</span>
                    <span style={{ color:"var(--text3)" }}>{c.at ? new Date(c.at).toLocaleString("en-GB",{ day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : ""}</span>
                  </div>
                  <div style={{ color:"var(--text3)", marginTop:2 }}>by {c.by} · {(c.checklist||[]).length}/6 items</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showRevDetail && (
        <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && setShowRevDetail(false)} style={{ zIndex:9999 }}>
          <div style={{ background:"#fff", borderRadius:14, width:"96vw", maxWidth:560, maxHeight:"85vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 10px 48px rgba(0,0,0,.28)" }}>
            <div style={{ background:"var(--navy)", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>
                  <i className="ti ti-currency-taka" style={{ marginRight:8, color:"var(--gold)" }} />
                  Today's Revenue Breakdown
                </div>
                <div style={{ color:"rgba(255,255,255,.55)", fontSize:11, marginTop:2 }}>{today}</div>
              </div>
              <button onClick={() => setShowRevDetail(false)} style={{ background:"rgba(255,255,255,.1)", border:"none", borderRadius:7, color:"#fff", cursor:"pointer", padding:"6px 10px", fontSize:13 }}>✕</button>
            </div>
            <div style={{ overflowY:"auto", padding:"16px 20px", flex:1 }}>
              {(() => {
                const todayEntries = allRevEntries.filter(r => r.date === today);
                if (todayEntries.length === 0) return (
                  <div style={{ textAlign:"center", color:"var(--text3)", padding:30, fontSize:13 }}>No revenue recorded today.</div>
                );
                return (
                  <>
                    {todayEntries.map((r, i) => {
                      const bk = bookings.find(b => b.id === r.bookingId)
                        || (r.note ? bookings.find(b => r.note.includes(b.guest) && r.note.includes("Rm "+b.room)) : null);
                      const cancelled = bk?.status === "cancelled";
                      const orphaned = !bk;
                      return (
                        <div key={r.id ?? i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid var(--border)", opacity: cancelled||orphaned ? .6 : 1 }}>
                          <div style={{ width:36, height:36, borderRadius:9, background: cancelled||orphaned ? "#fff0f0" : "#ede8ff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <i className={"ti " + (cancelled||orphaned ? "ti-alert-triangle" : "ti-currency-taka")} style={{ fontSize:16, color: cancelled||orphaned ? "#c0392b" : "#5b3fa0" }} />
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:13 }}>
                              {bk ? `${bk.guest} — Rm ${bk.room}` : (r.note || r.source)}
                            </div>
                            {bk && !cancelled && <div style={{ fontSize:11, color:"#4a2ea8", marginTop:1 }}>Invoice GA-{String(bk.id).padStart(4,"0")} · {r.note?.match(/\(([^)]+)\)/)?.[1] || "Cash"}</div>}
                            {cancelled && <div style={{ fontSize:11, color:"#c0392b", marginTop:1 }}>⚠ Booking was cancelled — revenue not valid</div>}
                            {orphaned  && <div style={{ fontSize:11, color:"#c0392b", marginTop:1 }}>⚠ Booking not found — may have been deleted</div>}
                          </div>
                          <div style={{ fontWeight:800, fontSize:14, color: cancelled||orphaned ? "#c0392b" : "#1a7040", flexShrink:0 }}>{money(r.amount)}</div>
                        </div>
                      );
                    })}
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"12px 0 4px", borderTop:"2px solid var(--border)", marginTop:4 }}>
                      <span style={{ fontWeight:800, fontSize:14 }}>Total</span>
                      <span style={{ fontWeight:900, fontSize:16, color:"var(--gold2)" }}>{money(dRev)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      {sel && <RoomModal room={sel} onClose={() => setSel(null)} onCheckout={chkOut}
        onExtend={(b) => { setSel(null); setExtendTarget(b); }}
        onCollect={(b) => { setSel(null); setCollectTarget(b); }}
        onService={(b) => { setSel(null); setServiceTarget(b); }}
        onInvoice={(b) => { setSel(null); setInvoiceTarget(b); }}
        onNewBooking={(prefill) => { setSel(null); setNewBooking(prefill); }} />}
      {newBooking && <NewBookingModal prefill={newBooking} onClose={() => setNewBooking(null)} />}
      {confirmRes && <InvoicePreviewModal booking={confirmRes} rooms={rooms}
        onClose={() => setConfirmRes(null)}
        onEdit={(bk) => { setConfirmRes(null); setEditResTarget(bk); }}
        onComplete={(bk) => { setConfirmRes(null); setCompleteBooking(bk); }} />}
      {completeBooking && <NewBookingModal editBooking={completeBooking} onClose={() => setCompleteBooking(null)} />}
      {editResTarget && <EditReservationModal booking={editResTarget} rooms={rooms} bookings={bookings}
        onClose={() => setEditResTarget(null)} onSave={(data) => handleEditReservation(editResTarget, data)} />}
      {checkoutTarget && <CheckoutModal b={checkoutTarget} onConfirm={doCheckout} onClose={() => setCheckoutTarget(null)} />}
      {extendTarget && <ExtendStayModal booking={extendTarget} rooms={rooms} onClose={() => setExtendTarget(null)} onConfirm={(data) => handleExtendStay(extendTarget, data)} />}
      {cleanTarget && <CleaningModal room={cleanTarget} info={dirtyRooms[String(cleanTarget.number)]} onClose={() => setCleanTarget(null)} onConfirm={(checklist) => markRoomClean(cleanTarget, checklist)} />}
      {checkinPreview && <CheckInPreviewModal booking={checkinPreview} rooms={rooms} onConfirm={() => { confirmCheckin(checkinPreview); setCheckinPreview(null); }} onEdit={() => setCheckinPreview(null)} onClose={() => setCheckinPreview(null)} />}
      {invoiceTarget && <DeskInvoiceModal booking={invoiceTarget} rooms={rooms} onClose={() => setInvoiceTarget(null)} onPrint={() => handlePrintInvoice(invoiceTarget)} onPrintTC={() => handlePrintWithTC(invoiceTarget)} />}
      {collectTarget && <DeskCollectPayModal booking={collectTarget} onClose={() => setCollectTarget(null)} onConfirm={(amt, mtd, txn, note) => { handleCollectPayment(collectTarget, amt, mtd, txn, note); setCollectTarget(null); }} />}
      {serviceTarget && <DeskServiceModal booking={serviceTarget} onClose={() => setServiceTarget(null)} onConfirm={(desc, amt, date) => { handleAddService(serviceTarget, desc, amt, date); setServiceTarget(null); }} />}
      {postCheckout && !surveyBooking && (
        <PostCheckoutModal
          booking={postCheckout}
          onSurvey={() => { setSurveyBooking(postCheckout); setPostCheckout(null); }}
          onClose={() => setPostCheckout(null)}
        />
      )}
      {surveyBooking && (
        <GuestSurveyOverlay
          booking={surveyBooking}
          onClose={() => setSurveyBooking(null)}
        />
      )}
    </div>
  );
}
