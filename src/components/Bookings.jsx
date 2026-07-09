import { useState, useMemo, useRef, Fragment } from "react";
import { useApp } from "../context/AppContext";

function DateInput({ value, onChange, min, style, className }) {
  const display = value ? value.split('-').reverse().join('/') : '';
  const ref = useRef(null);
  const open = () => { try { ref.current?.showPicker?.(); } catch { ref.current?.click?.(); } };
  return (
    <div style={{ position:'relative' }} onClick={open}>
      <input type="text" value={display} placeholder="DD/MM/YYYY" readOnly
        style={{ ...style, cursor:'pointer', width:'100%', boxSizing:'border-box', pointerEvents:'none' }}
        className={className} />
      <input type="date" ref={ref} value={value||''} min={min} onChange={onChange}
        style={{ position:'absolute', inset:0, opacity:0, width:'100%', height:'100%', cursor:'pointer', zIndex:2 }}
        onFocus={open} />
    </div>
  );
}
import { todayStr, money, nightsBetween, bookingConflicts, maxId, formatDate } from "../utils/helpers";
import { sendWhatsAppAlert, buildHotelWaMessage } from "../utils/whatsapp";
import { sendNtfyAlert } from "../utils/ntfy";
import { logEvent } from "../utils/auditLog";
import { persistHotelBookingBundle } from "../lib/hotelSupabase";
import { buildInvoiceHTML, buildTCHtml, hotelPrint } from "./Invoice";

function InvoicePreviewModal({ booking, rooms, onClose }) {
  const html = buildInvoiceHTML(booking, rooms, booking.extras || [], "room");
  const print = () => {
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Invoice</title></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };
  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}
      style={{ zIndex: 9999 }}>
      <div style={{ background:"#fff", borderRadius:12, width:"96vw", maxWidth:800,
        maxHeight:"92vh", display:"flex", flexDirection:"column", overflow:"hidden",
        boxShadow:"0 8px 40px rgba(0,0,0,.18)" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"14px 20px", borderBottom:"1px solid #eee", background:"var(--navy)" }}>
          <span style={{ color:"#fff", fontWeight:800, fontSize:15 }}>
            <i className="ti ti-file-invoice" style={{ marginRight:8, color:"var(--gold)" }} />
            Invoice — {booking.guest} · Rm {booking.room}
          </span>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={print} style={{ background:"var(--gold)", color:"#fff", border:"none",
              borderRadius:8, padding:"7px 18px", fontWeight:700, cursor:"pointer", fontSize:13 }}>
              <i className="ti ti-printer" style={{ marginRight:6 }} />Print
            </button>
            <button onClick={onClose} style={{ background:"rgba(255,255,255,.15)", color:"#fff",
              border:"none", borderRadius:8, padding:"7px 12px", cursor:"pointer", fontSize:16 }}>
              <i className="ti ti-x" />
            </button>
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:20 }}
          dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  confirmed:    { bg:"#fffbee", border:"#FCD34D", color:"#8a6200", icon:"ti-calendar-check" },
  "checked-in": { bg:"#f0fdf4", border:"#86efac", color:"#166534", icon:"ti-login" },
  "checked-out":{ bg:"#f8fafc", border:"#cbd5e1", color:"#475569", icon:"ti-logout" },
  cancelled:    { bg:"#fff1f2", border:"#fca5a5", color:"#991b1b", icon:"ti-calendar-x" } };

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.confirmed;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px", borderRadius:12,
      fontSize:11, fontWeight:700, background:s.bg, border:"1.5px solid "+s.border, color:s.color }}>
      <i className={"ti "+s.icon} style={{ fontSize:11 }} />{status.replace("-"," ")}
    </span>
  );
}

