const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Bookings.jsx';

const code = `import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money, formatDate, nightsBetween, bookingConflicts, maxId } from "../utils/helpers";

const STATUS_COLORS = {
  confirmed:    { bg:"#fffbee", border:"#FCD34D", color:"#8a6200", icon:"ti-calendar-check" },
  "checked-in": { bg:"#f0fdf4", border:"#86efac", color:"#166534", icon:"ti-login" },
  "checked-out":{ bg:"#f8fafc", border:"#cbd5e1", color:"#475569", icon:"ti-logout" },
  cancelled:    { bg:"#fff1f2", border:"#fca5a5", color:"#991b1b", icon:"ti-calendar-x" },
};

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
    const updated = bookings.map(x => x.id === b.id ? { ...x, paymentHistory: [...history, entry] } : x);
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
      <div className="modal-box" style={{ maxWidth:540 }}>
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

export default function Bookings() {
  const { rooms, bookings, notify } = useApp();
  const today = todayStr();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [sel, setSel]   = useState(null);
  const [sortKey, setSortKey] = useState("id");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    let arr = [...bookings];
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
  }, [bookings, filter, search, dateFrom, dateTo, sortKey, sortDir]);

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
    <div style={{ padding:"22px 24px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Bookings</div>
          <div style={{ fontSize:12, color:"var(--text3)" }}>{bookings.length} total reservations</div>
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding:"6px 14px", borderRadius:20, border:"1.5px solid", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all .15s",
            background: filter===f ? "var(--navy)" : "transparent",
            color:      filter===f ? "#fff" : "var(--text3)",
            borderColor: filter===f ? "var(--navy)" : "var(--border)",
          }}>
            {f==="all" ? "All" : f.replace("-"," ")} <span style={{ fontSize:10, opacity:.7 }}>({counts[f]})</span>
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
        <span><i className="ti ti-list" /> Showing {filtered.length} of {bookings.length}</span>
        <span><i className="ti ti-currency-taka" style={{ color:"var(--gold2)" }} /> Total: {money(filtered.reduce((s,b)=>s+(b.invoiceTotal??b.amount),0))}</span>
        <span style={{ color:"var(--green)" }}><i className="ti ti-circle-check" /> Paid: {money(filtered.reduce((s,b)=>s+(b.paymentHistory||[]).reduce((a,p)=>a+p.amount,0),0))}</span>
        <span style={{ color:"var(--red)" }}><i className="ti ti-alert-circle" /> Due: {money(filtered.reduce((s,b)=>{ const inv=b.invoiceTotal??b.amount; const pd=(b.paymentHistory||[]).reduce((a,p)=>a+p.amount,0); return s+Math.max(0,inv-pd); },0))}</span>
      </div>

      {sel && <BookingModal booking={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
`;

fs.writeFileSync(path, code, 'utf8');
console.log('OK size=' + fs.statSync(path).size);
