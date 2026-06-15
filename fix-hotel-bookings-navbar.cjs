const fs = require('fs');
const src = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src';

// ── Fix Navbar.jsx ─────────────────────────────────────────────────────────
fs.writeFileSync(src + '/components/Navbar.jsx', `
import { useApp } from '../context/AppContext';

const TABS = [
  { id: 'desk',      icon: '🏠', label: 'Desk'      },
  { id: 'bookings',  icon: '📋', label: 'Bookings'  },
  { id: 'invoice',   icon: '🧾', label: 'Invoice'   },
  { id: 'expenses',  icon: '💸', label: 'Expenses'  },
  { id: 'crm',       icon: '👥', label: 'CRM'       },
  { id: 'insights',  icon: '📊', label: 'Insights'  },
  { id: 'marketing', icon: '📣', label: 'Marketing' },
  { id: 'admin',     icon: '⚙️', label: 'Admin'     },
];

export default function Navbar({ onSwitchApp }) {
  const { curUser, curRole, activeTab, setActiveTab, logout } = useApp();

  return (
    <nav style={{
      background: 'linear-gradient(135deg,#1a1a2e 0%,#3d1a1a 100%)',
      display: 'flex', alignItems: 'center', gap: 0,
      height: 54, flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
      padding: '0 16px',
    }}>
      {/* Brand */}
      <div style={{ display:'flex', alignItems:'center', gap:9, paddingRight:16, borderRight:'1px solid rgba(255,255,255,.1)', flexShrink:0 }}>
        <div style={{ width:34, height:34, borderRadius:8, background:'#7B1212', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Playfair Display',serif", fontWeight:700, fontSize:14, color:'#c9a84c', flexShrink:0 }}>GA</div>
        <div style={{ lineHeight:1.2 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#f2dfc0', fontFamily:"'Playfair Display',serif", whiteSpace:'nowrap' }}>Hotel The Grand Alayna</div>
          <div style={{ fontSize:9, color:'#c9a84c', letterSpacing:1, textTransform:'uppercase' }}>Sitakunda · Chattogram</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', flex:1, overflowX:'auto', scrollbarWidth:'none', alignItems:'stretch', height:'100%' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '0 12px', height: '100%', background: 'none', border: 'none', cursor: 'pointer',
            borderBottom: activeTab === t.id ? '3px solid #c9a84c' : '3px solid transparent',
            borderTop: '3px solid transparent', fontFamily: 'inherit', flexShrink: 0,
            opacity: activeTab === t.id ? 1 : 0.7, transition: 'all .15s',
          }}>
            <span style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#c9a84c', letterSpacing: .5, textTransform: 'uppercase', marginTop: 2 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0, paddingLeft:12, borderLeft:'1px solid rgba(255,255,255,.1)' }}>
        <div style={{ lineHeight:1.3, textAlign:'right' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#f2dfc0' }}>{curUser}</div>
          <div style={{ fontSize:9, fontWeight:800, color:'#c9a84c', textTransform:'uppercase', letterSpacing:.5 }}>{curRole}</div>
        </div>
        {onSwitchApp && (
          <button onClick={onSwitchApp} style={{ padding:'5px 9px', borderRadius:7, border:'1px solid rgba(201,168,76,.4)', background:'rgba(201,168,76,.1)', color:'#f0d080', fontSize:10, fontFamily:'inherit', cursor:'pointer', fontWeight:700, whiteSpace:'nowrap' }}>⇄ Hall</button>
        )}
        <button onClick={logout} style={{ background:'rgba(255,255,255,.08)', border:'none', cursor:'pointer', color:'#f2dfc0', fontSize:16, padding:'6px 8px', borderRadius:7 }} title="Sign out">⏻</button>
      </div>
    </nav>
  );
}
`, 'utf8');

// ── Fix Bookings.jsx — add New Booking modal ──────────────────────────────────
let bk = fs.readFileSync(src + '/components/Bookings.jsx', 'utf8');

