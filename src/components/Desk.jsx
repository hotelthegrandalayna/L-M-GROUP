import { useState, useRef, Fragment } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money, bookingConflicts, getRoomDisplayStatus, maxId, formatDate } from "../utils/helpers";
import { buildInvoiceHTML, buildTCHtml, hotelPrint } from "./Invoice";

function addDaysIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
import GuestSurveyOverlay from "./GuestSurveyOverlay";
import { persistHotelBookingBundle } from "../lib/hotelSupabase";

// ── Room status colours (soft tints) ──────────────────────────────────────
const STATUS_STYLE = {
  occupied:    { bg:"#FFF0F0", text:"#7a1a1a", border:"#f5a0a0", badge:"#C62828", badgeTx:"#fff" },
  reserved:    { bg:"#FFF8EC", text:"#7a4200", border:"#f5c97a", badge:"#E65100", badgeTx:"#fff" },
  vacant:      { bg:"#F0FBF2", text:"#1a5c2a", border:"#86EFB0", badge:"#1B7A33", badgeTx:"#fff" },
  maintenance: { bg:"#F4F4F4", text:"#444",    border:"#ccc",    badge:"#555",    badgeTx:"#fff" },
};

function getHotelDue(b) {
  if (b?.dueAmount != null) return Math.max(0, parseFloat(b.dueAmount) || 0);
  const total = b?.invoiceTotal != null ? b.invoiceTotal : b?.amount || 0;
  const paid =
    (parseFloat(b?.advance) || 0) +
    (parseFloat(b?.restPayment) || 0) +
    (parseFloat(b?.extrasAdvance) || 0);
  return Math.max(0, total - paid);
}

