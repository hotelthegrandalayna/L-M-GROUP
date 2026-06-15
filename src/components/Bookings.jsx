import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money, formatDate, nightsBetween, bookingConflicts, maxId } from "../utils/helpers";
import { sendWhatsAppAlert, buildHotelWaMessage } from "../utils/whatsapp";

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
  const totalPaid = history.reduce((s,p) => s + p.amount, 0);
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
    const updated = bookings.map(x => x.id === b.id ? { ...x, paymentHistory: [...history, entry], advance: (x.advance||0)+amt } : x);
    updateBookings(updated);
    updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: amt, date: today,
      note: b.guest + " Rm " + b.room + " - " + (payNote || "payment") + " (" + payMtd + ")", bookingId: b.id }]);
    notify("Payment of " + money(amt) + " recorded", "success");
    setPayAmt(0); setPayTxn(""); setPayNote("");
    onClose();
  }

  function extendStay() {
    if (!newCo) return;
    if (bookingConflicts(b.room, b.checkout, newCo, b.id, bookings)) { notify("Room already booked for those dates", "error"); return; }
    const newNights = nightsBetween(b.checkin, newCo);
    const newAmt    = room ? newNights * room.rate : b.amount + extCost;
    const updated   = bookings.map(x => x.id === b.id ? { ...x, checkout: newCo, nights: newNights, amount: newAmt } : x);
    updateBookings(updated);
    if (extCost > 0) updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: extCost, date: today,
      note: b.guest + " Rm " + b.room + " - stay extended " + extDays + "d", bookingId: b.id }]);
    notify("Stay extended to " + newCo, "success");
    onClose();
  }

  function cancelBooking() {
    if (!window.confirm("Cancel this booking? This cannot be undone.")) return;
    updateBookings(bookings.map(x => x.id === b.id ? { ...x, status: "cancelled" } : x));
    notify("Booking cancelled", "success");
    onClose();
  }

  function saveEdit() {
    if (!eGuest.trim()) { notify("Guest name required", "error"); return; }
    updateBookings(bookings.map(x => x.id === b.id ? { ...x, guest: eGuest.trim(), phone: ePhone.trim(), notes: eNotes.trim() } : x));
    notify("Booking updated", "success");
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
              {b.status === "confirmed" && (
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

function NewBookingModal({ onClose }) {
  const { curUser, rooms, bookings, updateBookings, revenues, updateRevenues, notify, extraPersonRules } = useApp();
  const today = todayStr();
  const tmr   = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // Guest
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [nat,      setNat]      = useState("");
  const [src,      setSrc]      = useState("Walk-in");
  const [refName,  setRefName]  = useState("");
  const [refPhone, setRefPhone] = useState("");
  // ID
  const [idType,   setIdType]   = useState("");
  const [idNum,    setIdNum]    = useState("");
  const [persons,  setPersons]  = useState([{ idType:"", idNum:"", front:[], back:[] }]);
  // Stay
  const [room,     setRoom]     = useState("");
  const [acChoice, setAcChoice] = useState("AC"); // "AC" | "Non-AC" for dual-pricing rooms
  const [ci,       setCi]       = useState(today);
  const [co,       setCo]       = useState(tmr);
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
  const [advance,  setAdvance]  = useState(0);
  const [txnNum,   setTxnNum]   = useState("");
  const [notes,    setNotes]    = useState("");
  const [smsData,  setSmsData]  = useState(null); // { booking, refName, refPhone }

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

  function calcDiscount(b) {
    const dv = parseFloat(discVal) || 0;
    if (discType === "percent")     return Math.round(b * dv / 100);
    if (discType === "flat")        return Math.min(dv, b);
    if (discType === "fixed-rate" && dv > 0) return Math.max(0, b - nights * dv);
    return 0;
  }
  const discAmt  = calcDiscount(base);
  const roomTotal = Math.max(0, base - discAmt);
  const epAmt    = epAccepted ? epCharge : 0;
  const grand    = roomTotal + epAmt;
  const adv      = Math.min(parseFloat(advance) || 0, grand);
  const balance  = Math.max(0, grand - adv);

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

  function doSave(status) {
    if (!name.trim())  { notify("Guest name required", "error"); return; }
    if (!phone.trim()) { notify("Phone required", "error"); return; }
    if (!selRoom)      { notify("Select a room", "error"); return; }
    if (!nights)       { notify("Check-out must be after check-in", "error"); return; }
    if (bookingConflicts(selRoom.number, ci, co, null, bookings)) {
      notify("Room already booked for those dates", "error"); return;
    }
    const id  = maxId(bookings);
    const rn  = refName.trim();
    const rph = refPhone.trim();
    const a   = adv;
    const t   = needsTxn ? txnNum.trim() : "";
    const bkObj = {
      id, guest: name.trim(), phone: phone.trim(), email: "",
      room: selRoom.number, type: selRoom.type,
      checkin: ci, checkout: co, nights, amount: roomTotal, baseAmount: base,
      acChoice: isDual ? acChoice : undefined, roomRate,
      discType: discType, discAmt: discAmt, discReason: discReason.trim(),
      status, notes: notes.trim(),
      source: src, referredByName: rn, referredByPhone: rph, referredBy: rn || rph,
      nationality: nat.trim(),
      idType, idNum: idNum.trim(),
      idFront: (persons[0]?.front||[])[0] || "", idBack: (persons[0]?.back||[])[0] || "",
      idDocs: persons.filter(p => (p.front||[]).length || (p.back||[]).length || p.idNum),
      adults: parseInt(adults) || 2, children: parseInt(children) || 0,
      advance: a, paymentMethod: method, txnNumber: t,
      paymentHistory: a > 0 ? [{ ts: new Date().toISOString(), amount: a, method, txnNumber: t, note: "Advance paid", type: "room", by: curUser || "staff" }] : [],
      extraPersonCharge: (epAccepted && epCharge > 0) ? { qty: epCount, rate: epRate, total: epCharge } : null,
      createdAt: new Date().toISOString(), by: curUser || "staff" };
    updateBookings([...bookings, bkObj]);
    sendWhatsAppAlert(buildHotelWaMessage(bkObj)).catch(() => {});
    if (a > 0) updateRevenues([...revenues, {
      id: maxId(revenues), source: "Room Rent", amount: a, date: today,
      note: name.trim() + " Rm " + selRoom.number + (status === "confirmed" ? " — reservation deposit" : " — advance payment") + " (" + method + ")",
      bookingId: id }]);
    notify(name.trim() + (status === "checked-in" ? " checked in ✓" : " booking saved") + (discAmt > 0 ? " · Discount " + money(discAmt) : ""), "success");
    setSmsData({ booking: bkObj, refName: refName.trim(), refPhone: refPhone.trim(), status });
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

        {/* ── 2-COLUMN LAYOUT ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 24px", alignItems:"start" }}>

          {/* ══ LEFT COLUMN ══ */}
          <div>
            {/* ── GUEST ── */}
            <div className="form-section">
              <div className="form-sec-title"><i className="ti ti-user" /> Guest</div>
              <div className="form-row">
                <div className="form-group"><label>Full Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="As per ID" autoFocus /></div>
                <div className="form-group"><label>Phone *</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+880..." /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Nationality</label><input value={nat} onChange={e=>setNat(e.target.value)} placeholder="Bangladeshi" /></div>
                <div className="form-group"><label>Source</label>
                  <select value={src} onChange={e=>setSrc(e.target.value)}>
                    {SOURCES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Referred by — Name</label><input value={refName} onChange={e=>setRefName(e.target.value)} placeholder="Referrer name" /></div>
                <div className="form-group"><label>Referred by — Phone</label><input value={refPhone} onChange={e=>setRefPhone(e.target.value)} placeholder="Referrer phone" /></div>
              </div>
            </div>

            {/* ── ID VERIFICATION ── */}
            <div className="form-section">
              <div className="form-sec-title"><i className="ti ti-id-badge" /> ID Verification</div>
              {persons.map((p, idx) => (
                <div key={idx} style={{ border:"1px solid var(--border)", borderRadius:8, padding:"10px 12px", marginBottom:8, background:"var(--bg4)" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.5 }}>
                      <i className="ti ti-user" style={{ color:"var(--gold)", marginRight:4 }} />Person {idx+1}
                    </div>
                    {idx > 0 && <button type="button" onClick={()=>removePerson(idx)} style={{ border:"none", background:"transparent", color:"var(--red)", cursor:"pointer", fontSize:11, fontWeight:700 }}><i className="ti ti-x" /> Remove</button>}
                  </div>
                  {/* Per-person ID type + number */}
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
                  {/* Multi-photo upload per side */}
                  <div className="form-row">
                    {["front","back"].map(side => (
                      <div key={side} className="form-group" style={{ marginBottom:0 }}>
                        <label style={{ fontSize:10 }}>{side === "front" ? "Front Side" : "Back Side"}</label>
                        {/* Existing photos */}
                        {(p[side]||[]).length > 0 && (
                          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:6 }}>
                            {(p[side]||[]).map((src, pi) => (
                              <div key={pi} style={{ position:"relative" }}>
                                <img src={src} alt="id" style={{ width:52, height:42, borderRadius:5, objectFit:"cover", border:"1.5px solid var(--gold)" }} />
                                <button type="button" onClick={()=>removePhoto(idx,side,pi)} style={{
                                  position:"absolute", top:-5, right:-5, width:16, height:16, borderRadius:"50%",
                                  background:"#C62828", color:"#fff", border:"none", fontSize:9, cursor:"pointer",
                                  display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, lineHeight:1 }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, padding:"10px 8px", border:"1.5px dashed var(--border)", borderRadius:8, cursor:"pointer", background:"var(--bg3)", minHeight:52, textAlign:"center",
                          borderColor:(p[side]||[]).length ? "var(--gold)" : "var(--border)" }}>
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
          </div>

          {/* ══ RIGHT COLUMN ══ */}
          <div>
            {/* ── ROOM & STAY ── */}
            <div className="form-section">
              <div className="form-sec-title"><i className="ti ti-door" /> Room &amp; Stay</div>
              <div className="form-group"><label>Room *</label>
                <select value={room} onChange={e=>{ setRoom(e.target.value); setAcChoice("AC"); }}>
                  <option value="">Select Room</option>
                  {availRooms.map(r=>(
                    <option key={r.number} value={r.number}>{r.number}{r.name?" — "+r.name:""} · {r.type}{r.acRate&&r.nonAcRate?" · AC ৳"+r.acRate+"/Non-AC ৳"+r.nonAcRate:" · ৳"+r.rate.toLocaleString()}/n</option>
                  ))}
                </select>
              </div>
              {isDual && (
                <div className="form-group">
                  <label><i className="ti ti-wind" style={{ color:"var(--navy)", marginRight:4 }} />AC or Non-AC? *</label>
                  <div style={{ display:"flex", gap:10, marginTop:4 }}>
                    {["AC","Non-AC"].map(opt=>(
                      <button key={opt} type="button" onClick={()=>setAcChoice(opt)} style={{
                        flex:1, padding:"10px 0", borderRadius:9, border:"2px solid", cursor:"pointer",
                        fontWeight:800, fontSize:13, fontFamily:"inherit", transition:"all .15s",
                        background: acChoice===opt ? "var(--navy)" : "var(--bg3)",
                        color:      acChoice===opt ? "#fff"        : "var(--text2)",
                        borderColor: acChoice===opt ? "var(--navy)"  : "var(--border)",
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
              <div className="form-row">
                <div className="form-group"><label>Check-in *</label><input type="date" value={ci} onChange={e=>setCi(e.target.value)} /></div>
                <div className="form-group"><label>Check-out *</label><input type="date" value={co} onChange={e=>setCo(e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Adults</label>
                  <input type="number" value={adults} min={1} max={20} onChange={e=>{ setAdults(e.target.value); setEpAccepted(false); }} style={{ fontSize:16, fontWeight:800, textAlign:"center" }} />
                </div>
                <div className="form-group"><label>Children</label>
                  <input type="number" value={children} min={0} max={15} onChange={e=>setChildren(e.target.value)} style={{ fontSize:16, fontWeight:800, textAlign:"center" }} />
                </div>
              </div>
              {epCharge > 0 && !epAccepted && (
                <div style={{ border:"1.5px solid var(--gold)", borderRadius:9, padding:"12px 14px", background:"#fffbee", marginTop:6 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#7a5500", marginBottom:8 }}>
                    Extra person charge: {epCount} person{epCount>1?"s":""} × ৳{epRate.toLocaleString()} = <strong>৳{epCharge.toLocaleString()}</strong>
                  </div>
                  <div style={{ fontSize:11, color:"#7a5500", marginBottom:10 }}>
                    (Applies for {epThreshold}+ adults. Will be added to bill.)
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="btn primary sm" onClick={()=>setEpAccepted(true)}>Accept Charge</button>
                    <button className="btn sm" onClick={()=>setAdults(epThreshold)}>Reduce to {epThreshold}</button>
                  </div>
                </div>
              )}
              {epAccepted && epCharge > 0 && (
                <div style={{ fontSize:12, fontWeight:700, color:"var(--green)", padding:"8px 12px", background:"#f0fdf4", borderRadius:8, marginTop:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>✓ Extra person charge accepted: +৳{epCharge.toLocaleString()}</span>
                  <button className="btn sm" onClick={()=>{ setEpAccepted(false); setAdults(epThreshold); }} style={{ fontSize:10 }}>Remove</button>
                </div>
              )}
            </div>

            {/* ── DISCOUNT ── */}
            <div className="form-section">
              <div className="form-sec-title"><i className="ti ti-tag" /> Discount</div>
              <div className="form-row" style={{ gridTemplateColumns:"1fr 1fr 1fr" }}>
                <div className="form-group"><label>Type</label>
                  <select value={discType} onChange={e=>{ setDiscType(e.target.value); setDiscVal(0); }}>
                    <option value="none">No Discount</option>
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Fixed Amount</option>
                    <option value="fixed-rate">Fixed Rate/Night</option>
                  </select>
                </div>
                <div className="form-group"><label>Value</label>
                  <input type="number" value={discVal} min={0} onChange={e=>setDiscVal(e.target.value)} disabled={discType==="none"} />
                </div>
                <div className="form-group"><label>Reason</label>
                  <input value={discReason} onChange={e=>setDiscReason(e.target.value)} placeholder="e.g. Regular guest" />
                </div>
              </div>
              {/* Live price box */}
              <div style={{ background:"var(--navy)", color:"#fff", borderRadius:8, padding:"13px 16px", textAlign:"center", minHeight:52, display:"flex", alignItems:"center", justifyContent:"center", flexWrap:"wrap", gap:"10px 18px", marginTop:4 }}>
                {!selRoom || !nights ? (
                  <span style={{ opacity:.5, fontSize:12 }}>Select room and dates</span>
                ) : (
                  <>
                    {discAmt > 0 ? (
                      <>
                        <div><div style={{ fontSize:10, opacity:.7 }}>Base ({nights}n × ৳{roomRate.toLocaleString()})</div><div style={{ textDecoration:"line-through", opacity:.5, fontSize:13 }}>৳{base.toLocaleString()}</div></div>
                        <div><div style={{ fontSize:10, opacity:.7 }}>Discount</div><div style={{ color:"var(--gold2)", fontWeight:700, fontSize:14 }}>−৳{discAmt.toLocaleString()}</div></div>
                        <div><div style={{ fontSize:10, opacity:.7 }}>Room Total</div><div style={{ fontSize:20, fontWeight:800, color:"var(--gold2)" }}>৳{roomTotal.toLocaleString()}</div></div>
                      </>
                    ) : (
                      <div><div style={{ fontSize:10, opacity:.7 }}>{nights} night{nights>1?"s":""} × ৳{roomRate.toLocaleString()}</div><div style={{ fontSize:20, fontWeight:800, color:"var(--gold2)" }}>৳{roomTotal.toLocaleString()}</div></div>
                    )}
                    {epAmt > 0 && (
                      <>
                        <div style={{ borderLeft:"1px solid rgba(255,255,255,.2)", paddingLeft:18 }}><div style={{ fontSize:10, opacity:.7 }}>Extra Persons</div><div style={{ color:"#fbbf24", fontWeight:700, fontSize:14 }}>+৳{epAmt.toLocaleString()}</div></div>
                        <div><div style={{ fontSize:10, opacity:.7 }}>Grand Total</div><div style={{ fontSize:20, fontWeight:800, color:"var(--gold2)" }}>৳{grand.toLocaleString()}</div></div>
                      </>
                    )}
                    {adv > 0 && (
                      <>
                        <div style={{ borderLeft:"1px solid rgba(255,255,255,.2)", paddingLeft:18 }}><div style={{ fontSize:10, opacity:.7 }}>Advance</div><div style={{ color:"#6de8a8", fontWeight:700, fontSize:14 }}>−৳{adv.toLocaleString()}</div></div>
                        <div><div style={{ fontSize:10, opacity:.7 }}>Balance Due</div><div style={{ fontSize:20, fontWeight:800, color: balance > 0 ? "#f5a0a0" : "#6de8a8" }}>৳{balance.toLocaleString()}</div></div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── PAYMENT ── */}
            <div className="form-section">
              <div className="form-sec-title"><i className="ti ti-cash" /> Payment</div>
              <div className="form-row">
                <div className="form-group"><label>Method</label>
                  <select value={method} onChange={e=>{ setMethod(e.target.value); }}>
                    {PAY_METHODS.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Advance Paid (৳)</label>
                  <input type="number" value={advance} min={0} onChange={e=>setAdvance(e.target.value)} />
                </div>
              </div>
              {needsTxn && (
                <div className="form-group"><label>Transaction Number</label>
                  <input value={txnNum} onChange={e=>setTxnNum(e.target.value)} placeholder="e.g. 01X-XXXXXXXXXX" />
                </div>
              )}
              <div className="form-group"><label>Notes</label>
                <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} style={{ resize:"vertical" }} placeholder="Special requests..." />
              </div>
            </div>
          </div>
        </div>{/* end 2-column grid */}

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={()=>doSave("confirmed")}><i className="ti ti-calendar" /> Save Reservation</button>
          <button className="btn primary" onClick={()=>doSave("checked-in")}><i className="ti ti-login" /> Check In Now</button>
        </div>
      </div>
    </div>
    {smsData && (
      <SMSSendModal
        booking={smsData.booking}
        refName={smsData.refName}
        refPhone={smsData.refPhone}
        status={smsData.status}
        onClose={() => { setSmsData(null); onClose(); }}
      />
    )}
    </>
  );
}


export default function Bookings() {
  const { rooms, bookings, notify } = useApp();
  const today = todayStr();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [sel,     setSel]     = useState(null);
  const [showNew, setShowNew] = useState(false);
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

  return (
    <div style={{ padding:"22px 24px", margin:"0 auto", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Bookings</div>
          <div style={{ fontSize:12, color:"var(--text3)" }}>
            {showHistory
              ? `${bookings.length} total reservations`
              : `Today's activity & upcoming reservations — ${today}`}
          </div>
        </div>
        <button onClick={() => setShowHistory(h => !h)} style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"8px 16px", borderRadius:8, border:"1.5px solid var(--border)", cursor:"pointer",
          background: showHistory ? "var(--navy)" : "var(--bg3)",
          color: showHistory ? "#fff" : "var(--text3)",
          fontSize:12, fontWeight:700, fontFamily:"inherit",
        }}>
          <i className={"ti " + (showHistory ? "ti-calendar-event" : "ti-history")} style={{ fontSize:14 }} />
          {showHistory ? "Today's View" : "Show History"}
        </button>
        <button onClick={()=>setShowNew(true)} style={{
          display:"flex", alignItems:"center", gap:8,
          padding:"11px 24px", borderRadius:10, border:"none", cursor:"pointer",
          background:"linear-gradient(135deg,#4a2ea8 0%,#C9983A 100%)",
          color:"#fff", fontSize:15, fontWeight:800, fontFamily:"inherit",
          boxShadow:"0 4px 18px rgba(74,46,168,.45)",
          letterSpacing:.3, transition:"transform .15s, box-shadow .15s",
        }}
          onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 28px rgba(74,46,168,.55)";}}
          onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 18px rgba(74,46,168,.45)";}}
        >
          <i className="ti ti-calendar-plus" style={{ fontSize:18 }} /> New Booking
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
              const paid = (b.paymentHistory||[]).reduce((s,p)=>s+p.amount,0);
              const bal  = Math.max(0, invoiceTotal - paid);
              return (
                <tr key={b.id} style={{ borderBottom:"1px solid var(--border)", background: i%2===0?"":"var(--panel-alt)", cursor:"pointer" }}
                  onClick={() => setSel(b)}>
                  <td style={{ padding:"10px 12px", fontWeight:700, color:"var(--text3)", fontSize:12 }}>#{b.id}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:700 }}>{b.guest}</div>
                    <div style={{ fontSize:11, color:"var(--text3)" }}>{b.phone}</div>
                  </td>
                  <td style={{ padding:"10px 12px" }}><strong>Rm {b.room}</strong><div style={{ fontSize:10, color:"var(--text3)" }}>{b.type}</div></td>
                  <td style={{ padding:"10px 12px" }}>{b.checkin}</td>
                  <td style={{ padding:"10px 12px" }}>{b.checkout}</td>
                  <td style={{ padding:"10px 12px", textAlign:"center" }}>{b.nights}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:700 }}>{money(invoiceTotal)}</div>
                    {bal > 0 && <div style={{ fontSize:10, color:"var(--red)", fontWeight:600 }}>Due: {money(bal)}</div>}
                    {bal <= 0 && invoiceTotal > 0 && <div style={{ fontSize:10, color:"var(--green)" }}>Paid</div>}
                  </td>
                  <td style={{ padding:"10px 12px" }}><Badge status={b.status} /></td>
                  <td style={{ padding:"10px 12px" }}>
                    <button className="btn sm" onClick={e=>{e.stopPropagation();setSel(b);}} style={{ fontSize:11 }}>
                      <i className="ti ti-eye" /> View
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
        <span style={{ color:"var(--green)" }}><i className="ti ti-circle-check" /> Paid: {money(filtered.reduce((s,b)=>s+(b.paymentHistory||[]).reduce((a,p)=>a+p.amount,0),0))}</span>
        <span style={{ color:"var(--red)" }}><i className="ti ti-alert-circle" /> Due: {money(filtered.reduce((s,b)=>{ const inv=b.invoiceTotal??b.amount; const pd=(b.paymentHistory||[]).reduce((a,p)=>a+p.amount,0); return s+Math.max(0,inv-pd); },0))}</span>
      </div>

      {sel     && <BookingModal  booking={sel} onClose={() => setSel(null)} />}
      {showNew && <NewBookingModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