// Insert NewBookingModal component before the existing Bookings function export
const newBookingModal = `
// ─── New Booking Modal ─────────────────────────────────────────────────────
function NewBookingModal({ onClose }) {
  const { curUser, rooms, bookings, updateBookings, revenues, updateRevenues, notify } = useApp();
  const today = todayStr();
  const tmr   = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [room, setRoom]  = useState("");
  const [nm,   setNm]    = useState("");
  const [ph,   setPh]    = useState("");
  const [addr, setAddr]  = useState("");
  const [src,  setSrc]   = useState("Walk-in");
  const [adults, setAdults] = useState(2);
  const [ci,   setCi]    = useState(today);
  const [co,   setCo]    = useState(tmr);
  const [adv,  setAdv]   = useState(0);
  const [mtd,  setMtd]   = useState("Cash");
  const [txn,  setTxn]   = useState("");
  const [nt,   setNt]    = useState("");

  const SOURCES = ["Walk-in","Phone","Online","Agent","Referral","OTA","Other"];
  const PAY_METHODS = ["Cash","Card","bKash","Nagad","Bank Transfer","Cheque"];
  const needsTxn = ["bKash","Nagad"].includes(mtd);

  const selRoom = rooms.find(r => String(r.number) === String(room));

  function calcP() {
    if (!selRoom || !ci || !co || new Date(co) <= new Date(ci)) return null;
    const n = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    const t = n * selRoom.rate;
    const a = parseFloat(adv) || 0;
    return { n, t, b: Math.max(0, t - a) };
  }

  function doSave() {
    if (!nm.trim())   { notify("Guest name required", "error"); return; }
    if (!ph.trim())   { notify("Mobile required", "error"); return; }
    if (!selRoom)     { notify("Select a room", "error"); return; }
    if (!ci || !co || new Date(co) <= new Date(ci)) { notify("Check dates — check-out must be after check-in", "error"); return; }
    if (bookingConflicts(selRoom.number, ci, co, null, bookings)) { notify("Room already booked for those dates", "error"); return; }
    const n   = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    const amt = n * selRoom.rate;
    const id  = maxId(bookings);
    const a   = parseFloat(adv) || 0;
    const t   = needsTxn ? txn : "";
    const bkObj = {
      id, guest: nm.trim(), phone: ph.trim(), address: addr.trim(),
      room: selRoom.number, type: selRoom.type,
      checkin: ci, checkout: co, nights: n, amount: amt, advance: a,
      paymentHistory: a > 0 ? [{ ts: new Date().toISOString(), amount: a, method: mtd, txnNumber: t, note: "Advance paid", type: "room", by: curUser || "staff" }] : [],
      paymentMethod: mtd, txnNumber: t, status: "confirmed",
      notes: nt.trim(), source: src, adults: parseInt(adults) || 2,
      children: 0, nationality: "", discountType: "none", discountAmount: 0,
      createdAt: new Date().toISOString(), by: curUser || "staff",
    };
    updateBookings([...bookings, bkObj]);
    if (a > 0) updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: a, date: today, note: nm.trim() + " Rm " + selRoom.number + " - advance (" + mtd + ")", bookingId: id }]);
    notify("Booking created — Rm " + selRoom.number + " for " + nm.trim(), "success");
    onClose();
  }

  const p = calcP();
  const vacantRooms = rooms.filter(r => {
    if (!ci || !co) return true;
    return !bookingConflicts(r.number, ci, co, null, bookings);
  });

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:580, maxHeight:"90vh", overflowY:"auto" }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">📋 New Booking</div>
            <div className="modal-sub">Create a new reservation</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {/* Guest Info */}
        <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8, letterSpacing:.5 }}>Guest Information</div>
        <div className="form-row">
          <div className="form-group"><label>Guest Name *</label><input value={nm} onChange={e=>setNm(e.target.value)} placeholder="Full name" autoFocus /></div>
          <div className="form-group"><label>Mobile *</label><input value={ph} onChange={e=>setPh(e.target.value)} placeholder="+880..." /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Address</label><input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="Optional" /></div>
          <div className="form-group"><label>Adults</label><input type="number" value={adults} min={1} onChange={e=>setAdults(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Source</label>
            <select value={src} onChange={e=>setSrc(e.target.value)}>
              {SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Dates first so available rooms can update */}
        <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8, letterSpacing:.5, marginTop:4 }}>Dates</div>
        <div className="form-row">
          <div className="form-group"><label>Check-in *</label><input type="date" value={ci} onChange={e=>setCi(e.target.value)} /></div>
          <div className="form-group"><label>Check-out *</label><input type="date" value={co} onChange={e=>setCo(e.target.value)} /></div>
        </div>

        {/* Room */}
        <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8, letterSpacing:.5, marginTop:4 }}>Room</div>
        <div className="form-group">
          <label>Select Room * {ci&&co?<span style={{fontWeight:400,textTransform:'none',color:'var(--green)'}}>(showing available rooms for selected dates)</span>:""}</label>
          <select value={room} onChange={e=>setRoom(e.target.value)}>
            <option value="">— Choose a room —</option>
            {vacantRooms.map(r=>(
              <option key={r.number} value={r.number}>Rm {r.number} — {r.type} — ৳{r.rate.toLocaleString()}/night</option>
            ))}
          </select>
        </div>

        {/* Bill summary */}
        <div style={{ background:"var(--navy)", color:"#fff", borderRadius:10, padding:"14px 16px", textAlign:"center", marginBottom:14, minHeight:52, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {p ? (
            <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"8px 24px", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:10, opacity:.6 }}>{p.n} night{p.n>1?"s":""} × ৳{selRoom?.rate?.toLocaleString()}</div>
                <div style={{ fontSize:20, fontWeight:800, color:"var(--gold2)" }}>৳{p.t.toLocaleString()}</div>
              </div>
              {parseFloat(adv)>0 && <>
                <div style={{ borderLeft:"1px solid rgba(255,255,255,.2)", paddingLeft:24 }}>
                  <div style={{ fontSize:10, opacity:.6 }}>Advance</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#6de8a8" }}>-৳{(parseFloat(adv)||0).toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, opacity:.6 }}>Balance Due</div>
                  <div style={{ fontSize:20, fontWeight:800, color: p.b>0?"#f5a0a0":"#6de8a8" }}>৳{p.b.toLocaleString()}</div>
                </div>
              </>}
            </div>
          ) : <span style={{ opacity:.5, fontSize:12 }}>Select room and dates to see total</span>}
        </div>

        {/* Payment */}
        <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:8, letterSpacing:.5 }}>Advance Payment</div>
        <div className="form-row">
          <div className="form-group"><label>Advance (৳)</label><input type="number" value={adv} min="0" onChange={e=>setAdv(e.target.value)} /></div>
          <div className="form-group"><label>Method</label>
            <select value={mtd} onChange={e=>setMtd(e.target.value)}>
              {PAY_METHODS.map(m=><option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {needsTxn && <div className="form-group"><label>Transaction / Ref #</label><input value={txn} onChange={e=>setTxn(e.target.value)} placeholder="Transaction number" /></div>}
        <div className="form-group"><label>Notes</label><textarea value={nt} onChange={e=>setNt(e.target.value)} rows={2} style={{ resize:"vertical" }} placeholder="Special requests, notes..." /></div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={doSave}><i className="ti ti-calendar-plus" /> Confirm Booking</button>
        </div>
      </div>
    </div>
  );
}

`;