function RoomModal({ room, onClose, onCheckout }) {
  const { curUser, bookings, updateBookings, revenues, updateRevenues, notify } = useApp();
  const today = todayStr();
  const tmr = new Date(today + "T00:00:00");
  tmr.setDate(tmr.getDate() + 1);
  const d2  = new Date(today + "T00:00:00");
  d2.setDate(d2.getDate() + 2);
  const tmrIso = tmr.toISOString().split("T")[0];
  const d2Iso  = d2.toISOString().split("T")[0];
  const bIn  = bookings.find(b => b.room === room.number && b.status === "checked-in");
  const bRes = bookings.find(b => b.room === room.number && b.status === "confirmed" && b.checkin <= today && b.checkout > today);
  const future = bookings.filter(b => b.room === room.number && b.status === "confirmed" && b.checkin > today).sort((a,b) => a.checkin > b.checkin ? 1 : -1);

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
    updateBookings(bookings.map(b => b.id === bid ? { ...b, status: "cancelled" } : b));
    notify("Reservation cancelled", "success"); onClose();
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
        <button className="btn sm danger" style={{ fontSize:10, padding:"4px 8px" }} onClick={() => cancelRes(b.id)}><i className="ti ti-x" /></button>
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
          <div className="form-group"><label>Check-in *</label><input type="date" value={ci} min={today} onChange={e=>{ setCi(e.target.value); setCo(addDaysIso(e.target.value,1)); }} /></div>
          <div className="form-group"><label>Check-out *</label><input type="date" value={co} min={ci ? addDaysIso(ci,1) : addDaysIso(today,1)} onChange={e=>setCo(e.target.value)} /></div>
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

        {bIn && (<>
          <div style={{ background:"var(--green-bg)", border:"1.5px solid var(--green-bd)", borderRadius:9, padding:13, marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--green)", textTransform:"uppercase", marginBottom:10 }}>Currently Checked In</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, fontSize:12 }}>
              {[["Guest",bIn.guest],["Phone",bIn.phone],["Check-out",bIn.checkout],["Balance Due",money(getHotelDue(bIn))]].map(([l,v]) => (
                <div key={l}><div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>{l}</div><strong>{v}</strong></div>
              ))}
            </div>
          </div>
          {future.length > 0 && <><div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Upcoming Reservations</div>{future.map(b => <FRow key={b.id} b={b} />)}</>}
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn gold" onClick={() => chkOut(bIn.id)}><i className="ti ti-logout" /> Check Out</button>
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
          </div>
          {future.length > 0 && <><div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Other Upcoming</div>{future.map(b => <FRow key={b.id} b={b} />)}</>}
          <div style={{ borderTop:"1px dashed var(--border)", margin:"12px 0 10px" }} />
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:12 }}>Add Another Reservation</div>
          {qrForm()}
          <div className="modal-actions">
            <button className="btn danger" style={{ marginRight:"auto" }} onClick={() => cancelRes(bRes.id)}><i className="ti ti-calendar-x" /> Cancel Current</button>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn primary" onClick={doRes}><i className="ti ti-calendar-check" /> Reserve</button>
          </div>
        </>)}

        {!bIn && !bRes && (<>
          {future.length > 0 && <><div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Upcoming Reservations</div>{future.map(b => <FRow key={b.id} b={b} />)}<div style={{ borderTop:"1px dashed var(--border)", margin:"12px 0 10px" }} /></>}
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:12 }}>New Reservation</div>
          {qrForm()}
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={doRes}><i className="ti ti-calendar-check" /> Reserve Room</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Checkout Confirmation Modal ────────────────────────────────────────────
function CheckoutModal({ b, onConfirm, onClose }) {
  const tot = b.invoiceTotal != null ? b.invoiceTotal : b.amount;
  const out = Math.max(0, tot - ((b.advance || 0) + (b.extrasAdvance || 0)));
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
function DeskInvoiceModal({ booking, rooms, onClose, onPrint }) {
  const html = buildInvoiceHTML(booking, rooms, booking.invoiceExtras || [], "room");
  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && onClose()} style={{ zIndex:9999 }}>
      <div style={{ background:"#fff", borderRadius:12, width:"96vw", maxWidth:820,
        maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,.22)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"12px 18px", background:"var(--navy)", borderBottom:"1px solid rgba(255,255,255,.1)" }}>
          <span style={{ color:"#fff", fontWeight:800, fontSize:14 }}>
            <i className="ti ti-file-invoice" style={{ marginRight:7, color:"var(--gold)" }} />
            Invoice — {booking.guest} · Rm {booking.room}
          </span>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onPrint} style={{ background:"var(--gold)", color:"var(--navy)", border:"none",
              borderRadius:8, padding:"7px 18px", fontWeight:800, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}>
              <i className="ti ti-printer" /> Print
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
  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget && onClose()} style={{ zIndex:9999 }}>
      <div className="modal-box" style={{ maxWidth:380 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color:"#b07800" }}>
            <i className="ti ti-sparkles" /> Add Service Charge — {booking.guest}
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="form-group"><label>Description *</label>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Restaurant, Laundry, Room service" autoFocus />
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div className="form-group" style={{ marginBottom:0 }}><label>Amount (৳) *</label>
            <input type="number" value={amt} min={1} onChange={e=>setAmt(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group" style={{ marginBottom:0 }}><label>Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
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

export default function Desk() {
  const { curRole, curUser, rooms, bookings, revenues, expenses, updateBookings, updateRevenues, notify, setActiveTab, setPendingInvoiceId } = useApp();
  const [sel, setSel] = useState(null);
  const [checkoutTarget, setCheckoutTarget] = useState(null);
  const [postCheckout, setPostCheckout] = useState(null);
  const [surveyBooking, setSurveyBooking] = useState(null);
  const [expandedRow, setExpandedRow] = useState(null);        // booking id of expanded in-house row
  const [invoiceTarget, setInvoiceTarget] = useState(null);    // booking to show invoice for
  const [collectTarget, setCollectTarget] = useState(null);    // booking to collect payment for
  const [serviceTarget, setServiceTarget] = useState(null);    // booking to add service to
  const [checkinPreview, setCheckinPreview] = useState(null);  // booking preview before check-in
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

  const dRev  = revenues.filter(r => r.date === today).reduce((s,r) => s+r.amount, 0);
  const dExp  = expenses.filter(e => e.date === today).reduce((s,e) => s+e.amount, 0);
  const tRev  = revenues.reduce((s,r) => s+r.amount, 0);
  const tExp  = expenses.reduce((s,e) => s+e.amount, 0);
  const inhouse    = bookings.filter(b => b.status === "checked-in");
  const arrivals   = bookings.filter(b => b.checkin === today && (b.status === "confirmed" || b.status === "checked-in"));
  const departures = bookings.filter(b => b.checkout === today && b.status === "checked-in");
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
    const updated = { ...b, invoiceExtras: extras, invoiceTotal: newTotal };
    updateBookings(prev => prev.map(x => x.id===b.id ? updated : x));
    void persistHotelBookingBundle(updated).catch(()=>{});
    notify("Service charge added to invoice","success");
    setServiceTarget(null);
  }

  // Print invoice from Desk
  function handlePrintInvoice(b) {
    const invHtml = buildInvoiceHTML(b, rooms, b.invoiceExtras||[], "room");
    hotelPrint(invHtml, null);
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
    void persistHotelBookingBundle(updatedBooking).catch((err) => {
      console.error("Failed to sync checkout to Supabase:", err);
      notify("Checkout saved locally, but Supabase sync failed", "error");
    });
    notify(b.guest + " checked out successfully", "success");
    setCheckoutTarget(null);
    setPostCheckout(b); // show post-checkout options (survey / review)
  }

  function GuestRow({ b, showIn, showOut }) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", borderBottom:"1px solid var(--border)", fontSize:12 }}>
        <div style={{ width:28, height:28, borderRadius:7, background:"var(--navy)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <span style={{ fontSize:10, fontWeight:800, color:"var(--gold2)" }}>{b.room}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:12 }}>{b.guest}</div>
          <div style={{ fontSize:10, color:"var(--text3)" }}>{b.phone} · {b.nights}n</div>
        </div>
        {showIn  && <button className="btn sm primary" style={{ fontSize:11, padding:"4px 10px" }} onClick={() => initiateCheckin(b)}><i className="ti ti-login" /> In</button>}
        {showOut && <button className="btn sm gold"    style={{ fontSize:11, padding:"4px 10px" }} onClick={() => chkOut(b.id)}><i className="ti ti-logout" /> Out</button>}
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
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8, marginBottom:14 }}>
        {[
          { label:"Occupancy",    value:occPct+"%",           sub:occ+" of "+rooms.length+" rooms", icon:"ti-percentage",    color:"var(--navy)" },
          { label:"In-House",     value:inhouse.length,       sub:"guests staying",                  icon:"ti-users",         color:"#5b3fa0" },
          { label:"Arrivals",     value:arrivals.length,      sub:"today",                           icon:"ti-login",         color:"var(--green)" },
          { label:"Departures",   value:departures.length,    sub:"today",                           icon:"ti-logout",        color:"var(--red2)" },
          { label:"Today Revenue",value:money(dRev),          sub:"expenses: "+money(dExp),          icon:"ti-currency-taka", color:"var(--gold2)" },
          curRole==="admin"
            ? { label:"All-time Profit", value:money(tRev-tExp), sub:"total",                       icon:"ti-trending-up",   color:(tRev-tExp)>=0?"var(--green)":"var(--red2)" }
            : { label:"Pending Balance", value:pendingBal.length, sub:"guests with balance due",    icon:"ti-alert-circle",  color:pendingBal.length>0?"var(--red2)":"var(--green)" },
        ].map(s => (
          <div key={s.label} style={{ background:"var(--bg2)", border:"1.5px solid var(--border)", borderRadius:10, padding:"9px 12px", display:"flex", alignItems:"center", gap:9 }}>
            <i className={"ti "+s.icon} style={{ fontSize:19, color:s.color, flexShrink:0 }} />
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:s.color, lineHeight:1.1 }}>{s.value}</div>
              <div style={{ fontSize:9, color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginTop:2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid: room map left, action panels right ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 290px", gap:14, alignItems:"start" }}>

        {/* Left: Room map + In-House below */}
        <div>
          {/* Room map */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9 }}>
            <span style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.8 }}>Room Map</span>
            <div style={{ display:"flex", gap:10, marginLeft:"auto" }}>
              {[["#1B7A33","#F0FBF2","Vacant"],["#C62828","#FFF0F0","Occupied"],["#E65100","#FFF8EC","Reserved"]].map(([c,bg,l])=>(
                <span key={l} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"var(--text3)", fontWeight:600 }}>
                  <span style={{ width:14, height:14, borderRadius:4, background:bg, border:"1.5px solid "+c, display:"inline-block" }} />{l}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
            {rooms.map(r => {
              const ds = getRoomDisplayStatus(r, bookings, today);
              const st = STATUS_STYLE[ds] || STATUS_STYLE.vacant;
              const fc = bookings.filter(b => b.room === r.number && b.status === "confirmed" && b.checkin > today).length;
              const bIn  = bookings.find(b => b.room === r.number && b.status === "checked-in");
              const bRes = bookings.find(b => b.room === r.number && b.status === "confirmed" && b.checkin <= today && b.checkout > today);
              return (
                <div key={r.id} onClick={() => setSel(r)} style={{
                  background:st.bg, color:st.text, border:"1.5px solid "+st.border,
                  borderRadius:12, padding:"12px 14px", cursor:"pointer", position:"relative",
                  transition:"transform .15s, box-shadow .15s", boxShadow:"0 1px 4px rgba(0,0,0,.07)",
                }}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 14px rgba(0,0,0,.13)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.07)";}}
                >
                  {fc > 0 && <div style={{ position:"absolute", top:7, right:8, background:st.badge, color:st.badgeTx, fontSize:8, fontWeight:800, borderRadius:6, padding:"1px 5px" }}>{fc} ahead</div>}
                  <div style={{ fontSize:22, fontWeight:900, color:st.badge, letterSpacing:-.5, lineHeight:1 }}>{r.number}</div>
                  <div style={{ fontSize:12, fontWeight:700, margin:"3px 0 1px", opacity:.85 }}>{r.name || r.type}</div>
                  <div style={{ fontSize:9, opacity:.55, textTransform:"uppercase", letterSpacing:.5 }}>{r.type}</div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:9 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:st.badge }}>{money(r.rate)}<span style={{ fontSize:8, opacity:.6 }}>/n</span></span>
                    <span style={{ fontSize:9, fontWeight:800, background:st.badge, color:st.badgeTx, padding:"2px 8px", borderRadius:6, textTransform:"uppercase" }}>
                      {ds === "occupied" ? "IN" : ds === "reserved" ? "RSVD" : "FREE"}
                    </span>
                  </div>
                  {(bIn || bRes) && (
                    <div style={{ marginTop:6, fontSize:10, color:st.badge, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {(bIn || bRes).guest}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* In-House — full width below room map */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <i className="ti ti-bed" style={{ color:"#5b3fa0" }} /> In-House Guests
                <span style={{ marginLeft:8, background:"#ede8ff", color:"#5b3fa0", fontWeight:800, fontSize:10, padding:"1px 8px", borderRadius:8 }}>{inhouse.length}</span>
              </div>
            </div>
            {inhouse.length === 0
              ? <div style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:18 }}>No guests currently checked in</div>
              : (
                <div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ background:"#1a1a2e", color:"#C9A84C" }}>
                        {["Room","Guest","Phone","Check-out","Balance",""].map(h=>(
                          <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, textTransform:"uppercase", letterSpacing:.5, fontWeight:600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inhouse.map((b,i) => {
                        const bal = getHotelDue(b);
                        const isOpen = expandedRow === b.id;
                        return (<Fragment key={b.id}>
                          <tr onClick={() => setExpandedRow(isOpen ? null : b.id)}
                            style={{ borderBottom: isOpen ? "none" : "1px solid var(--border)",
                              background: isOpen ? "#f5f3ff" : i%2===0 ? "" : "var(--bg3)",
                              cursor:"pointer", transition:"background .1s" }}>
                            <td style={{ padding:"9px 12px" }}><strong style={{ color:"#4a2ea8" }}>Rm {b.room}</strong></td>
                            <td style={{ padding:"9px 12px" }}><strong>{b.guest}</strong></td>
                            <td style={{ padding:"9px 12px", color:"var(--text3)", fontSize:12 }}>{b.phone}</td>
                            <td style={{ padding:"9px 12px", fontSize:12 }}>{formatDate(b.checkout)}</td>
                            <td style={{ padding:"9px 12px" }}>
                              <span style={{ fontWeight:800, fontSize:12, padding:"3px 10px", borderRadius:20,
                                background: bal>0 ? "#c0392b" : "#1a7040", color:"#fff" }}>
                                {bal>0 ? `Due ${money(bal)}` : "Paid ✓"}
                              </span>
                            </td>
                            <td style={{ padding:"9px 12px", textAlign:"right" }}>
                              <i className={"ti " + (isOpen ? "ti-chevron-up" : "ti-chevron-down")} style={{ fontSize:14, color:"var(--text3)" }} />
                            </td>
                          </tr>
                          {isOpen && (
                            <tr style={{ background:"#f5f3ff", borderBottom:"2px solid #c4b5f4" }}>
                              <td colSpan={6} style={{ padding:"10px 12px" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
                                  <span style={{ fontSize:11, color:"#4a2ea8", fontWeight:600, marginRight:4 }}>Actions:</span>

                                  {/* Extend Stay */}
                                  <button onClick={e=>{e.stopPropagation();goToInvoiceTab(b);}}
                                    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 13px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:"#4a2ea8", color:"#fff" }}>
                                    <i className="ti ti-calendar-plus" style={{ fontSize:14 }} /> Extend Stay
                                  </button>

                                  {/* Collect / Paid */}
                                  <button onClick={e=>{e.stopPropagation(); if(bal>0) setCollectTarget(b);}}
                                    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 13px", borderRadius:20, border:"none", cursor: bal>0?"pointer":"default", fontSize:12, fontWeight:600,
                                      background: bal>0 ? "#c0392b" : "#1a7040", color:"#fff" }}>
                                    <i className={"ti " + (bal>0 ? "ti-alert-circle" : "ti-circle-check")} style={{ fontSize:14 }} />
                                    {bal>0 ? `Collect ${money(bal)}` : "Fully Paid"}
                                  </button>

                                  {/* Add Service */}
                                  <button onClick={e=>{e.stopPropagation();setServiceTarget(b);}}
                                    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 13px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:"#b07800", color:"#fff" }}>
                                    <i className="ti ti-sparkles" style={{ fontSize:14 }} /> Add Service
                                  </button>

                                  {/* View Invoice */}
                                  <button onClick={e=>{e.stopPropagation();setInvoiceTarget(b);}}
                                    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 13px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:"#1a5a8a", color:"#fff" }}>
                                    <i className="ti ti-file-invoice" style={{ fontSize:14 }} /> Invoice
                                  </button>

                                  {/* Checkout */}
                                  <button onClick={e=>{e.stopPropagation();chkOut(b.id);}}
                                    style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 13px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600, background:"#7a1a1a", color:"#fff" }}>
                                    <i className="ti ti-logout" style={{ fontSize:14 }} /> Checkout
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>);
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </div>

        {/* Right: Action panels */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* Arrivals */}
          <div className="panel">
            <div className="panel-header" style={{ padding:"9px 12px" }}>
              <div className="panel-title" style={{ fontSize:12 }}>
                <i className="ti ti-login" style={{ color:"var(--green)" }} /> Arrivals
                <span style={{ marginLeft:6, background:"var(--green-bg)", color:"var(--green)", fontWeight:800, fontSize:10, padding:"1px 7px", borderRadius:8 }}>{arrivals.length}</span>
              </div>
            </div>
            {arrivals.length ? arrivals.map(b => <GuestRow key={b.id} b={b} showIn showOut={false} />) : (
              <div style={{ color:"var(--text3)", fontSize:12, textAlign:"center", padding:"10px 0" }}>No arrivals today</div>
            )}
          </div>

          {/* Departures */}
          <div className="panel">
            <div className="panel-header" style={{ padding:"9px 12px" }}>
              <div className="panel-title" style={{ fontSize:12 }}>
                <i className="ti ti-logout" style={{ color:"var(--red2)" }} /> Departures
                <span style={{ marginLeft:6, background:"var(--red-bg)", color:"var(--red2)", fontWeight:800, fontSize:10, padding:"1px 7px", borderRadius:8 }}>{departures.length}</span>
              </div>
            </div>
            {departures.length ? departures.map(b => <GuestRow key={b.id} b={b} showIn={false} showOut />) : (
              <div style={{ color:"var(--text3)", fontSize:12, textAlign:"center", padding:"10px 0" }}>No departures today</div>
            )}
          </div>

          {/* Pending Balances */}
          {pendingBal.length > 0 && (
            <div className="panel">
              <div className="panel-header" style={{ padding:"9px 12px" }}>
                <div className="panel-title" style={{ fontSize:12 }}>
                  <i className="ti ti-alert-circle" style={{ color:"var(--red2)" }} /> Pending Balances
                  <span style={{ marginLeft:6, background:"var(--red-bg)", color:"var(--red2)", fontWeight:800, fontSize:10, padding:"1px 7px", borderRadius:8 }}>{pendingBal.length}</span>
                </div>
              </div>
              {pendingBal.slice(0,5).map(b => (
                <div key={b.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 12px", borderBottom:"1px solid var(--border)", fontSize:12 }}>
                  <div>
                    <div style={{ fontWeight:700 }}>{b.guest} <span style={{ fontSize:10, color:"var(--text3)", fontWeight:400 }}>Rm {b.room}</span></div>
                    <div style={{ fontSize:10, color:"var(--text3)", textTransform:"capitalize" }}>{b.status}</div>
                  </div>
                  <div style={{ fontWeight:800, color:"var(--red2)", fontSize:13 }}>{money(b.due)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Today P&L */}
          <div className="panel">
            <div className="panel-header" style={{ padding:"9px 12px" }}>
              <div className="panel-title" style={{ fontSize:12 }}><i className="ti ti-chart-pie" /> Today P&amp;L</div>
            </div>
            <div style={{ padding:"8px 12px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:13 }}><span style={{ color:"var(--text2)" }}>Revenue</span><span style={{ fontWeight:700, color:"var(--green)" }}>{money(dRev)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:13, borderBottom:"1.5px solid var(--border)", paddingBottom:8 }}><span style={{ color:"var(--text2)" }}>Expenses</span><span style={{ fontWeight:700, color:"var(--red)" }}>{money(dExp)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0 2px", fontSize:14, fontWeight:800 }}><span>Net</span><span style={{ color:dRev-dExp>=0?"var(--green)":"var(--red2)" }}>{money(dRev-dExp)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {sel && <RoomModal room={sel} onClose={() => setSel(null)} onCheckout={chkOut} />}
      {checkoutTarget && <CheckoutModal b={checkoutTarget} onConfirm={doCheckout} onClose={() => setCheckoutTarget(null)} />}
      {checkinPreview && <CheckInPreviewModal booking={checkinPreview} rooms={rooms} onConfirm={() => { confirmCheckin(checkinPreview); setCheckinPreview(null); }} onEdit={() => setCheckinPreview(null)} onClose={() => setCheckinPreview(null)} />}
      {invoiceTarget && <DeskInvoiceModal booking={invoiceTarget} rooms={rooms} onClose={() => setInvoiceTarget(null)} onPrint={() => handlePrintInvoice(invoiceTarget)} />}
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
