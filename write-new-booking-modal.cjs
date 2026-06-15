const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Bookings.jsx';

let bk = fs.readFileSync(path, 'utf8');

// Remove the old simplified NewBookingModal (everything from the marker to the export)
const startMarker = '\n// ─── New Booking Modal ─────────────────────────────────────────────────────\nfunction NewBookingModal';
const endMarker   = '\nexport default function Bookings()';
const startIdx = bk.indexOf(startMarker);
const endIdx   = bk.indexOf(endMarker);
if (startIdx !== -1 && endIdx !== -1) {
  bk = bk.slice(0, startIdx) + bk.slice(endIdx);
}

const newModal = `
// ─── New Booking Modal (full original form) ────────────────────────────────
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
  const [persons,  setPersons]  = useState([{ front:"", back:"" }]);
  // Stay
  const [room,     setRoom]     = useState("");
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

  const needsTxn = ["bKash","Nagad"].includes(method);
  const epThreshold = (extraPersonRules?.threshold) || 3;
  const epRate      = (extraPersonRules?.charge)    || 300;
  const epCount     = Math.max(0, parseInt(adults) - epThreshold);
  const epCharge    = epCount > 0 ? epCount * epRate : 0;

  const selRoom  = rooms.find(r => String(r.number) === String(room));
  const nights   = ci && co && new Date(co) > new Date(ci)
    ? Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000)) : 0;
  const base     = selRoom && nights ? nights * selRoom.rate : 0;

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

  function handlePhotoUpload(idx, side, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notify("Max 5MB per file", "error"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      setPersons(prev => {
        const next = prev.map((p, i) => i === idx ? { ...p, [side]: e.target.result } : p);
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  function addPerson() {
    setPersons(prev => [...prev, { front: "", back: "" }]);
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
      discType: discType, discAmt: discAmt, discReason: discReason.trim(),
      status, notes: notes.trim(),
      source: src, referredByName: rn, referredByPhone: rph, referredBy: rn || rph,
      nationality: nat.trim(),
      idType, idNum: idNum.trim(),
      idFront: persons[0]?.front || "", idBack: persons[0]?.back || "",
      idDocs: persons.filter(p => p.front || p.back),
      adults: parseInt(adults) || 2, children: parseInt(children) || 0,
      advance: a, paymentMethod: method, txnNumber: t,
      paymentHistory: a > 0 ? [{ ts: new Date().toISOString(), amount: a, method, txnNumber: t, note: "Advance paid", type: "room", by: curUser || "staff" }] : [],
      extraPersonCharge: (epAccepted && epCharge > 0) ? { qty: epCount, rate: epRate, total: epCharge } : null,
      createdAt: new Date().toISOString(), by: curUser || "staff",
    };
    updateBookings([...bookings, bkObj]);
    if (a > 0) updateRevenues([...revenues, {
      id: maxId(revenues), source: "Room Rent", amount: a, date: today,
      note: name.trim() + " Rm " + selRoom.number + (status === "confirmed" ? " — reservation deposit" : " — advance payment") + " (" + method + ")",
      bookingId: id,
    }]);
    notify(name.trim() + (status === "checked-in" ? " checked in ✓" : " booking saved") + (discAmt > 0 ? " · Discount " + money(discAmt) : ""), "success");
    onClose();
  }

  const SOURCES     = ["Walk-in","Phone","Website","WhatsApp","OTA","Referral"];
  const ID_TYPES    = ["National ID (NID)","Passport","Driving License"];
  const PAY_METHODS = ["Cash","bKash","Nagad","Card","Bank Transfer"];

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:620, maxHeight:"92vh", overflowY:"auto" }}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">New Booking</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

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
          <div className="form-row">
            <div className="form-group"><label>ID Type</label>
              <select value={idType} onChange={e=>setIdType(e.target.value)}>
                <option value="">Select</option>
                {ID_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label>ID Number (Primary Guest)</label><input value={idNum} onChange={e=>setIdNum(e.target.value)} placeholder="Document number" /></div>
          </div>
          {/* Per-person ID photo upload */}
          {persons.map((p, idx) => (
            <div key={idx} style={{ border:"1px solid var(--border)", borderRadius:8, padding:"10px 12px", marginBottom:8, background:"var(--bg4)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.5 }}>
                  <i className="ti ti-user" style={{ color:"var(--gold)", marginRight:4 }} />Person {idx+1}
                </div>
                {idx > 0 && <button type="button" onClick={()=>removePerson(idx)} style={{ border:"none", background:"transparent", color:"var(--red)", cursor:"pointer", fontSize:11, fontWeight:700 }}><i className="ti ti-x" /> Remove</button>}
              </div>
              <div className="form-row">
                {["front","back"].map(side => (
                  <div key={side} className="form-group">
                    <label>{side === "front" ? "Front Side" : "Back Side"}</label>
                    <label style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, padding:"14px 10px", border:"1.5px dashed var(--border)", borderRadius:8, cursor:"pointer", background:"var(--bg3)", minHeight:80, textAlign:"center",
                      borderColor: p[side] ? "var(--gold)" : "var(--border)" }}>
                      {p[side]
                        ? <img src={p[side]} alt="id" style={{ maxHeight:60, maxWidth:"100%", borderRadius:6, objectFit:"contain" }} />
                        : <><i className="ti ti-camera" style={{ fontSize:20, color:"var(--text3)" }} /><span style={{ fontSize:11, color:"var(--text3)" }}>Upload {side}</span></>}
                      <input type="file" accept="image/*" style={{ display:"none" }} onChange={e => handlePhotoUpload(idx, side, e.target.files[0])} />
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

        {/* ── ROOM & STAY ── */}
        <div className="form-section">
          <div className="form-sec-title"><i className="ti ti-door" /> Room &amp; Stay</div>
          <div className="form-row" style={{ gridTemplateColumns:"1fr 1fr 1fr" }}>
            <div className="form-group"><label>Room *</label>
              <select value={room} onChange={e=>setRoom(e.target.value)}>
                <option value="">Select</option>
                {availRooms.map(r=>(
                  <option key={r.number} value={r.number}>{r.number}{r.name?" — "+r.name:""} · {r.type} · ৳{r.rate.toLocaleString()}/n</option>
                ))}
              </select>
            </div>
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
          {/* Extra person charge box */}
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
                    <div><div style={{ fontSize:10, opacity:.7 }}>Base ({nights}n × ৳{selRoom.rate.toLocaleString()})</div><div style={{ textDecoration:"line-through", opacity:.5, fontSize:13 }}>৳{base.toLocaleString()}</div></div>
                    <div><div style={{ fontSize:10, opacity:.7 }}>Discount</div><div style={{ color:"var(--gold2)", fontWeight:700, fontSize:14 }}>−৳{discAmt.toLocaleString()}</div></div>
                    <div><div style={{ fontSize:10, opacity:.7 }}>Room Total</div><div style={{ fontSize:20, fontWeight:800, color:"var(--gold2)" }}>৳{roomTotal.toLocaleString()}</div></div>
                  </>
                ) : (
                  <div><div style={{ fontSize:10, opacity:.7 }}>{nights} night{nights>1?"s":""} × ৳{selRoom.rate.toLocaleString()}</div><div style={{ fontSize:20, fontWeight:800, color:"var(--gold2)" }}>৳{roomTotal.toLocaleString()}</div></div>
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

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={()=>doSave("confirmed")}><i className="ti ti-calendar" /> Save Reservation</button>
          <button className="btn primary" onClick={()=>doSave("checked-in")}><i className="ti ti-login" /> Check In Now</button>
        </div>
      </div>
    </div>
  );
}

`;

// Insert the new modal before the export
bk = bk.replace('\nexport default function Bookings()', newModal + '\nexport default function Bookings()');

fs.writeFileSync(path, bk, 'utf8');
console.log('NewBookingModal rebuilt to match original HTML — done');