function addDaysIso(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getHotelPaidAmount(b) {
  return (parseFloat(b.advance) || 0) + (parseFloat(b.restPayment) || 0);
}

function BookingModal({ booking, onClose }) {
  const { curUser, curRole, rooms, bookings, updateBookings, revenues, updateRevenues, notify } = useApp();
  const b = booking;
  const today = todayStr();
  const [tab, setTab] = useState("details");
  const [payAmt,  setPayAmt]  = useState(0);
  const [payMtd,  setPayMtd]  = useState("Cash");
  const [payTxn,  setPayTxn]  = useState("");
  const [payNote, setPayNote] = useState("");
  const [extDays, setExtDays] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [eGuest,  setEGuest]  = useState(b.guest);
  const [ePhone,  setEPhone]  = useState(b.phone);
  const [eNotes,  setENotes]  = useState(b.notes || "");

  const history  = b.paymentHistory || [];
  const totalPaid = getHotelPaidAmount(b);
  const invoiceTotal = b.invoiceTotal != null ? b.invoiceTotal : b.amount;
  const balance  = Math.max(0, invoiceTotal - totalPaid);
  const room     = rooms.find(r => r.number === b.room);
  const newCo    = b.status === "checked-in"
    ? new Date(new Date(b.checkout).getTime() + extDays * 86400000).toISOString().split("T")[0]
    : null;
  const extCost  = room ? extDays * room.rate : 0;
  const needsTxn = ["bKash","Nagad"].includes(payMtd);

  function collectPayment() {
    const amt = parseFloat(payAmt) || 0;
    if (amt <= 0) { notify("Enter a valid amount", "error"); return; }
    if (amt > balance + 0.01) { notify("Amount exceeds balance due", "error"); return; }
    const entry = { ts: new Date().toISOString(), amount: amt, method: payMtd,
      txnNumber: needsTxn ? payTxn : "", note: payNote || "Payment collected", type: "room", by: curUser || "staff" };
    const newRest = (parseFloat(b.restPayment) || 0) + amt;
    const newDue = Math.max(0, invoiceTotal - (parseFloat(b.advance) || 0) - newRest);
    updateBookings(prev => prev.map(x => x.id === b.id ? {
      ...x,
      paymentHistory: [...(x.paymentHistory || []), entry],
      restPayment: newRest,
      dueAmount: newDue,
      transactionNumber: needsTxn ? payTxn : (x.transactionNumber || x.txnNumber || ""),
      txnNumber: needsTxn ? payTxn : (x.txnNumber || x.transactionNumber || ""),
      paymentMethod: payMtd,
    } : x));
    updateRevenues(prev => [...prev, { id: maxId(prev), source: "Room Rent", amount: amt, date: today,
      note: b.guest + " Rm " + b.room + " - " + (payNote || "payment") + " (" + payMtd + ")", bookingId: b.id }]);
    notify("Payment of " + money(amt) + " recorded", "success");
    logEvent("hotel", "room_payment_collected", { num:String(b.id), guest:b.guest, amount:amt, note:`Rm ${b.room} · via ${payMtd}` }, curUser);
    setPayAmt(0); setPayTxn(""); setPayNote("");
    void persistHotelBookingBundle({
      ...b,
      paymentHistory: [...history, entry],
      restPayment: newRest,
      dueAmount: newDue,
      transactionNumber: needsTxn ? payTxn : (b.transactionNumber || b.txnNumber || ""),
      txnNumber: needsTxn ? payTxn : (b.txnNumber || b.transactionNumber || ""),
      paymentMethod: payMtd,
    }).catch((err) => {
      console.error("Failed to sync hotel payment to Supabase:", err);
      notify("Payment recorded locally, but Supabase sync failed", "error");
    });
    onClose();
  }

  function extendStay() {
    if (!newCo) return;
    if (bookingConflicts(b.room, b.checkout, newCo, b.id, bookings)) { notify("Room already booked for those dates", "error"); return; }
    const newNights = nightsBetween(b.checkin, newCo);
    const newAmt    = room ? newNights * room.rate : b.amount + extCost;
    const updatedB  = { ...b, checkout: newCo, nights: newNights, amount: newAmt };
    updateBookings(prev => prev.map(x => x.id === b.id ? updatedB : x));
    void persistHotelBookingBundle(updatedB).catch(err => console.error("Supabase extend sync failed:", err));
    if (extCost > 0) updateRevenues(prev => [...prev, { id: maxId(prev), source: "Room Rent", amount: extCost, date: today,
      note: b.guest + " Rm " + b.room + " - stay extended " + extDays + "d", bookingId: b.id }]);
    notify("Stay extended to " + newCo, "success");
    onClose();
  }

  function cancelBooking() {
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return;
    const updated = { ...b, status: "cancelled" };
    updateBookings(prev => prev.map(x => x.id === b.id ? updated : x));
    updateRevenues(prev => prev.filter(r => r.bookingId !== b.id && !(r.note && r.note.includes(b.guest) && r.note.includes("Rm "+b.room))));
    void persistHotelBookingBundle(updated).catch(err => console.error("Supabase cancel sync failed:", err));
    notify("Booking cancelled and revenue reversed", "success");
    logEvent("hotel", "booking_cancelled", { num:String(b.id), guest:b.guest, amount:invoiceTotal, note:`Rm ${b.room}` }, curUser);
    onClose();
  }

  function saveEdit() {
    if (!eGuest.trim()) { notify("Guest name required", "error"); return; }
    const updated = { ...b, guest: eGuest.trim(), phone: ePhone.trim(), notes: eNotes.trim() };
    updateBookings(prev => prev.map(x => x.id === b.id ? updated : x));
    void persistHotelBookingBundle(updated).catch(err => console.error("Supabase edit sync failed:", err));
    notify("Booking updated", "success");
    logEvent("hotel", "invoice_updated", { num:String(b.id), guest:eGuest.trim(), amount:invoiceTotal, note:`Rm ${b.room} · details edited` }, curUser);
    setEditMode(false);
    onClose();
  }

  const TABS = ["details","payment","extend"];
  const tabLabels = { details:"Details", payment:"Payment", extend:"Extend Stay" };

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="ti ti-file-invoice" style={{ color:"var(--gold)" }} /> Booking #{b.id} - Rm {b.room}</div>
            <div className="modal-sub">{b.guest} &bull; <Badge status={b.status} /></div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div style={{ display:"flex", gap:4, marginBottom:16, borderBottom:"1.5px solid var(--border)", paddingBottom:0 }}>
          {TABS.filter(t => !(t === "extend" && b.status !== "checked-in") && !(t === "payment" && ["cancelled","checked-out"].includes(b.status))).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding:"7px 14px", border:"none", background:"none", cursor:"pointer",
              fontSize:12, fontWeight:700, color: tab===t ? "var(--navy)" : "var(--text3)",
              borderBottom: tab===t ? "2.5px solid var(--gold)" : "2.5px solid transparent", transition:"all .15s" }}>
              {tabLabels[t]}
            </button>
          ))}
          {(curRole==="admin" || curRole==="manager") && b.status==="confirmed" && (
            <button onClick={() => setEditMode(!editMode)} style={{ marginLeft:"auto", padding:"7px 12px", border:"none", background:"none", cursor:"pointer",
              fontSize:12, fontWeight:700, color: editMode ? "var(--green)" : "var(--text3)" }}>
              <i className={"ti "+(editMode?"ti-device-floppy":"ti-pencil")} /> {editMode?"Editing":"Edit"}
            </button>
          )}
        </div>

        {tab === "details" && (
          <div>
            {editMode ? (
              <div>
                <div className="form-group"><label>Guest Name</label><input value={eGuest} onChange={e=>setEGuest(e.target.value)} /></div>
                <div className="form-group"><label>Phone</label><input value={ePhone} onChange={e=>setEPhone(e.target.value)} /></div>
                <div className="form-group"><label>Notes</label><textarea value={eNotes} onChange={e=>setENotes(e.target.value)} rows={2} style={{ width:"100%", resize:"vertical" }} /></div>
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <button className="btn" onClick={() => setEditMode(false)}>Cancel</button>
                  <button className="btn primary" onClick={saveEdit}><i className="ti ti-device-floppy" /> Save</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontSize:13 }}>
                {[
                  ["Guest",   b.guest],
                  ["Phone",   b.phone],
                  ["Room",    "Rm "+b.room+" ("+b.type+")"],
                  ["Status",  b.status.replace("-"," ")],
                  ["Check-in",  b.checkin],
                  ["Check-out", b.checkout],
                  ["Nights",  b.nights],
                  ["Rate",    money(room?.rate || 0)+"/night"],
                  ["Room Amt",money(b.amount)],
                  ["Extras",  money((b.extraItems||[]).reduce((s,x)=>s+x.total,0))],
                  ["Invoice Total", money(invoiceTotal)],
                  ["Total Paid",  money(totalPaid)],
                  ["Balance Due", money(balance)],
                  ["Source",  b.source || "-"],
                  ["Payment", b.paymentMethod || "-"],
                  ["Adults",  b.adults || "-"],
                ].map(([l,v]) => (
                  <div key={l} style={{ padding:"7px 10px", background:"var(--panel)", borderRadius:7 }}>
                    <div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>{l}</div>
                    <strong style={{ fontSize:13 }}>{v}</strong>
                  </div>
                ))}
                {b.notes && <div style={{ gridColumn:"1/-1", padding:"7px 10px", background:"var(--panel)", borderRadius:7 }}>
                  <div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>Notes</div>
                  <div style={{ fontSize:13 }}>{b.notes}</div>
                </div>}
              </div>
            )}

            {history.length > 0 && (
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:7 }}>Payment History</div>
                {history.map((p,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"7px 10px", borderBottom:"1px solid var(--border)", fontSize:12 }}>
                    <div>
                      <div style={{ fontWeight:600 }}>{money(p.amount)} <span style={{ color:"var(--text3)", fontWeight:400 }}>via {p.method}</span></div>
                      <div style={{ fontSize:10, color:"var(--text3)" }}>{new Date(p.ts).toLocaleString()} {p.note ? "- "+p.note : ""}</div>
                    </div>
                    <div style={{ fontSize:10, color:"var(--text3)" }}>by {p.by}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display:"flex", gap:8, marginTop:14, justifyContent:"flex-end" }}>
              {b.status === "confirmed" && curRole === "admin" && (
                <button className="btn danger" style={{ marginRight:"auto", fontSize:12 }} onClick={cancelBooking}>
                  <i className="ti ti-calendar-x" /> Cancel
                </button>
              )}
              <button className="btn" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {tab === "payment" && (
          <div>
            <div style={{ background:"var(--navy)", color:"#fff", borderRadius:9, padding:"12px 16px", marginBottom:14, display:"flex", justifyContent:"space-around" }}>
              <div style={{ textAlign:"center" }}><div style={{ fontSize:10, opacity:.6 }}>Invoice Total</div><div style={{ fontSize:17, fontWeight:800 }}>{money(invoiceTotal)}</div></div>
              <div style={{ textAlign:"center" }}><div style={{ fontSize:10, opacity:.6 }}>Paid</div><div style={{ fontSize:17, fontWeight:800, color:"#6de8a8" }}>{money(totalPaid)}</div></div>
              <div style={{ textAlign:"center" }}><div style={{ fontSize:10, opacity:.6 }}>Balance</div><div style={{ fontSize:17, fontWeight:800, color: balance>0?"#f5a0a0":"#6de8a8" }}>{money(balance)}</div></div>
            </div>
            {balance <= 0 ? (
              <div style={{ textAlign:"center", padding:20, color:"var(--green)", fontWeight:700 }}><i className="ti ti-circle-check" style={{ fontSize:28 }} /><br />Fully Paid</div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group"><label>Amount (BDT) *</label><input type="number" value={payAmt} min="0" max={balance} onChange={e=>setPayAmt(e.target.value)} /></div>
                  <div className="form-group"><label>Method</label>
                    <select value={payMtd} onChange={e=>setPayMtd(e.target.value)}>
                      {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m=><option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                {needsTxn && <div className="form-group"><label>Transaction Number</label><input value={payTxn} onChange={e=>setPayTxn(e.target.value)} placeholder="01X-XXXXXXXXXX" /></div>}
                <div className="form-group"><label>Note</label><input value={payNote} onChange={e=>setPayNote(e.target.value)} placeholder="Optional note" /></div>
                <div className="modal-actions">
                  <button className="btn" onClick={onClose}>Cancel</button>
                  <button className="btn primary" onClick={collectPayment}><i className="ti ti-credit-card" /> Record Payment</button>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "extend" && b.status === "checked-in" && (
          <div>
            <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:16 }}>
              <div className="form-group" style={{ flex:1, margin:0 }}>
                <label>Extra Nights</label>
                <input type="number" value={extDays} min="1" max="30" onChange={e=>setExtDays(parseInt(e.target.value)||1)} />
              </div>
              <div style={{ flex:1, background:"var(--panel)", borderRadius:9, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text3)" }}>New Check-out</div>
                <div style={{ fontSize:16, fontWeight:800 }}>{newCo}</div>
              </div>
              <div style={{ flex:1, background:"var(--panel)", borderRadius:9, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text3)" }}>Additional Cost</div>
                <div style={{ fontSize:16, fontWeight:800, color:"var(--gold2)" }}>{money(extCost)}</div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={onClose}>Cancel</button>
              <button className="btn primary" onClick={extendStay}><i className="ti ti-calendar-plus" /> Extend Stay</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const FILTERS = ["all","confirmed","checked-in","checked-out","cancelled"];


// ─── New Booking Modal (full original form) ────────────────────────────────
function SMSSendModal({ booking, refName, refPhone, status, onClose }) {
  const { smsTemplates } = useApp();
  const [copied, setCopied] = useState("");

  const isCheckin = status === "checked-in";

  function fillTemplate(tpl, data) {
    return (tpl || "")
      .replace(/{guest}/g,    data.guest    || "")
      .replace(/{room}/g,     data.room     || "")
      .replace(/{checkin}/g,  data.checkin  || "")
      .replace(/{checkout}/g, data.checkout || "")
      .replace(/{nights}/g,   data.nights   || "")
      .replace(/{total}/g,    data.total    || "")
      .replace(/{advance}/g,  data.advance  || "")
      .replace(/{referrer}/g, data.referrer || "");
  }

  const data = {
    guest:    booking.guest,
    room:     "Rm " + booking.room,
    checkin:  booking.checkin,
    checkout: booking.checkout,
    nights:   String(booking.nights),
    total:    "৳" + (booking.amount || 0).toLocaleString(),
    advance:  "৳" + (booking.advance || 0).toLocaleString(),
    referrer: refName || "",
  };

  // Pick correct template based on what action was taken
  const guestTpl = isCheckin ? smsTemplates.checkin : smsTemplates.booking;
  const guestMsg = fillTemplate(guestTpl, data);
  const refMsg   = (refName || refPhone) ? fillTemplate(smsTemplates.referrer, data) : null;

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    }).catch(() => {});
  }

  const headerColor  = isCheckin ? "#1a7040" : "#2d1b69";
  const headerIcon   = isCheckin ? "ti-login"  : "ti-calendar-check";
  const headerLabel  = isCheckin ? "Check-in Welcome Message" : "Booking Confirmation Message";

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:520 }}>
        <div className="modal-header" style={{ background: headerColor, borderRadius:"10px 10px 0 0", margin:"-1px -1px 0" }}>
          <div className="modal-title" style={{ color:"#fff" }}>
            <i className={"ti "+headerIcon} style={{ color:"#E8C96A", marginRight:8 }} />
            {headerLabel}
          </div>
          <button className="modal-close" onClick={onClose} style={{ color:"#fff", opacity:.8 }}><i className="ti ti-x" /></button>
        </div>

        <div style={{ margin:"12px 0 10px", padding:"8px 12px", background:"#fffbee", border:"1px solid var(--gold)", borderRadius:8, fontSize:12, color:"#6b4a00", lineHeight:1.6 }}>
          <i className="ti ti-info-circle" style={{ marginRight:5, color:"var(--gold2)" }} />
          SMS API will send this automatically once connected. For now, copy and send manually.
        </div>

        {/* Guest message */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:800, color:"var(--navy)", marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>
            <i className="ti ti-user" style={{ color:"var(--gold)", marginRight:5 }} />
            To: {booking.guest} · {booking.phone}
          </div>
          <pre style={{ margin:0, padding:"12px 14px", background:"var(--bg4)", border:"1.5px solid var(--border)", borderRadius:9,
            fontFamily:"inherit", fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word", color:"var(--text)" }}>
            {guestMsg}
          </pre>
          <button onClick={() => copy(guestMsg, "guest")} className="btn" style={{ marginTop:8, width:"100%", justifyContent:"center",
            background: copied==="guest" ? "#1a7040" : undefined, color: copied==="guest" ? "#fff" : undefined }}>
            <i className={"ti "+(copied==="guest" ? "ti-check" : "ti-copy")} />
            {copied==="guest" ? "Copied!" : "Copy Message"}
          </button>
        </div>

        {/* Referrer message */}
        {refMsg && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"#6b0060", marginBottom:6, textTransform:"uppercase", letterSpacing:.5 }}>
              <i className="ti ti-heart-handshake" style={{ color:"#c050c0", marginRight:5 }} />
              To Referrer: {refName} · {refPhone}
            </div>
            <pre style={{ margin:0, padding:"12px 14px", background:"#fdf0ff", border:"1.5px solid #e0b3f5", borderRadius:9,
              fontFamily:"inherit", fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word", color:"#3a003a" }}>
              {refMsg}
            </pre>
            <button onClick={() => copy(refMsg, "ref")} className="btn" style={{ marginTop:8, width:"100%", justifyContent:"center",
              background: copied==="ref" ? "#1a7040" : undefined, color: copied==="ref" ? "#fff" : undefined }}>
              <i className={"ti "+(copied==="ref" ? "ti-check" : "ti-copy")} />
              {copied==="ref" ? "Copied!" : "Copy Referrer Message"}
            </button>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}><i className="ti ti-check" /> Done</button>
        </div>
      </div>
    </div>
  );
}

function NewBookingModal({ onClose, prefill }) {
  const { curUser, rooms, bookings, updateBookings, revenues, updateRevenues, notify, extraPersonRules } = useApp();
  const today = todayStr();
  const yesterday = addDaysIso(today, -1);
  const tmr   = addDaysIso(today, 1);

  // Guest — pre-fill from prefill prop if provided (Add Another Room)
  const [name,     setName]     = useState(prefill?.name     || "");
  const [phone,    setPhone]    = useState(prefill?.phone    || "");
  const [nat,      setNat]      = useState(prefill?.nat      || "");
  const [src,      setSrc]      = useState(prefill?.src      || "Walk-in");
  const [refName,  setRefName]  = useState(prefill?.refName  || "");
  const [refPhone, setRefPhone] = useState(prefill?.refPhone || "");
  // ID
  const [persons,  setPersons]  = useState([{ idType:"", idNum:"", front:[], back:[] }]);
  // Stay
  const [room,     setRoom]     = useState("");
  const [acChoice, setAcChoice] = useState("AC");
  const [ci,       setCi]       = useState(prefill?.ci || today);
  const [co,       setCo]       = useState(prefill?.co || tmr);
  // Extra rooms (multi-room booking)
  const [extraRooms, setExtraRooms] = useState([]); // [{ number, acChoice, discAmt }]
  const [primaryDiscAmt, setPrimaryDiscAmt] = useState(0); // per-room discount for primary room in multi-room mode
  // Multi-room mode
  const [bookingMode, setBookingMode] = useState("single"); // "single" | "multi"
  const [multiRoomCards, setMultiRoomCards] = useState([{ id:1, number:"", acChoice:"AC", ci:today, co:tmr, adults:2, children:0, discAmt:"" }]);
  const [adults,   setAdults]   = useState(2);
  const [children, setChildren] = useState(0);
  // Extra person
  const [epAccepted, setEpAccepted] = useState(false);
  // Discount
  const [discType, setDiscType] = useState("none");
  const [discVal,  setDiscVal]  = useState(0);
  const [discReason, setDiscReason] = useState("");
  // Payment
  const [method,   setMethod]   = useState("Cash");
  const [advance,  setAdvance]  = useState('');
  const [txnNum,   setTxnNum]   = useState("");
  const [payLater, setPayLater] = useState(false);
  const [notes,       setNotes]       = useState("");
  const [guestType,   setGuestType]   = useState("single"); // "single" | "couple" | "group"
  const [spouseName,  setSpouseName]  = useState("");
  const [groupMembers, setGroupMembers] = useState([{ name: "", phone: "" }]);
  const [smsData,     setSmsData]     = useState(null); // { booking, refName, refPhone }
  const [previewBkObj, setPreviewBkObj] = useState(null);

  const needsTxn = ["bKash","Nagad"].includes(method);
  const epThreshold = (extraPersonRules?.threshold) || 3;
  const epRate      = (extraPersonRules?.charge)    || 300;
  const epCount     = Math.max(0, parseInt(adults) - epThreshold);
  const epCharge    = epCount > 0 ? epCount * epRate : 0;

  const selRoom  = rooms.find(r => String(r.number) === String(room));
  const isDual   = !!(selRoom?.acRate && selRoom?.nonAcRate);
  const roomRate = isDual ? (acChoice === "AC" ? selRoom.acRate : selRoom.nonAcRate) : selRoom?.rate || 0;
  const nights   = ci && co && new Date(co) > new Date(ci)
    ? Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000)) : 0;
  const base     = selRoom && nights ? nights * roomRate : 0;

  const isMultiRoom = extraRooms.length > 0;

  // Extra rooms computed — each with its own per-room discount in multi-room mode
  const extraRoomsData = extraRooms.map(er => {
    const r = rooms.find(x => String(x.number) === String(er.number));
    if (!r) return null;
    const dual = !!(r.acRate && r.nonAcRate);
    const rate = dual ? (er.acChoice === "AC" ? r.acRate : r.nonAcRate) : r.rate || 0;
    const grossAmt = nights ? nights * rate : 0;
    const erDisc   = isMultiRoom ? Math.min(parseFloat(er.discAmt) || 0, grossAmt) : 0;
    const amt      = Math.max(0, grossAmt - erDisc);
    return { ...er, room: r, rate, grossAmt, discAmt: erDisc, amount: amt, isDual: dual };
  }).filter(Boolean);
  const extraRoomsTotal = extraRoomsData.reduce((s, r) => s + r.amount, 0);

  // ── Multi-room card computed data ──
  const multiRoomData = multiRoomCards.map(card => {
    const r = rooms.find(x => String(x.number) === String(card.number));
    if (!r) return { ...card, room: null, rate: 0, nights: 0, gross: 0, disc: 0, net: 0, isDual: false };
    const dual = !!(r.acRate && r.nonAcRate);
    const rate = dual ? (card.acChoice === "AC" ? r.acRate : r.nonAcRate) : r.rate || 0;
    const cardCi = card.ci || ci || today;
    const cardNights = cardCi && card.co && new Date(card.co) > new Date(cardCi)
      ? Math.round((new Date(card.co) - new Date(cardCi)) / 86400000) : 0;
    const gross = cardNights * rate;
    const disc = Math.min(parseFloat(card.discAmt) || 0, gross);
    const net = Math.max(0, gross - disc);
    return { ...card, ci: cardCi, room: r, isDual: dual, rate, nights: cardNights, gross, disc, net };
  });
  const multiTotal = multiRoomData.reduce((s, c) => s + c.net, 0);
  const multiAdv = Math.min(parseFloat(advance) || 0, multiTotal);
  const multiBalance = Math.max(0, multiTotal - multiAdv);

  // In multi-room mode: each room has its own discount; combined discount is for single-room only
  const primaryDisc  = isMultiRoom ? Math.min(parseFloat(primaryDiscAmt) || 0, base) : 0;
  const primaryNet   = isMultiRoom ? Math.max(0, base - primaryDisc) : base;
  const combinedBase = isMultiRoom ? primaryNet + extraRoomsTotal : base + extraRoomsData.reduce((s,r)=>s+r.grossAmt,0);

  function calcDiscount(b) {
    if (isMultiRoom) return 0; // single combined discount disabled in multi-room mode
    const dv = parseFloat(discVal) || 0;
    if (discType === "percent")     return Math.round(b * dv / 100);
    if (discType === "flat")        return Math.min(dv, b);
    if (discType === "fixed-rate" && dv > 0) return Math.max(0, b - nights * dv * (1 + extraRoomsData.length));
    return 0;
  }
  const discAmt   = isMultiRoom ? (primaryDisc + extraRoomsData.reduce((s,r)=>s+r.discAmt,0)) : calcDiscount(combinedBase);
  const roomTotal = isMultiRoom ? (primaryNet + extraRoomsTotal) : Math.max(0, combinedBase - discAmt);
  const epAmt     = epAccepted ? epCharge : 0;
  const grand     = roomTotal + epAmt;
  const adv       = Math.min(parseFloat(advance) || 0, grand);
  const balance   = Math.max(0, grand - adv);

  // available rooms for selected dates
  const availRooms = rooms.filter(r => {
    if (!ci || !co) return true;
    return !bookingConflicts(r.number, ci, co, null, bookings);
  });

  function handlePhotoUpload(idx, side, files) {
    const fileArr = Array.from(files || []);
    if (!fileArr.length) return;
    const oversized = fileArr.find(f => f.size > 5 * 1024 * 1024);
    if (oversized) { notify("Max 5MB per file", "error"); return; }
    const readers = fileArr.map(file => new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    }));
    Promise.all(readers).then(results => {
      setPersons(prev => prev.map((p, i) => i === idx ? { ...p, [side]: [...(p[side]||[]), ...results] } : p));
    });
  }

  function removePhoto(personIdx, side, photoIdx) {
    setPersons(prev => prev.map((p, i) => i === personIdx
      ? { ...p, [side]: (p[side]||[]).filter((_,j) => j !== photoIdx) }
      : p
    ));
  }

  function updatePersonField(idx, field, value) {
    setPersons(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function addPerson() {
    setPersons(prev => [...prev, { idType:"", idNum:"", front: [], back: [] }]);
  }
  function removePerson(idx) {
    setPersons(prev => prev.filter((_, i) => i !== idx));
  }

  function buildAndValidate() {
    if (!name.trim())  { notify("Guest name required", "error"); return null; }
    if (!phone.trim()) { notify("Phone required", "error"); return null; }
    if (!selRoom)      { notify("Select a room", "error"); return null; }
    if (!nights)       { notify("Check-out must be after check-in", "error"); return null; }
    if ((parseFloat(advance) || 0) <= 0 && !payLater) { notify("Enter payment amount or select Pay Later", "error"); return null; }
    if (bookingConflicts(selRoom.number, ci, co, null, bookings)) {
      notify(`Room ${selRoom.number} is already booked for those dates`, "error"); return null;
    }
    for (const er of extraRoomsData) {
      if (bookingConflicts(er.number, ci, co, null, bookings)) {
        notify(`Room ${er.number} is already booked for those dates`, "error"); return null;
      }
    }
    const id  = maxId(bookings);
    const rn  = refName.trim();
    const rph = refPhone.trim();
    const a   = adv;
    const t   = needsTxn ? txnNum.trim() : "";
    return {
      id, guest: name.trim(), phone: phone.trim(), email: "",
      room: selRoom.number, type: selRoom.type,
      checkin: ci, checkout: co, nights,
      amount: grand, baseAmount: combinedBase,
      invoiceTotal: grand,
      acChoice: isDual ? acChoice : undefined, roomRate,
      extraRooms: extraRoomsData.map(r => ({
        number: r.number, type: r.room.type, name: r.room.name,
        acChoice: r.acChoice, rate: r.rate, grossAmt: r.grossAmt,
        discAmt: r.discAmt, amount: r.amount, isDual: r.isDual,
      })),
      discType: isMultiRoom ? "flat" : discType,
      discAmt, discReason: discReason.trim(),
      primaryDiscAmt: isMultiRoom ? primaryDisc : 0,
      notes: notes.trim(),
      source: src, referredByName: rn, referredByPhone: rph, referredBy: rn || rph,
      nationality: nat.trim(),
      idType: persons[0]?.idType || "",
      idNum: (persons[0]?.idNum || "").trim(),
      idFront: (persons[0]?.front||[])[0] || "", idBack: (persons[0]?.back||[])[0] || "",
      idDocs: persons.filter(p => (p.front||[]).length || (p.back||[]).length || p.idNum),
      adults: parseInt(adults) || 2, children: parseInt(children) || 0,
      advance: a, paymentMethod: method, txnNumber: t, transactionNumber: t,
      restPayment: 0, dueAmount: Math.max(0, grand - a),
      paymentHistory: a > 0 ? [{ ts: new Date().toISOString(), amount: a, method, txnNumber: t, note: "Advance paid", type: "room", by: curUser || "staff" }] : [],
      extraPersonCharge: (epAccepted && epCharge > 0) ? { qty: epCount, rate: epRate, total: epCharge } : null,
      guestType: guestType || "single",
      spouseName: guestType === "couple" ? spouseName.trim() : "",
      groupMembers: guestType === "group" ? groupMembers.filter(m=>m.name.trim()||m.phone.trim()) : [],
      createdAt: new Date().toISOString(), by: curUser || "staff",
    };
  }

  function buildAndValidateMulti() {
    if (!name.trim())  { notify("Guest name required", "error"); return null; }
    if (!phone.trim()) { notify("Phone required", "error"); return null; }
    if (multiRoomData.length === 0) { notify("Add at least one room", "error"); return null; }
    for (const c of multiRoomData) {
      if (!c.room) { notify("Select a room for each card", "error"); return null; }
      if (!c.nights) { notify("Check-out must be after check-in for each room", "error"); return null; }
      if (bookingConflicts(c.number, c.ci, c.co, null, bookings)) {
        notify(`Room ${c.number} is already booked for those dates`, "error"); return null;
      }
    }
    // Check for duplicate room numbers within the booking
    const nums = multiRoomData.map(c => String(c.number));
    if (new Set(nums).size !== nums.length) { notify("Each room can only be added once", "error"); return null; }
    if ((parseFloat(advance) || 0) <= 0 && !payLater) { notify("Enter payment amount or select Pay Later", "error"); return null; }

    const id = maxId(bookings);
    const a  = multiAdv;
    const t  = needsTxn ? txnNum.trim() : "";
    const minCi = multiRoomData.reduce((mn, c) => c.ci < mn ? c.ci : mn, multiRoomData[0].ci);
    const maxCo = multiRoomData.reduce((mx, c) => c.co > mx ? c.co : mx, "");
    const maxNights = multiRoomData.reduce((mx, c) => c.nights > mx ? c.nights : mx, 0);
    const totalDisc = multiRoomData.reduce((s, c) => s + c.disc, 0);
    return {
      id, guest: name.trim(), phone: phone.trim(), email: "",
      room: multiRoomData[0].number,
      type: multiRoomData[0].room?.type || "",
      checkin: minCi, checkout: maxCo, nights: maxNights,
      amount: multiTotal, baseAmount: multiTotal, invoiceTotal: multiTotal,
      isMultiRoomBooking: true,
      multiRooms: multiRoomData.map(c => ({
        number: c.number, type: c.room.type, name: c.room.name,
        acChoice: c.isDual ? c.acChoice : undefined,
        rate: c.rate, nights: c.nights, checkin: c.ci, checkout: c.co,
        grossAmt: c.gross, discAmt: c.disc, amount: c.net,
        adults: parseInt(c.adults) || 0, children: parseInt(c.children) || 0,
        isDual: c.isDual,
      })),
      discType: "flat", discAmt: totalDisc, discReason: "",
      primaryDiscAmt: 0, extraRooms: [],
      notes: notes.trim(), source: src,
      referredByName: refName.trim(), referredByPhone: refPhone.trim(), referredBy: refName.trim() || refPhone.trim(),
      nationality: nat.trim(),
      idType: "", idNum: "", idFront: "", idBack: "", idDocs: [],
      adults: multiRoomData.reduce((s, c) => s + (parseInt(c.adults) || 0), 0),
      children: multiRoomData.reduce((s, c) => s + (parseInt(c.children) || 0), 0),
      advance: a, paymentMethod: method, txnNumber: t, transactionNumber: t,
      restPayment: 0, dueAmount: Math.max(0, multiTotal - a),
      paymentHistory: a > 0 ? [{ ts: new Date().toISOString(), amount: a, method, txnNumber: t, note: "Advance paid", type: "room", by: curUser || "staff" }] : [],
      guestType: guestType || "single", spouseName: "", groupMembers: [],
      createdAt: new Date().toISOString(), by: curUser || "staff",
    };
  }

  function performSave(bkObj, status) {
    const finalBk = { ...bkObj, status };
    updateBookings([...bookings, finalBk]);
    void persistHotelBookingBundle(finalBk)
      .then(({ guest, booking }) => {
        if (!booking) return;
        updateBookings((prev) =>
          prev.map((x) =>
            x.id === finalBk.id
              ? {
                  ...x,
                  guest_id: guest?.id ?? x.guest_id,
                  supabaseBookingId: booking.id ?? x.supabaseBookingId ?? x.dbBookingId ?? null,
                  restPayment: booking.rest_payment ?? x.restPayment ?? 0,
                  dueAmount: booking.due_amount ?? x.dueAmount ?? 0,
                  transactionNumber: booking.transaction_number ?? x.transactionNumber ?? x.txnNumber ?? "",
                  txnNumber: booking.transaction_number ?? x.txnNumber ?? x.transactionNumber ?? "",
                }
              : x,
          ),
        );
      })
      .catch((err) => {
        console.error("Failed to sync hotel booking to Supabase:", err);
        notify("Booking saved locally, but Supabase sync failed", "error");
      });
    sendWhatsAppAlert(buildHotelWaMessage(finalBk)).catch(() => {});
    sendNtfyAlert(
      `🏨 New Hotel Booking — ${finalBk.guest}`,
      `Room: ${finalBk.room}\nCheck-in: ${finalBk.checkin}\nCheck-out: ${finalBk.checkout}\nNights: ${finalBk.nights}\nTotal: ৳${(finalBk.amount||0).toLocaleString()}\nAdvance: ৳${(finalBk.advance||0).toLocaleString()}`
    ).catch(() => {});
    if (finalBk.advance > 0) updateRevenues(prev => [...prev, {
      id: maxId(prev), source: "Room Rent", amount: finalBk.advance, date: today,
      note: finalBk.guest + " Rm " + finalBk.room + (status === "confirmed" ? " — reservation deposit" : " — advance payment") + " (" + finalBk.paymentMethod + ")",
      bookingId: finalBk.id }]);
    const _disc = finalBk.isMultiRoomBooking ? (finalBk.multiRooms||[]).reduce((s,r)=>s+(r.discAmt||0),0) : (finalBk.discAmt ?? discAmt);
    const _total = finalBk.isMultiRoomBooking ? (finalBk.invoiceTotal ?? finalBk.amount ?? 0) : (finalBk.invoiceTotal ?? roomTotal);
    notify(finalBk.guest + (status === "checked-in" ? " checked in ✓" : " booking saved") + (_disc > 0 ? " · Discount " + money(_disc) : ""), "success");
    logEvent("hotel", status === "checked-in" ? "booking_checked_in" : "booking_created",
      { num: String(finalBk.id), guest: finalBk.guest, amount: _total, note: `Rm ${finalBk.room}${_disc > 0 ? ` · Discount ৳${_disc}` : ""}` }, curUser);
    if (status === "checked-in") {
      const tcEnabled = localStorage.getItem("ga_tc_enabled") !== "false";
      const willPrintTC = tcEnabled && !finalBk.tcPrinted;
      if (willPrintTC) {
        updateBookings(prev => prev.map(x => x.id === finalBk.id ? { ...x, tcPrinted: true } : x));
      }
      const invHtml = buildInvoiceHTML(finalBk, rooms, [], "room");
      const tcHtml  = willPrintTC ? buildTCHtml(finalBk) : null;
      hotelPrint(invHtml, tcHtml);
    }
    setSmsData({ booking: finalBk, refName: refName.trim(), refPhone: refPhone.trim(), status });
  }

  function doSave(status) {
    const bkObj = buildAndValidate();
    if (!bkObj) return;
    performSave(bkObj, status);
  }

  const SOURCES     = ["Walk-in","Phone","Website","WhatsApp","OTA","Referral"];
  const ID_TYPES    = ["National ID (NID)","Passport","Driving License","Birth Certificate","Marriage Certificate","Student ID","Other"];
  const PAY_METHODS = ["Cash","bKash","Nagad","Card","Bank Transfer"];

  return (
    <>
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && !smsData && onClose()}>
      <div className="modal-box" style={{ maxWidth:1080, width:"96vw", maxHeight:"94vh", overflowY:"auto" }}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title"><i className="ti ti-calendar-plus" style={{ color:"var(--gold)", marginRight:6 }} />New Booking</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {/* ── BOOKING MODE TOGGLE ── */}
        <div style={{ display:"flex", gap:0, marginBottom:14, borderRadius:10, overflow:"hidden", border:"2px solid var(--navy)" }}>
          {[["single","🛏  Single Room"],["multi","🛏🛏  Multiple Rooms"]].map(([mode,label]) => (
            <button key={mode} type="button" onClick={() => setBookingMode(mode)} style={{
              flex:1, padding:"12px 0", border:"none", cursor:"pointer",
              fontWeight:800, fontSize:13, fontFamily:"inherit", transition:"all .15s",
              background: bookingMode===mode ? "var(--navy)" : "var(--bg3)",
              color: bookingMode===mode ? "#fff" : "var(--text2)",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:0 }}>

          {/* STEP 1 — DATES (single room only) */}
          {bookingMode === "single" && <div className="form-section" style={{ background:"linear-gradient(135deg,#2D1B69,#4a2ea8)", borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
            <div style={{ color:"#c9a84c", fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Step 1 — When?</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, alignItems:"end" }}>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label style={{ color:"rgba(255,255,255,.7)", fontSize:11 }}>Check-in *</label>
                <DateInput value={ci} min={yesterday}
                  onChange={e=>{ setCi(e.target.value); setCo(addDaysIso(e.target.value,1)); }}
                  style={{ fontWeight:800, fontSize:15 }} />
                {ci && <div style={{ color:"rgba(255,255,255,.6)", fontSize:11, marginTop:3 }}>{new Date(ci+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long"})}</div>}
              </div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label style={{ color:"rgba(255,255,255,.7)", fontSize:11 }}>Check-out *</label>
                <DateInput value={co} min={ci ? addDaysIso(ci,1) : addDaysIso(today,1)}
                  onChange={e=>setCo(e.target.value)}
                  style={{ fontWeight:800, fontSize:15 }} />
                {co && <div style={{ color:"rgba(255,255,255,.6)", fontSize:11, marginTop:3 }}>{new Date(co+"T00:00:00").toLocaleDateString("en-GB",{weekday:"long"})}</div>}
              </div>
              <div style={{ background:"rgba(255,255,255,.1)", borderRadius:8, padding:"10px 14px", textAlign:"center" }}>
                <div style={{ color:"rgba(255,255,255,.6)", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>Nights</div>
                <div style={{ color:"#c9a84c", fontSize:24, fontWeight:900, lineHeight:1.1 }}>{nights || "—"}</div>
              </div>
            </div>
          </div>}

          {/* STEP 2 — ROOM */}
          <div className="form-section" style={{ border:"2px solid var(--navy)", borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
            <div style={{ color:"var(--navy)", fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Step 2 — Which Room?</div>
            {bookingMode === "multi" ? (<>
              {/* Multi-room: room cards shown directly — no date pre-check needed */}
            </>) : (!ci || !co || !nights) ? (
              <div style={{ color:"var(--text3)", fontSize:13, padding:"12px 0", textAlign:"center", opacity:.6 }}>
                <i className="ti ti-calendar" style={{ marginRight:6 }} />Set check-in and check-out dates first
              </div>
            ) : (<>
              <div className="form-group" style={{ marginBottom:10 }}>
                <label>Room * <span style={{ color:"var(--green)", fontSize:11, fontWeight:600 }}>— showing available rooms for selected dates</span></label>
                <select value={room} onChange={e=>{ setRoom(e.target.value); setAcChoice("AC"); }} style={{ fontWeight:700 }}>
                  <option value="">Select a room...</option>
                  {availRooms.map(r=>(
                    <option key={r.number} value={r.number}>
                      {r.number}{r.name?" — "+r.name:""} · {r.type}{r.acRate&&r.nonAcRate?" · AC ৳"+r.acRate+"/Non-AC ৳"+r.nonAcRate:" · ৳"+r.rate.toLocaleString()}/n
                    </option>
                  ))}
                </select>
              </div>
              {isDual && (
                <div className="form-group" style={{ marginBottom:10 }}>
                  <label><i className="ti ti-wind" style={{ color:"var(--navy)", marginRight:4 }} />AC or Non-AC? *</label>
                  <div style={{ display:"flex", gap:10, marginTop:4 }}>
                    {["AC","Non-AC"].map(opt=>(
                      <button key={opt} type="button" onClick={()=>setAcChoice(opt)} style={{
                        flex:1, padding:"10px 0", borderRadius:9, border:"2px solid", cursor:"pointer",
                        fontWeight:800, fontSize:13, fontFamily:"inherit", transition:"all .15s",
                        background: acChoice===opt ? "var(--navy)" : "var(--bg3)",
                        color:      acChoice===opt ? "#fff" : "var(--text2)",
                        borderColor: acChoice===opt ? "var(--navy)" : "var(--border)",
                      }}>
                        {opt==="AC" ? "❄️ AC" : "🌬️ Non-AC"}
                        <div style={{ fontSize:10, fontWeight:600, opacity:.8, marginTop:2 }}>
                          ৳{opt==="AC" ? selRoom.acRate.toLocaleString() : selRoom.nonAcRate.toLocaleString()}/night
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Multi-room: primary room discount */}
              {isMultiRoom && selRoom && (
                <div style={{ background:"#f0f7ff", border:"1.5px solid #a8c8f0", borderRadius:9, padding:"10px 14px", marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:"#1a5a8a", marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>Primary Room — Rm {selRoom.number}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:13 }}>
                    <span style={{ fontWeight:700, flex:1 }}>{selRoom.name || selRoom.type} · ৳{base.toLocaleString()}</span>
                    <label style={{ fontSize:11, color:"#555", whiteSpace:"nowrap" }}>Discount ৳</label>
                    <input type="number" min="0" max={base} value={primaryDiscAmt||""} placeholder="0"
                      onWheel={e=>e.target.blur()}
                      onChange={e=>setPrimaryDiscAmt(e.target.value)}
                      style={{ width:90, padding:"4px 8px", borderRadius:6, border:"1.5px solid #a8c8f0", fontSize:13, fontWeight:700, textAlign:"right" }} />
                    {primaryDisc > 0 && <span style={{ color:"#1a7040", fontWeight:800, fontSize:12 }}>= ৳{primaryNet.toLocaleString()}</span>}
                  </div>
                </div>
              )}

              {/* Extra Rooms */}
              {extraRoomsData.length > 0 && (
                <div style={{ background:"#f8f4ff", border:"1.5px solid #c4a8f0", borderRadius:9, padding:"10px 14px", marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:800, color:"#5a2ea8", marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>Additional Rooms</div>
                  {extraRoomsData.map((er, i) => (
                    <div key={i} style={{ marginBottom: i < extraRoomsData.length-1 ? 10 : 0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13 }}>
                        <span style={{ fontWeight:700 }}>Rm {er.number}</span>
                        <span style={{ color:"#666" }}>— {er.room.name || er.room.type}</span>
                        {er.isDual && (
                          <select value={er.acChoice} onChange={e => setExtraRooms(prev => prev.map((x,j) => j===i ? {...x, acChoice: e.target.value} : x))}
                            style={{ fontSize:11, padding:"2px 6px", borderRadius:6, border:"1px solid #ccc" }}>
                            <option value="AC">AC ৳{er.room.acRate?.toLocaleString()}</option>
                            <option value="Non-AC">Non-AC ৳{er.room.nonAcRate?.toLocaleString()}</option>
                          </select>
                        )}
                        <span style={{ marginLeft:"auto", fontWeight:700, color:"#5a2ea8" }}>৳{er.grossAmt.toLocaleString()}</span>
                        <button type="button" onClick={() => { setExtraRooms(prev => prev.filter((_,j) => j!==i)); }}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"#c0392b", fontSize:16, padding:"0 4px" }}>✕</button>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:5, paddingLeft:4 }}>
                        <label style={{ fontSize:11, color:"#555" }}>Discount ৳</label>
                        <input type="number" min="0" max={er.grossAmt} value={er.discAmt||""} placeholder="0"
                          onWheel={e=>e.target.blur()}
                          onChange={e => setExtraRooms(prev => prev.map((x,j) => j===i ? {...x, discAmt: e.target.value} : x))}
                          style={{ width:90, padding:"4px 8px", borderRadius:6, border:"1.5px solid #c4a8f0", fontSize:13, fontWeight:700, textAlign:"right" }} />
                        {(parseFloat(er.discAmt)||0) > 0 && (
                          <span style={{ fontSize:12, color:"#1a7040", fontWeight:800 }}>= ৳{er.amount.toLocaleString()} after discount</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {room && (
                <select value="" onChange={e => {
                  const num = e.target.value; if (!num) return;
                  if (String(num) === String(room)) { notify("Already the primary room","error"); return; }
                  if (extraRooms.find(x => String(x.number) === String(num))) { notify("Room already added","error"); return; }
                  setExtraRooms(prev => [...prev, { number: num, acChoice: "AC" }]);
                }} style={{ width:"100%", padding:"9px 12px", borderRadius:8, border:"1.5px dashed #c4a8f0", background:"#f8f4ff", color:"#5a2ea8", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                  <option value="">+ Add Another Room to this Booking</option>
                  {availRooms.filter(r => String(r.number) !== String(room) && !extraRooms.find(x => String(x.number) === String(r.number))).map(r => (
                    <option key={r.number} value={r.number}>
                      Rm {r.number} — {r.name || r.type} {r.acRate&&r.nonAcRate ? `· AC ৳${r.acRate}/Non-AC ৳${r.nonAcRate}` : `· ৳${r.rate?.toLocaleString()}`}
                    </option>
                  ))}
                </select>
              )}
            </>)}
            {bookingMode === "multi" && (<>
              {/* ── MULTI-ROOM CARDS ── */}
              {multiRoomData.map((card, idx) => {
                const cardAvail = rooms.filter(r => {
                  const num = String(r.number);
                  if (num === String(card.number)) return true;
                  if (multiRoomCards.some((c,j) => j!==idx && String(c.number)===num)) return false;
                  if (!card.ci || !card.co) return true;
                  return !bookingConflicts(r.number, card.ci, card.co, null, bookings);
                });
                return (
                <div key={card.id} style={{ border:"2px solid var(--navy)", borderRadius:12, padding:"14px 16px", marginBottom:10, background:"var(--bg4)" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                    <span style={{ fontSize:12, fontWeight:800, color:"var(--navy)", textTransform:"uppercase", letterSpacing:1 }}>Room {idx+1}</span>
                    {multiRoomCards.length > 1 && (
                      <button type="button" onClick={() => setMultiRoomCards(prev => prev.filter((_,j) => j!==idx))}
                        style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:7, padding:"3px 10px", color:"#c0392b", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  {/* Check-in / Check-out / Room select row */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 2fr", gap:10, marginBottom:10 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:11 }}>Check-in *</label>
                      <DateInput value={card.ci} min={yesterday}
                        onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, ci:e.target.value, co: c.co <= e.target.value ? addDaysIso(e.target.value,1) : c.co} : c))} />
                      {card.ci && <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>{new Date(card.ci+"T00:00:00").toLocaleDateString("en-GB",{weekday:"short"})}</div>}
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:11 }}>Check-out *</label>
                      <DateInput value={card.co} min={card.ci ? addDaysIso(card.ci,1) : addDaysIso(today,1)}
                        onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, co:e.target.value} : c))} />
                      {card.nights > 0 && <div style={{ fontSize:10, color:"var(--text3)", marginTop:2 }}>{card.nights} night{card.nights!==1?"s":""}</div>}
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:11 }}>Select Room *</label>
                      <select value={card.number} onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, number:e.target.value, acChoice:"AC"} : c))} style={{ fontWeight:700 }}>
                        <option value="">Choose a room...</option>
                        {cardAvail.map(r => (
                          <option key={r.number} value={r.number}>
                            Rm {r.number}{r.name?" — "+r.name:""} · {r.type}{r.acRate&&r.nonAcRate?` · AC ৳${r.acRate}/Non-AC ৳${r.nonAcRate}`:`· ৳${r.rate?.toLocaleString()}/n`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {card.isDual && card.room && (
                    <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                      {["AC","Non-AC"].map(opt => (
                        <button key={opt} type="button"
                          onClick={() => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, acChoice:opt} : c))}
                          style={{ flex:1, padding:"9px 0", borderRadius:8, border:"2px solid", cursor:"pointer",
                            fontWeight:800, fontSize:12, fontFamily:"inherit", transition:"all .15s",
                            background: card.acChoice===opt ? "var(--navy)" : "var(--bg3)",
                            color:      card.acChoice===opt ? "#fff" : "var(--text2)",
                            borderColor: card.acChoice===opt ? "var(--navy)" : "var(--border)" }}>
                          {opt==="AC" ? "❄️ AC" : "🌬️ Non-AC"}
                          <div style={{ fontSize:10, fontWeight:600, opacity:.8, marginTop:2 }}>
                            ৳{opt==="AC" ? card.room.acRate?.toLocaleString() : card.room.nonAcRate?.toLocaleString()}/night
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:8 }}>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:11 }}>Adults</label>
                      <input type="number" min={1} max={20} value={card.adults} onWheel={e=>e.target.blur()}
                        onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, adults:e.target.value} : c))}
                        style={{ textAlign:"center", fontWeight:800 }} />
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:11 }}>Children</label>
                      <input type="number" min={0} max={15} value={card.children} onWheel={e=>e.target.blur()}
                        onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, children:e.target.value} : c))}
                        style={{ textAlign:"center" }} />
                    </div>
                    <div className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:11 }}>Discount (৳)</label>
                      <input type="number" min={0} value={card.discAmt||""} placeholder="0" onWheel={e=>e.target.blur()}
                        onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, discAmt:e.target.value} : c))}
                        style={{ textAlign:"right", fontWeight:700 }} />
                    </div>
                  </div>
                  {card.room && card.nights > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"var(--navy)", color:"#fff", borderRadius:8, fontSize:13 }}>
                      <span style={{ opacity:.7 }}>{card.nights}n × ৳{card.rate.toLocaleString()}{card.disc>0 ? ` − ৳${card.disc.toLocaleString()} disc` : ""}</span>
                      <span style={{ fontWeight:900, fontSize:16, color:"#c9a84c" }}>৳{card.net.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                );
              })}
              <button type="button" onClick={() => setMultiRoomCards(prev => [...prev, { id:Date.now(), number:"", acChoice:"AC", ci:today, co:addDaysIso(today,1), adults:2, children:0, discAmt:"" }])}
                style={{ width:"100%", padding:"11px 0", border:"2px dashed #c4a8f0", borderRadius:10, background:"#f8f4ff", color:"#5a2ea8", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                + Add Another Room
              </button>
            </>)}
          </div>

          {/* STEP 3 — GUEST DETAILS */}
          <div className="form-section" style={{ border:"1.5px solid var(--border)", borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
            <div style={{ color:"var(--text3)", fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Step 3 — Guest Details</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div className="form-group" style={{ marginBottom:0 }}><label>Full Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="As per ID" autoFocus /></div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Phone *</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+880..." /></div>
              <div className="form-group" style={{ marginBottom:0 }}>
                <label>Guest Type</label>
                <select value={guestType} onChange={e=>{
                  setGuestType(e.target.value);
                  if(e.target.value!=="couple") setSpouseName("");
                  if(e.target.value!=="group") setGroupMembers([{ name:"", phone:"" }]);
                }}>
                  <option value="single">Single / Family</option>
                  <option value="couple">Couple</option>
                  <option value="group">Group</option>
                </select>
              </div>
              {guestType === "couple" && (
                <div className="form-group" style={{ marginBottom:0 }}>
                  <label>Spouse / Wife Name</label>
                  <input value={spouseName} onChange={e=>setSpouseName(e.target.value)} placeholder="As per ID" />
                </div>
              )}
            </div>
            {guestType === "group" && (
              <div style={{ marginTop:12, border:"1.5px solid #c4a8f0", borderRadius:9, padding:"12px 14px", background:"#f8f4ff" }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#5a2ea8", marginBottom:10, textTransform:"uppercase", letterSpacing:.5 }}>
                  👥 Group Members (other than main guest)
                </div>
                {groupMembers.map((m, i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:7, alignItems:"center" }}>
                    <input
                      value={m.name}
                      onChange={e => setGroupMembers(prev => prev.map((x,j) => j===i ? {...x, name:e.target.value} : x))}
                      placeholder={`Member ${i+1} name`}
                      style={{ flex:1, fontSize:13 }}
                    />
                    <input
                      value={m.phone}
                      onChange={e => setGroupMembers(prev => prev.map((x,j) => j===i ? {...x, phone:e.target.value} : x))}
                      placeholder="Mobile number"
                      style={{ flex:1, fontSize:13 }}
                    />
                    {groupMembers.length > 1 && (
                      <button type="button" onClick={() => setGroupMembers(prev => prev.filter((_,j) => j!==i))}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#c0392b", fontSize:18, lineHeight:1, padding:"0 4px" }}>✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setGroupMembers(prev => [...prev, { name:"", phone:"" }])}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", border:"1.5px dashed #c4a8f0", borderRadius:7, background:"transparent", color:"#5a2ea8", fontSize:12, fontWeight:700, cursor:"pointer", marginTop:2 }}>
                  + Add Member
                </button>
              </div>
            )}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop: guestType === "group" ? 12 : 0 }}>
              <div className="form-group" style={{ marginBottom:0 }}><label>Adults</label><input type="number" value={adults} min={1} max={20} onChange={e=>{ setAdults(e.target.value); setEpAccepted(false); }} style={{ textAlign:"center", fontWeight:800 }} /></div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Children</label><input type="number" value={children} min={0} max={15} onChange={e=>setChildren(e.target.value)} style={{ textAlign:"center" }} /></div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Nationality</label><input value={nat} onChange={e=>setNat(e.target.value)} placeholder="Bangladeshi" /></div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Source</label>
                <select value={src} onChange={e=>setSrc(e.target.value)}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Referred by — Name</label><input value={refName} onChange={e=>setRefName(e.target.value)} placeholder="Referrer name" /></div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Referred by — Phone</label><input value={refPhone} onChange={e=>setRefPhone(e.target.value)} placeholder="Referrer phone" /></div>
            </div>
            {epCharge > 0 && !epAccepted && (
              <div style={{ border:"1.5px solid var(--gold)", borderRadius:9, padding:"12px 14px", background:"#fffbee", marginTop:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#7a5500", marginBottom:8 }}>
                  Extra person charge: {epCount} person{epCount>1?"s":""} × ৳{epRate.toLocaleString()} = <strong>৳{epCharge.toLocaleString()}</strong>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn primary sm" onClick={()=>setEpAccepted(true)}>Accept Charge</button>
                  <button className="btn sm" onClick={()=>setAdults(epThreshold)}>Reduce to {epThreshold}</button>
                </div>
              </div>
            )}
            {epAccepted && epCharge > 0 && (
              <div style={{ fontSize:12, fontWeight:700, color:"var(--green)", padding:"8px 12px", background:"#f0fdf4", borderRadius:8, marginTop:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span>✓ Extra person charge accepted: +৳{epCharge.toLocaleString()}</span>
                <button className="btn sm" onClick={()=>{ setEpAccepted(false); setAdults(epThreshold); }} style={{ fontSize:10 }}>Remove</button>
              </div>
            )}
          </div>

          {/* STEP 4 — ID VERIFICATION */}
          <div className="form-section" style={{ border:"1.5px solid var(--border)", borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
            <div style={{ color:"var(--text3)", fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Step 4 — ID Verification</div>
            {persons.map((p, idx) => (
              <div key={idx} style={{ border:"1px solid var(--border)", borderRadius:8, padding:"10px 12px", marginBottom:8, background:"var(--bg4)" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.5 }}>
                    <i className="ti ti-user" style={{ color:"var(--gold)", marginRight:4 }} />Person {idx+1}
                  </div>
                  {idx > 0 && <button type="button" onClick={()=>removePerson(idx)} style={{ border:"none", background:"transparent", color:"var(--red2)", cursor:"pointer", fontSize:11, fontWeight:700 }}><i className="ti ti-x" /> Remove</button>}
                </div>
                <div className="form-row" style={{ marginBottom:8 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:10 }}>ID Type</label>
                    <select value={p.idType||""} onChange={e=>updatePersonField(idx,"idType",e.target.value)} style={{ fontSize:12, padding:"5px 8px" }}>
                      <option value="">Select</option>
                      {ID_TYPES.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:10 }}>ID Number</label>
                    <input value={p.idNum||""} onChange={e=>updatePersonField(idx,"idNum",e.target.value)} placeholder="Document number" style={{ fontSize:12, padding:"5px 8px" }} />
                  </div>
                </div>
                <div className="form-row">
                  {["front","back"].map(side => (
                    <div key={side} className="form-group" style={{ marginBottom:0 }}>
                      <label style={{ fontSize:10 }}>{side === "front" ? "Front Side" : "Back Side"}</label>
                      {(p[side]||[]).length > 0 && (
                        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                          {(p[side]||[]).map((src, pi) => (
                            <div key={pi} style={{ position:"relative" }}>
                              <img src={src} alt="id" style={{ width:52, height:42, borderRadius:5, objectFit:"cover", border:"1.5px solid var(--gold)" }} />
                              <button type="button" onClick={()=>removePhoto(idx,side,pi)} style={{ position:"absolute", top:-5, right:-5, width:16, height:16, borderRadius:"50%", background:"#C62828", color:"#fff", border:"none", fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, lineHeight:1 }}>×</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, padding:"10px 8px", border:"1.5px dashed var(--border)", borderRadius:8, cursor:"pointer", background:"var(--bg3)", minHeight:52, textAlign:"center", borderColor:(p[side]||[]).length ? "var(--gold)" : "var(--border)" }}>
                        <i className="ti ti-camera-plus" style={{ fontSize:16, color:"var(--text3)" }} />
                        <span style={{ fontSize:10, color:"var(--text3)" }}>{(p[side]||[]).length ? "Add more" : "Upload photos"}</span>
                        <input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e=>handlePhotoUpload(idx,side,e.target.files)} />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={addPerson} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, width:"100%", padding:"9px 16px", border:"2px dashed var(--gold)", borderRadius:8, background:"var(--gold4)", color:"var(--gold)", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              <i className="ti ti-user-plus" style={{ fontSize:15 }} /> Add Another Person's ID
            </button>
          </div>

          {/* STEP 5 — PRICING & DISCOUNT */}
          <div className="form-section" style={{ border:"1.5px solid var(--border)", borderRadius:12, padding:"16px 18px", marginBottom:12 }}>
            <div style={{ color:"var(--text3)", fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", marginBottom:10 }}>Step 5 — {bookingMode==="multi" ? "Price Summary" : "Pricing & Discount"}</div>
            {bookingMode === "multi" ? (
              multiRoomData.some(c => c.room && c.nights > 0) ? (
                <div style={{ background:"var(--navy)", color:"#fff", borderRadius:10, padding:"14px 16px" }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {multiRoomData.filter(c=>c.room&&c.nights>0).map((c,i) => (
                      <Fragment key={i}>
                        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                          <span>Rm {c.number} — {c.nights}n × ৳{c.rate.toLocaleString()}</span>
                          <span>৳{c.gross.toLocaleString()}</span>
                        </div>
                        {c.disc > 0 && (
                          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#fcd34d" }}>
                            <span>Rm {c.number} Discount</span><span>−৳{c.disc.toLocaleString()}</span>
                          </div>
                        )}
                      </Fragment>
                    ))}
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:20, fontWeight:900, color:"#c9a84c", borderTop:"1px solid rgba(255,255,255,.2)", paddingTop:8, marginTop:4 }}>
                      <span>Total</span><span>৳{multiTotal.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ color:"var(--text3)", fontSize:13, padding:"12px 0", textAlign:"center", opacity:.6 }}>
                  <i className="ti ti-tag" style={{ marginRight:6 }} />Select rooms above to see pricing
                </div>
              )
            ) : null /* single mode content below */}
            {bookingMode === "single" && (selRoom ? (<>
              {/* Combined discount — only shown for single room */}
              {!isMultiRoom && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                  <div className="form-group" style={{ marginBottom:0 }}><label>Discount Type</label>
                    <select value={discType} onChange={e=>{ setDiscType(e.target.value); setDiscVal(0); }}>
                      <option value="none">No Discount</option>
                      <option value="percent">Percentage (%)</option>
                      <option value="flat">Fixed Amount (৳)</option>
                      <option value="fixed-rate">Fixed Rate/Night</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}><label>Value</label>
                    <input type="number" value={discVal} min={0} onWheel={e=>e.target.blur()} onChange={e=>setDiscVal(e.target.value)} disabled={discType==="none"} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}><label>Reason</label>
                    <select value={["Regular guest","Returning customer","Corporate client","Long stay","Staff discount","Special occasion","Agent referral","Other"].includes(discReason) ? discReason : discReason ? "Other" : ""}
                      onChange={e => { if (e.target.value !== "Other") setDiscReason(e.target.value); else setDiscReason(""); }} style={{ marginBottom:6 }}>
                      <option value="">— Select —</option>
                      <option>Regular guest</option><option>Returning customer</option>
                      <option>Corporate client</option><option>Long stay</option>
                      <option>Staff discount</option><option>Special occasion</option>
                      <option>Agent referral</option>
                      <option value="Other">Other (type below)</option>
                    </select>
                    <input value={discReason} onChange={e=>setDiscReason(e.target.value)} placeholder="Or type custom reason..." />
                  </div>
                </div>
              )}
              {/* Price summary */}
              <div style={{ background:"var(--navy)", color:"#fff", borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontSize:10, opacity:.6, marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>Price Summary</div>
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                    <span>Rm {selRoom.number} — {nights}n × ৳{roomRate.toLocaleString()}</span>
                    <span>৳{base.toLocaleString()}</span>
                  </div>
                  {isMultiRoom && primaryDisc > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#fcd34d" }}>
                      <span>Rm {selRoom.number} Discount</span><span>−৳{primaryDisc.toLocaleString()}</span>
                    </div>
                  )}
                  {extraRoomsData.map((er,i) => (<Fragment key={i}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12 }}>
                      <span>Rm {er.number} — {nights}n × ৳{er.rate.toLocaleString()}</span>
                      <span>৳{er.grossAmt.toLocaleString()}</span>
                    </div>
                    {er.discAmt > 0 && (
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#fcd34d" }}>
                        <span>Rm {er.number} Discount</span><span>−৳{er.discAmt.toLocaleString()}</span>
                      </div>
                    )}
                  </Fragment>))}
                  {!isMultiRoom && discAmt > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#fcd34d" }}><span>Discount</span><span>−৳{discAmt.toLocaleString()}</span></div>}
                  {epAmt > 0 && <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#fbbf24" }}><span>Extra Persons</span><span>+৳{epAmt.toLocaleString()}</span></div>}
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:20, fontWeight:900, color:"#c9a84c", borderTop:"1px solid rgba(255,255,255,.2)", paddingTop:8, marginTop:4 }}>
                    <span>Total</span><span>৳{grand.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </>) : (
              <div style={{ color:"var(--text3)", fontSize:13, padding:"12px 0", textAlign:"center", opacity:.6 }}>
                <i className="ti ti-tag" style={{ marginRight:6 }} />Select a room first to see pricing
              </div>
            ) )}
          </div>

          {/* STEP 6 — PAYMENT */}
          <div className="form-section" style={{ border:"2px solid #4a2ea8", borderRadius:12, padding:"18px 20px", marginBottom:4, background:"#faf8ff" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:"#4a2ea8", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className="ti ti-currency-taka" style={{ color:"#fff", fontSize:14 }} />
              </div>
              <span style={{ color:"#4a2ea8", fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase" }}>Step 6 — Payment</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:"var(--red2)", fontWeight:700 }}>* Required</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div className="form-group" style={{ marginBottom:0 }}><label>Method</label>
                <select value={method} onChange={e=>setMethod(e.target.value)} disabled={payLater}>{PAY_METHODS.map(m=><option key={m}>{m}</option>)}</select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Payment Amount (৳)</label>
                <input type="number" value={advance} min={0} onChange={e=>setAdvance(e.target.value)} disabled={payLater}
                  style={{ borderColor: undefined }} />
              </div>
            </div>
            {needsTxn && !payLater && (
              <div className="form-group" style={{ marginTop:10 }}><label>Transaction Number</label>
                <input value={txnNum} onChange={e=>setTxnNum(e.target.value)} placeholder="e.g. 01X-XXXXXXXXXX" />
              </div>
            )}
            {!payLater && (bookingMode === "single" ? (adv > 0 && selRoom) : (multiAdv > 0)) && (() => {
              const bal = bookingMode === "multi" ? multiBalance : balance;
              return (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:700, padding:"10px 14px", background: bal===0 ? "#f0fdf4" : "#fff8e1", borderRadius:8, marginTop:10, color: bal===0 ? "var(--green)" : "#7a5500" }}>
                  <span>{bal===0 ? "✓ Fully Paid" : "Balance Due after payment:"}</span>
                  <span>৳{bal.toLocaleString()}</span>
                </div>
              );
            })()}

            {/* Pay Later option */}
            <div style={{ marginTop:14, padding:"12px 16px", borderRadius:10, background: payLater ? "#fff8e1" : "#f5f5f5", border: payLater ? "1.5px solid #f0c040" : "1.5px solid #e0e0e0", cursor:"pointer" }}
              onClick={() => { setPayLater(p => !p); if (!payLater) setAdvance(''); }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:20, height:20, borderRadius:4, border:"2px solid " + (payLater ? "#f0c040" : "#aaa"),
                  background: payLater ? "#f0c040" : "#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {payLater && <i className="ti ti-check" style={{ fontSize:12, color:"#7a5c00" }} />}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color: payLater ? "#7a5c00" : "var(--text2)" }}>Pay Later</div>
                  <div style={{ fontSize:11, color:"var(--text3)" }}>Guest will pay at checkout. Manager takes responsibility.</div>
                </div>
              </div>
              {payLater && (
                <div style={{ marginTop:10, padding:"8px 12px", background:"#fffbe6", borderRadius:8, fontSize:12, color:"#7a5c00", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                  <i className="ti ti-user-check" style={{ fontSize:14 }} />
                  Responsible: {curUser || "Manager"}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginTop:12, marginBottom:0 }}><label>Notes / Special Requests</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{ resize:"vertical" }} placeholder="Special requests..." />
            </div>
          </div>

        </div>

        {/* (multi room form removed — room cards are now inside Step 2) */}
        {false && (
        <div>
          <div>
            {multiRoomData.map((card, idx) => {
              const cardAvail = rooms.filter(r => {
                if (!ci || !card.co) return true;
                const num = String(r.number);
                // Allow if it's already selected by this card
                if (num === String(card.number)) return true;
                // Exclude rooms selected by other cards
                if (multiRoomCards.some((c,j) => j!==idx && String(c.number)===num)) return false;
                return !bookingConflicts(r.number, ci, card.co, null, bookings);
              });
              return (
              <div key={card.id} style={{ border:"2px solid var(--navy)", borderRadius:12, padding:"14px 16px", marginBottom:10, background:"var(--bg4)" }}>
                {/* Card header */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                  <span style={{ fontSize:12, fontWeight:800, color:"var(--navy)", textTransform:"uppercase", letterSpacing:1 }}>Room {idx+1}</span>
                  {multiRoomCards.length > 1 && (
                    <button type="button" onClick={() => setMultiRoomCards(prev => prev.filter((_,j) => j!==idx))}
                      style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:7, padding:"3px 10px", color:"#c0392b", fontSize:12, fontWeight:700, cursor:"pointer" }}>
                      ✕ Remove
                    </button>
                  )}
                </div>

                {/* Row 1: Room select + AC/Non-AC */}
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:10 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:11 }}>Select Room *</label>
                    <select value={card.number} onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, number:e.target.value, acChoice:"AC"} : c))} style={{ fontWeight:700 }}>
                      <option value="">Choose a room...</option>
                      {cardAvail.map(r => (
                        <option key={r.number} value={r.number}>
                          Rm {r.number}{r.name?" — "+r.name:""} · {r.type}{r.acRate&&r.nonAcRate?` · AC ৳${r.acRate}/Non-AC ৳${r.nonAcRate}`:`· ৳${r.rate?.toLocaleString()}/n`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:11 }}>Check-out *</label>
                    <DateInput value={card.co} min={ci ? addDaysIso(ci,1) : addDaysIso(today,1)}
                      onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, co:e.target.value} : c))} />
                    {card.nights > 0 && <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>{card.nights} night{card.nights!==1?"s":""}</div>}
                  </div>
                </div>

                {/* AC/Non-AC buttons (only if dual pricing) */}
                {card.isDual && card.room && (
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    {["AC","Non-AC"].map(opt => (
                      <button key={opt} type="button"
                        onClick={() => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, acChoice:opt} : c))}
                        style={{ flex:1, padding:"9px 0", borderRadius:8, border:"2px solid", cursor:"pointer",
                          fontWeight:800, fontSize:12, fontFamily:"inherit", transition:"all .15s",
                          background: card.acChoice===opt ? "var(--navy)" : "var(--bg3)",
                          color:      card.acChoice===opt ? "#fff" : "var(--text2)",
                          borderColor: card.acChoice===opt ? "var(--navy)" : "var(--border)" }}>
                        {opt==="AC" ? "❄️ AC" : "🌬️ Non-AC"}
                        <div style={{ fontSize:10, fontWeight:600, opacity:.8, marginTop:2 }}>
                          ৳{opt==="AC" ? card.room.acRate?.toLocaleString() : card.room.nonAcRate?.toLocaleString()}/night
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Row 2: Adults, Children, Discount */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:8 }}>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:11 }}>Adults</label>
                    <input type="number" min={1} max={20} value={card.adults} onWheel={e=>e.target.blur()}
                      onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, adults:e.target.value} : c))}
                      style={{ textAlign:"center", fontWeight:800 }} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:11 }}>Children</label>
                    <input type="number" min={0} max={15} value={card.children} onWheel={e=>e.target.blur()}
                      onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, children:e.target.value} : c))}
                      style={{ textAlign:"center" }} />
                  </div>
                  <div className="form-group" style={{ marginBottom:0 }}>
                    <label style={{ fontSize:11 }}>Discount (৳)</label>
                    <input type="number" min={0} value={card.discAmt||""} placeholder="0" onWheel={e=>e.target.blur()}
                      onChange={e => setMultiRoomCards(prev => prev.map((c,j) => j===idx ? {...c, discAmt:e.target.value} : c))}
                      style={{ textAlign:"right", fontWeight:700 }} />
                  </div>
                </div>

                {/* Card subtotal */}
                {card.room && card.nights > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"var(--navy)", color:"#fff", borderRadius:8, fontSize:13 }}>
                    <span style={{ opacity:.7 }}>{card.nights}n × ৳{card.rate.toLocaleString()}{card.disc>0 ? ` − ৳${card.disc.toLocaleString()} disc` : ""}</span>
                    <span style={{ fontWeight:900, fontSize:16, color:"#c9a84c" }}>৳{card.net.toLocaleString()}</span>
                  </div>
                )}
              </div>
              );
            })}

            {/* Add room button */}
            <button type="button" onClick={() => setMultiRoomCards(prev => [...prev, { id: Date.now(), number:"", acChoice:"AC", co: addDaysIso(ci||today,1), adults:2, children:0, discAmt:"" }])}
              style={{ width:"100%", padding:"11px 0", border:"2px dashed #c4a8f0", borderRadius:10, background:"#f8f4ff", color:"#5a2ea8", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
              + Add Another Room
            </button>
          </div>

          {/* Grand total summary */}
          {multiRoomData.some(c => c.room && c.nights > 0) && (
            <div style={{ background:"var(--navy)", color:"#fff", borderRadius:10, padding:"14px 16px" }}>
              <div style={{ fontSize:10, opacity:.6, marginBottom:8, textTransform:"uppercase", letterSpacing:.5 }}>Price Summary</div>
              {multiRoomData.filter(c=>c.room&&c.nights>0).map((c,i) => (
                <Fragment key={i}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                    <span>Rm {c.number} — {c.nights}n × ৳{c.rate.toLocaleString()}</span>
                    <span>৳{c.gross.toLocaleString()}</span>
                  </div>
                  {c.disc > 0 && (
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#fcd34d", marginBottom:3 }}>
                      <span>Rm {c.number} Discount</span><span>−৳{c.disc.toLocaleString()}</span>
                    </div>
                  )}
                </Fragment>
              ))}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:20, fontWeight:900, color:"#c9a84c", borderTop:"1px solid rgba(255,255,255,.2)", paddingTop:8, marginTop:6 }}>
                <span>Total</span><span>৳{multiTotal.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* Payment */}
          <div style={{ border:"2px solid #4a2ea8", borderRadius:12, padding:"18px 20px", background:"#faf8ff" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:"#4a2ea8", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <i className="ti ti-currency-taka" style={{ color:"#fff", fontSize:14 }} />
              </div>
              <span style={{ color:"#4a2ea8", fontSize:11, fontWeight:800, letterSpacing:2, textTransform:"uppercase" }}>Payment</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <div className="form-group" style={{ marginBottom:0 }}><label>Method</label>
                <select value={method} onChange={e=>setMethod(e.target.value)} disabled={payLater}>{PAY_METHODS.map(m=><option key={m}>{m}</option>)}</select>
              </div>
              <div className="form-group" style={{ marginBottom:0 }}><label>Payment Amount (৳)</label>
                <input type="number" value={advance} min={0} onWheel={e=>e.target.blur()} onChange={e=>setAdvance(e.target.value)} disabled={payLater} />
              </div>
            </div>
            {needsTxn && !payLater && (
              <div className="form-group" style={{ marginTop:10 }}><label>Transaction Number</label>
                <input value={txnNum} onChange={e=>setTxnNum(e.target.value)} placeholder="e.g. 01X-XXXXXXXXXX" />
              </div>
            )}
            {multiAdv > 0 && !payLater && (
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, fontWeight:700, padding:"10px 14px", background: multiBalance===0?"#f0fdf4":"#fff8e1", borderRadius:8, marginTop:10, color: multiBalance===0?"var(--green)":"#7a5500" }}>
                <span>{multiBalance===0 ? "✓ Fully Paid" : "Balance Due after payment:"}</span>
                <span>৳{multiBalance.toLocaleString()}</span>
              </div>
            )}
            <div style={{ marginTop:14, padding:"12px 16px", borderRadius:10, background: payLater?"#fff8e1":"#f5f5f5", border: payLater?"1.5px solid #f0c040":"1.5px solid #e0e0e0", cursor:"pointer" }}
              onClick={() => { setPayLater(p=>!p); if (!payLater) setAdvance(''); }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:20, height:20, borderRadius:4, border:"2px solid "+(payLater?"#f0c040":"#aaa"), background:payLater?"#f0c040":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {payLater && <i className="ti ti-check" style={{ fontSize:12, color:"#7a5c00" }} />}
                </div>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:payLater?"#7a5c00":"var(--text2)" }}>Pay Later</div>
                  <div style={{ fontSize:11, color:"var(--text3)" }}>Guest will pay at checkout. Manager takes responsibility.</div>
                </div>
              </div>
              {payLater && (
                <div style={{ marginTop:10, padding:"8px 12px", background:"#fffbe6", borderRadius:8, fontSize:12, color:"#7a5c00", fontWeight:600 }}>
                  <i className="ti ti-user-check" style={{ fontSize:14, marginRight:6 }} />Responsible: {curUser || "Manager"}
                </div>
              )}
            </div>
            <div className="form-group" style={{ marginTop:12, marginBottom:0 }}><label>Notes / Special Requests</label>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{ resize:"vertical" }} placeholder="Special requests..." />
            </div>
          </div>

        </div>
        )}{/* end multi room form */}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          {bookingMode === "single" && name.trim() && phone.trim() && (
            <button className="btn" style={{ background:"#fff8e1", borderColor:"#f0c040", color:"#7a5c00" }}
              onClick={() => {
                onClose({ addAnother: true, prefill: { name: name.trim(), phone: phone.trim(), nat, src, refName, refPhone, ci, co } });
              }}>
              <i className="ti ti-plus" /> Add Another Room
            </button>
          )}
          {bookingMode === "single" ? (<>
            <button className="btn" onClick={()=>doSave("confirmed")}><i className="ti ti-calendar" /> Save Reservation</button>
            {ci <= today ? (
              <button className="btn primary" onClick={() => {
                const bk = buildAndValidate();
                if (bk) setPreviewBkObj(bk);
              }}><i className="ti ti-eye" /> Preview & Check In</button>
            ) : (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:9, padding:"8px 14px", fontSize:12, color:"#7a5c00", fontWeight:600 }}>
                <i className="ti ti-info-circle" style={{ fontSize:16, color:"#f0a000" }} />
                Check-in date is {ci} — only reservation available until that date
              </div>
            )}
          </>) : (<>
            <button className="btn" onClick={() => { const bk = buildAndValidateMulti(); if (bk) performSave(bk,"confirmed"); }}>
              <i className="ti ti-calendar" /> Save Reservation
            </button>
            {(() => {
              const earliestCi = multiRoomCards.reduce((mn, c) => (c.ci && c.ci < mn ? c.ci : mn), multiRoomCards[0]?.ci || today);
              return earliestCi <= today ? (
                <button className="btn primary" onClick={() => { const bk = buildAndValidateMulti(); if (bk) setPreviewBkObj(bk); }}>
                  <i className="ti ti-eye" /> Preview & Check In
                </button>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:8, background:"#fff8e1", border:"1.5px solid #f0c040", borderRadius:9, padding:"8px 14px", fontSize:12, color:"#7a5c00", fontWeight:600 }}>
                  <i className="ti ti-info-circle" style={{ fontSize:16, color:"#f0a000" }} />
                  Earliest check-in is {earliestCi} — only reservation available until that date
                </div>
              );
            })()}
          </>)}
        </div>
      </div>
    </div>
    {previewBkObj && (
      <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && setPreviewBkObj(null)} style={{ zIndex:10001 }}>
        <div className="modal-box" style={{ maxWidth:860, padding:0, overflow:"hidden" }}>
          <div style={{ background:"#1a1a2e", padding:"14px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
            <div>
              <div style={{ color:"#C9A84C", fontWeight:800, fontSize:16 }}>
                <i className="ti ti-file-invoice" /> Invoice Preview — {previewBkObj.guest} · Rm {previewBkObj.room}
              </div>
              <div style={{ color:"rgba(255,255,255,.6)", fontSize:12, marginTop:2 }}>Review the invoice before confirming check-in</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button className="btn" onClick={() => setPreviewBkObj(null)} style={{ fontSize:13 }}>
                <i className="ti ti-edit" /> Edit
              </button>
              <button className="btn primary" onClick={() => { performSave(previewBkObj, "checked-in"); setPreviewBkObj(null); }} style={{ fontSize:13, background:"#1a7040", border:"none" }}>
                <i className="ti ti-login" /> Confirm Check In
              </button>
            </div>
          </div>
          <div style={{ maxHeight:"75vh", overflowY:"auto", background:"#fafaf8" }}>
            <div dangerouslySetInnerHTML={{ __html: buildInvoiceHTML(previewBkObj, rooms, [], "room") }} />
          </div>
        </div>
      </div>
    )}

    {smsData && (
      <SMSSendModal
        booking={smsData.booking}
        refName={smsData.refName}
        refPhone={smsData.refPhone}
        status={smsData.status}
        onClose={() => {
          setSmsData(null);
          onClose();
        }}
      />
    )}

    </>
  );
}