// Find the export default function Bookings line and insert before it
const insertBefore = 'export default function Bookings()';
bk = bk.replace(insertBefore, newBookingModal + insertBefore);

// Add useState for showNewBooking modal
bk = bk.replace(
  `  const [sortKey, setSortKey] = useState("checkin");\n  const [sortDir, setSortDir] = useState("desc");\n  const [sel,     setSel]     = useState(null);`,
  `  const [sortKey, setSortKey]         = useState("checkin");\n  const [sortDir, setSortDir]         = useState("desc");\n  const [sel,     setSel]             = useState(null);\n  const [showNew, setShowNew]         = useState(false);`
);

// Add "New Booking" button in the header
bk = bk.replace(
  `        <div>\n          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Bookings</div>\n          <div style={{ fontSize:12, color:"var(--text3)" }}>{bookings.length} total reservations</div>\n        </div>\n      </div>`,
  `        <div>\n          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Bookings</div>\n          <div style={{ fontSize:12, color:"var(--text3)" }}>{bookings.length} total reservations</div>\n        </div>\n        <button className="btn primary" onClick={()=>setShowNew(true)}><i className="ti ti-calendar-plus" /> New Booking</button>\n      </div>`
);

// Add the modal just before the closing return </div> — find the last line before closing
bk = bk.replace(
  `      {sel && <BookingModal booking={sel} onClose={() => setSel(null)} />}\n    </div>\n  );\n}`,
  `      {sel     && <BookingModal  booking={sel} onClose={() => setSel(null)} />}\n      {showNew && <NewBookingModal onClose={() => setShowNew(false)} />}\n    </div>\n  );\n}`
);

fs.writeFileSync(src + '/components/Bookings.jsx', bk, 'utf8');

console.log('Navbar.jsx rewritten, Bookings.jsx patched with New Booking modal — done');
