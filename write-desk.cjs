const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Desk.jsx';

const code = `import { useState } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money, bookingConflicts, getRoomDisplayStatus, maxId } from "../utils/helpers";

function RoomModal({ room, onClose }) {
  const { curUser, bookings, updateBookings, revenues, updateRevenues, notify } = useApp();
  const today = todayStr();
  const tmr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const d2  = new Date(Date.now() + 172800000).toISOString().split("T")[0];
  const bIn  = bookings.find(b => b.room === room.number && b.status === "checked-in");
  const bRes = bookings.find(b => b.room === room.number && b.status === "confirmed" && b.checkin <= today && b.checkout > today);
  const future = bookings
    .filter(b => b.room === room.number && b.status === "confirmed" && b.checkin > today)
    .sort((a, b) => a.checkin > b.checkin ? 1 : -1);

  const [nm,  setNm]  = useState("");
  const [ph,  setPh]  = useState("");
  const [ci,  setCi]  = useState(bRes ? tmr : today);
  const [co,  setCo]  = useState(bRes ? d2  : tmr);
  const [adv, setAdv] = useState(0);
  const [mtd, setMtd] = useState("Cash");
  const [txn, setTxn] = useState("");
  const [nt,  setNt]  = useState("");

  function calcP() {
    if (!ci || !co || new Date(co) <= new Date(ci)) return null;
    const n = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    const t = n * room.rate;
    return { n, t, b: Math.max(0, t - adv) };
  }

  function doRes() {
    if (!nm.trim()) { notify("Guest name required", "error"); return; }
    if (!ph.trim()) { notify("Mobile required", "error"); return; }
    if (!ci || !co || new Date(co) <= new Date(ci)) { notify("Check dates", "error"); return; }
    if (bookingConflicts(room.number, ci, co, null, bookings)) { notify("Already reserved for those dates", "error"); return; }
    const n = Math.max(1, Math.round((new Date(co) - new Date(ci)) / 86400000));
    const amt = n * room.rate;
    const id  = maxId(bookings);
    const a   = parseFloat(adv) || 0;
    const t   = ["bKash","Nagad"].includes(mtd) ? txn : "";
    const bk  = { id, guest: nm.trim(), phone: ph.trim(), room: room.number, type: room.type,
      checkin: ci, checkout: co, nights: n, amount: amt, advance: a,
      paymentHistory: a > 0 ? [{ ts: new Date().toISOString(), amount: a, method: mtd, txnNumber: t, note: "Reservation advance", type: "room", by: curUser || "staff" }] : [],
      paymentMethod: mtd, txnNumber: t, status: "confirmed", notes: nt.trim(),
      source: "Walk-in", adults: 2, children: 0, nationality: "", discountType: "none",
      discountAmount: 0, createdAt: new Date().toISOString(), by: curUser || "staff" };
    updateBookings([...bookings, bk]);
    if (a > 0) updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: a, date: today, note: nm.trim() + " Rm " + room.number + " - deposit (" + mtd + ")", bookingId: id }]);
    notify("Room " + room.number + " reserved for " + nm.trim() + (a > 0 ? " - Advance: " + money(a) : ""), "success");
    onClose();
  }

  function cancelRes(bid) {
    if (!window.confirm("Cancel this reservation?")) return;
    updateBookings(bookings.map(b => b.id === bid ? { ...b, status: "cancelled" } : b));
    notify("Reservation cancelled", "success");
    onClose();
  }

  function chkOut(bid) {
    const b = bookings.find(x => x.id === bid); if (!b) return;
    const tot = b.invoiceTotal != null ? b.invoiceTotal : b.amount;
    const out = Math.max(0, tot - ((b.advance || 0) + (b.extrasAdvance || 0)));
    if (out > 0 && window.confirm("Outstanding balance: " + money(out) + ".\\n\\nCollected at checkout? OK=Yes  Cancel=No"))
      updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: out, date: today, note: b.guest + " Rm " + b.room + " - collected at checkout", bookingId: bid }]);
    updateBookings(bookings.map(x => x.id === bid ? { ...x, status: "checked-out" } : x));
    notify(b.guest + " checked out", "success");
    onClose();
  }

  const p = calcP();
  const needsTxn = ["bKash","Nagad"].includes(mtd);

  function FRow({ b }) {
    return (
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#fffbee", border:"1.5px solid #FCD34D", borderRadius:8, marginBottom:6 }}>
        <i className="ti ti-calendar-event" style={{ color:"#F59E0B", fontSize:15, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700 }}>{b.guest}</div>
          <div style={{ fontSize:11, color:"var(--text3)" }}>{b.checkin} to {b.checkout} | {b.nights}n | {money(b.amount)}</div>
        </div>
        <button className="btn sm danger" style={{ fontSize:10, padding:"4px 8px" }} onClick={() => cancelRes(b.id)}><i className="ti ti-x" /></button>
      </div>
    );
  }

  function QRForm() {
    return (
      <>
        <div className="form-row">
          <div className="form-group"><label>Guest Name *</label><input value={nm} onChange={e => setNm(e.target.value)} placeholder="Full name" /></div>
          <div className="form-group"><label>Mobile *</label><input value={ph} onChange={e => setPh(e.target.value)} placeholder="+880..." /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Check-in *</label><input type="date" value={ci} onChange={e => setCi(e.target.value)} /></div>
          <div className="form-group"><label>Check-out *</label><input type="date" value={co} onChange={e => setCo(e.target.value)} /></div>
        </div>
        <div style={{ background:"var(--navy)", color:"#fff", borderRadius:8, padding:"11px 14px", textAlign:"center", fontSize:13, marginBottom:12, minHeight:48, display:"flex", alignItems:"center", justifyContent:"center" }}>
          {p ? (
            <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"center", gap:"8px 20px", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:10, opacity:.65 }}>{p.n} night{p.n > 1 ? "s" : ""} x {money(room.rate)}</div>
                <div style={{ fontSize:18, fontWeight:800, color:"var(--gold2)" }}>{money(p.t)}</div>
              </div>
              {adv > 0 && <>
                <div style={{ borderLeft:"1px solid rgba(255,255,255,.2)", paddingLeft:20 }}>
                  <div style={{ fontSize:10, opacity:.65 }}>Advance</div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#6de8a8" }}>-{money(adv)}</div>
                </div>
                <div>
                  <div style={{ fontSize:10, opacity:.65 }}>Balance Due</div>
                  <div style={{ fontSize:18, fontWeight:800, color: p.b > 0 ? "#f5a0a0" : "#6de8a8" }}>{money(p.b)}</div>
                </div>
              </>}
            </div>
          ) : <span style={{ opacity:.6, fontSize:12 }}>Select valid dates</span>}
        </div>
        <div className="form-row">
          <div className="form-group"><label>Advance (BDT)</label><input type="number" value={adv} min="0" onChange={e => setAdv(parseFloat(e.target.value) || 0)} /></div>
          <div className="form-group"><label>Payment Method</label>
            <select value={mtd} onChange={e => setMtd(e.target.value)}>
              {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        {needsTxn && <div className="form-group"><label>Transaction Number</label><input value={txn} onChange={e => setTxn(e.target.value)} placeholder="01X-XXXXXXXXXX" /></div>}
        <div className="form-group"><label>Notes</label><input value={nt} onChange={e => setNt(e.target.value)} placeholder="Special requests..." /></div>
      </>
    );
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:520 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="ti ti-building" style={{ color:"var(--gold)" }} /> Room {room.number}{room.name ? " - " + room.name : ""}</div>
            <div className="modal-sub">{room.type} - {money(room.rate)}/night</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        {bIn && (<>
          <div style={{ background:"var(--green-bg)", border:"1.5px solid var(--green-bd)", borderRadius:9, padding:13, marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--green)", textTransform:"uppercase", marginBottom:10 }}>Checked In</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, fontSize:12 }}>
              {[["Guest",bIn.guest],["Phone",bIn.phone],["Check-out",bIn.checkout],["Balance",money(Math.max(0,(bIn.invoiceTotal??bIn.amount)-(bIn.advance||0)))]].map(([l,v]) => (
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
            <div style={{ fontSize:11, fontWeight:800, color:"#8a6200", textTransform:"uppercase", marginBottom:10, display:"flex", alignItems:"center", gap:6 }}><i className="ti ti-calendar-check" /> Reserved - Awaiting Check-In</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, fontSize:12, marginBottom:10 }}>
              {[["Guest",bRes.guest],["Mobile",bRes.phone],["Check-in",bRes.checkin],["Check-out",bRes.checkout],["Nights",bRes.nights],["Total",money(bRes.invoiceTotal??bRes.amount)],["Advance Paid",money(bRes.advance||0)],["Balance Due",money(Math.max(0,(bRes.invoiceTotal??bRes.amount)-(bRes.advance||0)))]].map(([l,v]) => (
                <div key={l}><div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>{l}</div><strong>{v}</strong></div>
              ))}
            </div>
            {bRes.notes && <div style={{ fontSize:11, color:"var(--text3)", paddingTop:6, borderTop:"1px solid rgba(201,168,76,.2)" }}>{bRes.notes}</div>}
          </div>
          {future.length > 0 && <><div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Upcoming</div>{future.map(b => <FRow key={b.id} b={b} />)}</>}
          <div style={{ borderTop:"1px dashed var(--border)", margin:"12px 0 10px" }} />
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:12 }}>Add Another Reservation</div>
          <QRForm />
          <div className="modal-actions">
            <button className="btn danger" style={{ marginRight:"auto" }} onClick={() => cancelRes(bRes.id)}><i className="ti ti-calendar-x" /> Cancel Current</button>
            <button className="btn" onClick={onClose}>Close</button>
            <button className="btn primary" onClick={doRes}><i className="ti ti-calendar-check" /> Reserve Again</button>
          </div>
        </>)}

        {!bIn && !bRes && (<>
          {future.length > 0 && <>
            <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Upcoming Reservations</div>
            {future.map(b => <FRow key={b.id} b={b} />)}
            <div style={{ borderTop:"1px dashed var(--border)", margin:"12px 0 10px" }} />
          </>}
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:12 }}>New Reservation</div>
          <QRForm />
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={doRes}><i className="ti ti-calendar-check" /> Reserve Room</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

export default function Desk() {
  const { curRole, rooms, bookings, revenues, expenses, updateBookings, updateRevenues, notify } = useApp();
  const [sel, setSel] = useState(null);
  const today = todayStr();
  const tRev  = revenues.reduce((s,r) => s+r.amount, 0);
  const tExp  = expenses.reduce((s,e) => s+e.amount, 0);
  const profit = tRev - tExp;
  const occ   = rooms.filter(r => getRoomDisplayStatus(r, bookings, today) === "occupied").length;
  const occPct = rooms.length ? Math.round(occ/rooms.length*100) : 0;
  const inhouse    = bookings.filter(b => b.status === "checked-in");
  const arrivals   = bookings.filter(b => b.checkin === today && b.status === "confirmed");
  const departures = bookings.filter(b => b.checkout === today && b.status !== "cancelled");
  const dRev = revenues.filter(r => r.date === today).reduce((s,r) => s+r.amount, 0);
  const dExp = expenses.filter(e => e.date === today).reduce((s,e) => s+e.amount, 0);

  function chkOut(bid) {
    const b = bookings.find(x => x.id === bid); if (!b) return;
    const tot = b.invoiceTotal != null ? b.invoiceTotal : b.amount;
    const out = Math.max(0, tot - ((b.advance || 0) + (b.extrasAdvance || 0)));
    if (out > 0 && window.confirm("Outstanding: " + money(out) + ". Collected now? OK=Yes Cancel=No"))
      updateRevenues([...revenues, { id: maxId(revenues), source: "Room Rent", amount: out, date: today, note: b.guest + " Rm " + b.room + " - checkout", bookingId: bid }]);
    updateBookings(bookings.map(x => x.id === bid ? { ...x, status: "checked-out" } : x));
    notify(b.guest + " checked out", "success");
  }

  function Card({ b, showIn, showOut }) {
    return (
      <div className="arr-item">
        <div className="arr-room">Rm<br />{b.room}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:13 }}>{b.guest}</div>
          <div style={{ fontSize:11, color:"var(--text3)" }}>{b.phone} - {b.nights}n - {money(b.amount)}</div>
        </div>
        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
          {showIn  && b.status === "confirmed"   && <button className="btn sm primary" onClick={() => setSel(rooms.find(r => r.number === b.room))}><i className="ti ti-login" /> In</button>}
          {showOut && b.status === "checked-in"  && <button className="btn sm gold" onClick={() => chkOut(b.id)}><i className="ti ti-logout" /> Out</button>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:"22px 24px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ display:"grid", gridTemplateColumns: curRole === "admin" ? "repeat(4,1fr)" : "repeat(2,1fr)", gap:12, marginBottom:20 }}>
        <div className="metric blue"><div className="metric-icon"><i className="ti ti-percentage" /></div><div className="metric-label">Occupancy</div><div className="metric-value">{occPct}%</div><div className="occ-bar-track"><div className="occ-bar-fill" style={{ width:occPct+"%" }} /></div><div className="metric-sub">{occ} of {rooms.length} rooms</div></div>
        <div className="metric amber"><div className="metric-icon"><i className="ti ti-calendar-event" /></div><div className="metric-label">Today</div><div style={{ display:"flex", gap:16, marginTop:6 }}><div className="stat-chip" style={{ color:"var(--green)" }}><span className="stat-chip-val">{arrivals.length}</span><span className="stat-chip-lbl">In</span></div><div className="stat-chip" style={{ color:"var(--red)" }}><span className="stat-chip-val">{departures.length}</span><span className="stat-chip-lbl">Out</span></div><div className="stat-chip" style={{ color:"var(--blue)" }}><span className="stat-chip-val">{inhouse.length}</span><span className="stat-chip-lbl">Staying</span></div></div></div>
        {curRole === "admin" && <>
          <div className="metric gold"><div className="metric-icon"><i className="ti ti-receipt" /></div><div className="metric-label">Total Revenue</div><div className="metric-value" style={{ fontSize:19 }}>{money(tRev)}</div></div>
          <div className="metric green"><div className="metric-icon"><i className="ti ti-trending-up" /></div><div className="metric-label">Net Profit</div><div className="metric-value" style={{ fontSize:19, color: profit >= 0 ? "var(--green)" : "var(--red)" }}>{money(profit)}</div></div>
        </>}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:18, marginBottom:20 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", letterSpacing:.8, marginBottom:10 }}>Rooms</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {rooms.map(r => {
              const ds = getRoomDisplayStatus(r, bookings, today);
              const fc = bookings.filter(b => b.room === r.number && b.status === "confirmed" && b.checkin > today).length;
              return (
                <div key={r.id} className={"room-card " + ds} style={{ position:"relative", cursor:"pointer" }} onClick={() => setSel(r)}>
                  {fc > 0 && <div style={{ position:"absolute", top:6, right:6, background:"#F59E0B", color:"#fff", fontSize:8, fontWeight:800, borderRadius:8, padding:"1px 5px", lineHeight:1.5 }}>{fc} booked</div>}
                  <div className="room-number">{r.number}</div>
                  <div className="room-name-lbl">{r.name || r.type}</div>
                  <div className="room-type-lbl">{r.type}</div>
                  <div className="room-rate-lbl">{money(r.rate)}</div>
                  <div className="room-status">{ds.replace("-"," ")}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div className="panel"><div className="panel-header"><div className="panel-title"><i className="ti ti-login" style={{ color:"var(--green)" }} /> Arrivals</div></div>{arrivals.length ? arrivals.map(b => <Card key={b.id} b={b} showIn showOut={false} />) : <div style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:14 }}>No arrivals today</div>}</div>
          <div className="panel"><div className="panel-header"><div className="panel-title"><i className="ti ti-logout" style={{ color:"var(--red)" }} /> Departures</div></div>{departures.length ? departures.map(b => <Card key={b.id} b={b} showIn={false} showOut />) : <div style={{ color:"var(--text3)", fontSize:13, textAlign:"center", padding:14 }}>No departures today</div>}</div>
          <div className="panel"><div className="panel-header"><div className="panel-title"><i className="ti ti-chart-pie" /> Today P&L</div></div><div style={{ padding:"8px 14px" }}><div className="pl-row"><span>Revenue</span><span style={{ color:"var(--green)", fontWeight:600 }}>{money(dRev)}</span></div><div className="pl-row"><span>Expenses</span><span style={{ color:"var(--red)", fontWeight:600 }}>{money(dExp)}</span></div><div className="pl-row total"><span>Net</span><span style={{ color: dRev-dExp>=0?"var(--green)":"var(--red)" }}>{money(dRev-dExp)}</span></div></div></div>
        </div>
      </div>

      <div className="panel"><div className="panel-header"><div className="panel-title"><i className="ti ti-users" /> In-House Guests</div></div>
        <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead><tr style={{ background:"var(--navy2)", color:"var(--gold)" }}>{["Guest","Room","Check-in","Check-out","Nights","Amount","Actions"].map(h => <th key={h} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, textTransform:"uppercase", letterSpacing:.5 }}>{h}</th>)}</tr></thead>
          <tbody>{inhouse.length ? inhouse.map(b => (
            <tr key={b.id} style={{ borderBottom:"1px solid var(--border)" }}>
              <td style={{ padding:"10px 12px" }}><strong>{b.guest}</strong><br /><span style={{ fontSize:11, color:"var(--text3)" }}>{b.phone}</span></td>
              <td style={{ padding:"10px 12px" }}><strong>Rm {b.room}</strong></td>
              <td style={{ padding:"10px 12px" }}>{b.checkin}</td>
              <td style={{ padding:"10px 12px" }}>{b.checkout}</td>
              <td style={{ padding:"10px 12px" }}>{b.nights}</td>
              <td style={{ padding:"10px 12px" }}><strong>{money(b.amount)}</strong></td>
              <td style={{ padding:"10px 12px" }}><button className="btn sm gold" onClick={() => chkOut(b.id)}><i className="ti ti-logout" /> Out</button></td>
            </tr>
          )) : <tr><td colSpan="7" style={{ textAlign:"center", color:"var(--text3)", padding:22 }}>No guests checked in</td></tr>}</tbody>
        </table></div>
      </div>

      {sel && <RoomModal room={sel} onClose={() => setSel(null)} />}
    </div>
  );
}
`;

fs.writeFileSync(path, code, 'utf8');
console.log('OK size=' + fs.statSync(path).size);