export default function Bookings() {
  const { bookings, rooms, updateBookings, updateRevenues, revenues } = useApp();
  const today = todayStr();

  // Bangladesh time past 12pm check
  const isPast12pmBST = (() => {
    const bstHour = (new Date().getUTCHours() + 6) % 24;
    return bstHour >= 12;
  })();
  const overdueCheckouts = bookings.filter(b =>
    b.status === "checked-in" && b.checkout <= today && isPast12pmBST
  );

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [sel,     setSel]     = useState(null);
  const [preview, setPreview] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newPrefill, setNewPrefill] = useState(null);
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState("desc");
  const [showHistory, setShowHistory] = useState(false);

  const filtered = useMemo(() => {
    let arr = [...bookings];

    // Default view: only today's activity + all future reservations
    // History mode: show everything
    if (!showHistory && !search.trim() && !dateFrom && !dateTo) {
      arr = arr.filter(b => {
        if (b.status === "cancelled") return false;
        // Always show future/current reservations (confirmed)
        if (b.status === "confirmed") return b.checkout >= today;
        // Show today's check-ins
        if (b.status === "checked-in") return b.checkin === today || b.checkout >= today;
        // Show today's check-outs only
        if (b.status === "checked-out") return b.checkout === today;
        return false;
      });
    }

    if (filter !== "all") arr = arr.filter(b => b.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(b => b.guest?.toLowerCase().includes(q) || b.phone?.includes(q) || String(b.room).includes(q) || String(b.id).includes(q));
    }
    if (dateFrom) arr = arr.filter(b => b.checkin >= dateFrom);
    if (dateTo)   arr = arr.filter(b => b.checkout <= dateTo);
    arr.sort((a,b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === "string") va = va.toLowerCase(), vb = (vb||"").toLowerCase();
      if (va < vb) return sortDir==="asc" ? -1 : 1;
      if (va > vb) return sortDir==="asc" ? 1  : -1;
      return 0;
    });
    return arr;
  }, [bookings, filter, search, dateFrom, dateTo, sortKey, sortDir, showHistory, today]);

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ k }) {
    if (sortKey !== k) return <i className="ti ti-selector" style={{ opacity:.3, fontSize:11 }} />;
    return <i className={"ti ti-sort-"+(sortDir==="asc"?"ascending":"descending")+"-letters"} style={{ fontSize:11, color:"var(--gold2)" }} />;
  }

  const counts = FILTERS.reduce((acc,f) => {
    acc[f] = f==="all" ? bookings.length : bookings.filter(b=>b.status===f).length;
    return acc;
  }, {});

  const COLS = [
    { key:"id",       label:"#",         w:50  },
    { key:"guest",    label:"Guest",      w:160 },
    { key:"room",     label:"Room",       w:65  },
    { key:"checkin",  label:"Check-in",   w:100 },
    { key:"checkout", label:"Check-out",  w:100 },
    { key:"nights",   label:"Nts",        w:45  },
    { key:"amount",   label:"Amount",     w:110 },
    { key:"status",   label:"Status",     w:120 },
    { key:null,       label:"Actions",    w:80  },
  ];

  function quickCheckout(bid) {
    const b = bookings.find(x => x.id === bid); if (!b) return;
    const due = Math.max(0, (b.invoiceTotal ?? b.amount ?? 0) - (parseFloat(b.advance)||0) - (parseFloat(b.restPayment)||0));
    const updated = { ...b, status:"checked-out", dueAmount: due > 0 ? due : 0 };
    updateBookings(bookings.map(x => x.id === bid ? updated : x));
    if (due > 0) updateRevenues([...revenues, { id: Date.now(), source:"Room Rent", amount: due, date: today, note:`${b.guest} Rm ${b.room} — collected at checkout` }]);
  }

  return (
    <div style={{ padding:"22px 24px", margin:"0 auto", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>

      {/* ── Overdue Checkout Alert ── */}
      {overdueCheckouts.length > 0 && (
        <div style={{ background:"#c0392b", borderRadius:12, padding:"14px 18px", marginBottom:18, border:"3px solid #922b21", boxShadow:"0 4px 20px rgba(192,57,43,.4)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <span style={{ fontSize:22 }}>🚨</span>
            <div>
              <div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>
                CHECKOUT OVERDUE — {overdueCheckouts.length} guest{overdueCheckouts.length>1?"s":""} must check out!
              </div>
              <div style={{ color:"rgba(255,255,255,.8)", fontSize:12, marginTop:2 }}>
                Past 12:00 PM Bangladesh time. These guests have not been checked out yet.
              </div>
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {overdueCheckouts.map(b => (
              <div key={b.id} style={{ background:"rgba(0,0,0,.25)", borderRadius:8, padding:"10px 14px", display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ background:"#fff", borderRadius:6, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <span style={{ fontWeight:900, fontSize:13, color:"#c0392b" }}>{b.room}</span>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ color:"#fff", fontWeight:700, fontSize:13 }}>{b.guest}</div>
                  <div style={{ color:"rgba(255,255,255,.7)", fontSize:11 }}>
                    📅 Checkout: {formatDate(b.checkout)} · {b.phone}
                  </div>
                </div>
                <button onClick={() => quickCheckout(b.id)} style={{ background:"#fff", color:"#c0392b", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                  ✓ Check Out Now
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Page header — New Booking is the hero, history toggle is secondary */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
        {/* Left: page title */}
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Bookings</div>
          <div style={{ fontSize:11, color:"var(--text3)" }}>
            {showHistory ? `${bookings.length} total reservations` : `Today's activity & upcoming — ${today}`}
          </div>
        </div>

        {/* Center: New Booking hero button */}
        <div style={{ flex:1, display:"flex", justifyContent:"center" }}>
          <button onClick={()=>{ setNewPrefill(null); setShowNew(true); }} style={{
            display:"flex", alignItems:"center", gap:10,
            padding:"14px 40px", borderRadius:14, border:"none", cursor:"pointer",
            background:"linear-gradient(135deg,#4a2ea8 0%,#C9983A 100%)",
            color:"#fff", fontSize:17, fontWeight:900, fontFamily:"inherit",
            boxShadow:"0 6px 24px rgba(74,46,168,.5)",
            letterSpacing:.4, transition:"transform .15s, box-shadow .15s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 10px 32px rgba(74,46,168,.6)";}}
            onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 6px 24px rgba(74,46,168,.5)";}}
          >
            <i className="ti ti-calendar-plus" style={{ fontSize:22 }} /> New Booking
          </button>
        </div>

        {/* Right: Show History — small and subtle */}
        <button onClick={() => setShowHistory(h => !h)} style={{
          display:"flex", alignItems:"center", gap:5,
          padding:"6px 12px", borderRadius:8, border:"1.5px solid var(--border)", cursor:"pointer",
          background: showHistory ? "var(--navy)" : "transparent",
          color: showHistory ? "#fff" : "var(--text3)",
          fontSize:11, fontWeight:600, fontFamily:"inherit", whiteSpace:"nowrap",
        }}>
          <i className={"ti " + (showHistory ? "ti-calendar-event" : "ti-history")} style={{ fontSize:13 }} />
          {showHistory ? "Today" : "History"}
        </button>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"6px 14px", borderRadius:20, border:"1.5px solid", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all .15s",
            background: filter===f ? "var(--navy)" : "transparent",
            color:      filter===f ? "#fff" : "var(--text3)",
            borderColor: filter===f ? "var(--navy)" : "var(--border)" }}>
            {f==="all" ? "All" : f==="confirmed" ? "Reservation" : f.replace("-"," ")} <span style={{ fontSize:10, opacity:.7 }}>({counts[f]})</span>
          </button>
        ))}
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:"1 1 200px" }}>
          <i className="ti ti-search" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", fontSize:14 }} />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest, phone, room..." style={{ paddingLeft:32, width:"100%", boxSizing:"border-box" }} />
        </div>
        <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{ flex:"0 0 150px" }} title="From check-in" />
        <input type="date" value={dateTo}   onChange={e=>setDateTo(e.target.value)}   style={{ flex:"0 0 150px" }} title="To check-out" />
        {(search||dateFrom||dateTo) && <button className="btn sm" onClick={()=>{setSearch("");setDateFrom("");setDateTo("");}}>Clear</button>}
      </div>

      <div className="panel" style={{ overflowX:"auto", padding:0 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"var(--navy2)", color:"var(--gold)" }}>
              {COLS.map(c => (
                <th key={c.label} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, textTransform:"uppercase",
                  letterSpacing:.5, width:c.w, whiteSpace:"nowrap", cursor: c.key?"pointer":"default", userSelect:"none" }}
                  onClick={() => c.key && toggleSort(c.key)}>
                  {c.label} {c.key && <SortIcon k={c.key} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={COLS.length} style={{ textAlign:"center", padding:28, color:"var(--text3)" }}>No bookings found</td></tr>
            )}
            {filtered.map((b,i) => {
              const invoiceTotal = b.invoiceTotal != null ? b.invoiceTotal : b.amount;
              const paid = getHotelPaidAmount(b);
              const bal  = Math.max(0, invoiceTotal - paid);
              return (
                <tr key={b.id} style={{ borderBottom:"1px solid var(--border)", background: i%2===0?"":"var(--panel-alt)", cursor:"pointer" }}
                  onClick={() => setPreview(b)}>
                  <td style={{ padding:"10px 12px", fontWeight:700, color:"var(--text3)", fontSize:12 }}>#{b.id}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:700 }}>{b.guest}</div>
                    <div style={{ fontSize:11, color:"var(--text3)" }}>{b.phone}</div>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <strong>Rm {b.isMultiRoomBooking && b.multiRooms?.length > 0 ? b.multiRooms.map(r=>r.number).join(", ") : b.room + (b.extraRooms?.length > 0 ? ", " + b.extraRooms.map(r=>r.number).join(", ") : "")}</strong>
                    <div style={{ fontSize:10, color:"var(--text3)" }}>{b.isMultiRoomBooking ? `Multi-Room (${b.multiRooms?.length||0})` : b.type + (b.extraRooms?.length > 0 ? ` +${b.extraRooms.length} more` : "")}</div>
                  </td>
                  <td style={{ padding:"10px 12px" }}>{formatDate(b.checkin)}</td>
                  <td style={{ padding:"10px 12px" }}>{formatDate(b.checkout)}</td>
                  <td style={{ padding:"10px 12px", textAlign:"center" }}>{b.nights}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:700 }}>{money(invoiceTotal)}</div>
                    {bal > 0 && <div style={{ fontSize:10, color:"var(--red2)", fontWeight:600 }}>Due: {money(bal)}</div>}
                    {bal <= 0 && invoiceTotal > 0 && <div style={{ fontSize:10, color:"var(--green)" }}>Paid</div>}
                  </td>
                  <td style={{ padding:"10px 12px" }}><Badge status={b.status} /></td>
                  <td style={{ padding:"10px 12px" }}>
                    <button className="btn sm" onClick={e=>{e.stopPropagation();setPreview(b);}} style={{ fontSize:11 }}>
                      <i className="ti ti-file-invoice" /> Invoice
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display:"flex", gap:14, marginTop:14, fontSize:12, color:"var(--text3)", flexWrap:"wrap" }}>
        <span><i className="ti ti-list" /> Showing {filtered.length} of {bookings.length} {!showHistory && <span style={{ color:"var(--navy)", fontWeight:700 }}>(today's view)</span>}</span>
        <span><i className="ti ti-currency-taka" style={{ color:"var(--gold2)" }} /> Total: {money(filtered.reduce((s,b)=>s+(b.invoiceTotal??b.amount),0))}</span>
        <span style={{ color:"var(--green)" }}><i className="ti ti-circle-check" /> Paid: {money(filtered.reduce((s,b)=>s+getHotelPaidAmount(b),0))}</span>
        <span style={{ color:"var(--red2)" }}><i className="ti ti-alert-circle" /> Due: {money(filtered.reduce((s,b)=>{ const inv=b.invoiceTotal??b.amount; const pd=getHotelPaidAmount(b); return s+Math.max(0,inv-pd); },0))}</span>
      </div>

      {showNew && <NewBookingModal
        prefill={newPrefill}
        onClose={(result) => {
          if (result?.addAnother) {
            setNewPrefill(result.prefill);
            // Keep showNew true — just remount with new prefill via key change
            setShowNew(false);
            requestAnimationFrame(() => setShowNew(true));
          } else {
            setShowNew(false);
            setNewPrefill(null);
          }
        }}
      />}
      {preview && <InvoicePreviewModal booking={preview} rooms={rooms} onClose={() => setPreview(null)} />}
    </div>
  );
}
