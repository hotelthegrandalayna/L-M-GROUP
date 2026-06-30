import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { money } from "../../utils/helpers";

const ROOM_TYPES = ["Standard","Deluxe","Suite","Family","Executive","Presidential"];
const AMENITIES  = ["AC","WiFi","TV","Hot Water","Mini Bar","Balcony","Sea View","City View","Bathtub","Kitchenette"];

export default function AdminRooms() {
  const { rooms, setRooms, notify } = useApp();
  const [modal,   setModal]   = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [num,     setNum]     = useState("");
  const [name,    setName]    = useState("");
  const [type,    setType]    = useState("Standard");
  const [rate,    setRate]    = useState(0);
  const [floor,   setFloor]   = useState(1);
  const [amen,    setAmen]    = useState([]);
  const [notes,   setNotes]   = useState("");
  const [dualAC,  setDualAC]  = useState(false);   // AC/Non-AC toggle
  const [acRate,  setAcRate]  = useState(0);
  const [nonAcRate,setNonAcRate] = useState(0);

  function openNew() {
    setNum(""); setName(""); setType("Standard"); setRate(0); setFloor(1); setAmen([]); setNotes("");
    setDualAC(false); setAcRate(0); setNonAcRate(0);
    setModal("new");
  }

  function openEdit(r) {
    setNum(r.number||""); setName(r.name||""); setType(r.type||"Standard");
    setRate(r.rate||0); setFloor(r.floor||1); setAmen(r.amenities||[]); setNotes(r.notes||"");
    const hasDual = !!(r.acRate && r.nonAcRate);
    setDualAC(hasDual); setAcRate(r.acRate||r.rate||0); setNonAcRate(r.nonAcRate||0);
    setModal(r);
  }

  function save() {
    if (!num) { notify("Room number required","error"); return; }
    if (dualAC) {
      if (!(parseFloat(acRate)>0))    { notify("AC rate must be > 0","error"); return; }
      if (!(parseFloat(nonAcRate)>0)) { notify("Non-AC rate must be > 0","error"); return; }
    } else {
      if (!(parseFloat(rate)>0)) { notify("Rate must be > 0","error"); return; }
    }
    const mainRate = dualAC ? parseFloat(acRate) : parseFloat(rate)||0;
    const updated = {
      number:num, name:name.trim(), type, rate:mainRate,
      floor:parseInt(floor)||1, amenities:amen, notes:notes.trim(),
      acRate:  dualAC ? parseFloat(acRate)||0    : undefined,
      nonAcRate: dualAC ? parseFloat(nonAcRate)||0 : undefined,
    };
    setSyncing(true);
    const onSynced = (ok) => {
      setSyncing(false);
      if (ok) {
        notify("Room " + num + " saved ✓ — visible on all devices now", "success");
      } else {
        notify("⚠️ Room saved locally but failed to reach Supabase — check your internet or Supabase config", "error");
      }
    };
    if (modal==="new") {
      if (rooms.find(r=>r.number===num)) { notify("Room number already exists","error"); return; }
      const newId = rooms.length ? Math.max(...rooms.map(r=>r.id||0))+1 : 1;
      setRooms([...rooms, { ...updated, id:newId }], onSynced);
    } else {
      setRooms(rooms.map(r=>r.id===modal.id?{...r,...updated}:r), onSynced);
    }
    setModal(null);
  }

  function del(r) {
    if (!window.confirm("Delete Room "+r.number+"? This cannot be undone.")) return;
    setRooms(rooms.filter(x=>x.id!==r.id));
    notify("Room "+r.number+" deleted","success");
  }

  function toggleAmen(a) {
    setAmen(prev=>prev.includes(a)?prev.filter(x=>x!==a):[...prev,a]);
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <button className="btn primary sm" onClick={openNew}><i className="ti ti-plus" /> Add Room</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {rooms.map(r=>(
          <div key={r.id} className="panel" style={{ padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:"var(--navy)" }}>Rm {r.number}</div>
                <div style={{ fontSize:12, color:"var(--text3)" }}>{r.name||r.type} · Floor {r.floor||1}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                {r.acRate && r.nonAcRate ? (
                  <>
                    <div style={{ fontSize:13, fontWeight:800, color:"var(--gold2)" }}>AC: {money(r.acRate)}/n</div>
                    <div style={{ fontSize:11, fontWeight:700, color:"var(--text3)" }}>Non-AC: {money(r.nonAcRate)}/n</div>
                  </>
                ) : (
                  <div style={{ fontSize:16, fontWeight:800, color:"var(--gold2)" }}>{money(r.rate)}<span style={{ fontSize:10,fontWeight:400 }}>/n</span></div>
                )}
              </div>
            </div>
            <div style={{ fontSize:11, marginBottom:8, display:"flex", flexWrap:"wrap", gap:4 }}>
              {(r.amenities||[]).map(a=>(
                <span key={a} style={{ padding:"2px 7px",borderRadius:8,background:"var(--navy2)",color:"var(--gold)",fontSize:10,fontWeight:600 }}>{a}</span>
              ))}
            </div>
            {r.notes&&<div style={{ fontSize:11,color:"var(--text3)",marginBottom:8 }}>{r.notes}</div>}
            <div style={{ display:"flex", gap:6 }}>
              <button className="btn sm" style={{ flex:1 }} onClick={()=>openEdit(r)}><i className="ti ti-pencil" /> Edit</button>
              <button className="btn sm danger" onClick={()=>del(r)}><i className="ti ti-trash" /></button>
            </div>
          </div>
        ))}
      </div>

      {modal!==null && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal-box" style={{ }}>
            <div className="modal-header">
              <div className="modal-title"><i className="ti ti-building" style={{ color:"var(--gold)" }} /> {modal==="new"?"Add Room":"Edit Room "+(modal.number||"")}</div>
              <button className="modal-close" onClick={()=>setModal(null)}><i className="ti ti-x" /></button>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Room Number *</label><input value={num} onChange={e=>setNum(e.target.value)} placeholder="e.g. 101" /></div>
              <div className="form-group"><label>Room Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Ocean Suite" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Type</label>
                <select value={type} onChange={e=>setType(e.target.value)}>{ROOM_TYPES.map(t=><option key={t}>{t}</option>)}</select>
              </div>
              <div className="form-group"><label>Floor</label><input type="number" value={floor} min="1" onChange={e=>setFloor(e.target.value)} /></div>
            </div>
            {/* AC / Non-AC dual pricing toggle */}
            <div className="form-group">
              <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }}>
                <input type="checkbox" checked={dualAC} onChange={e=>setDualAC(e.target.checked)} style={{ width:16, height:16, accentColor:"var(--navy)" }} />
                <span style={{ fontWeight:700 }}>This room has AC &amp; Non-AC pricing</span>
              </label>
            </div>
            {dualAC ? (
              <div className="form-row">
                <div className="form-group">
                  <label><i className="ti ti-wind" style={{ color:"var(--navy)" }} /> AC Rate per Night (BDT) *</label>
                  <input type="number" value={acRate} min="0" onChange={e=>setAcRate(e.target.value)} placeholder="e.g. 2500" />
                </div>
                <div className="form-group">
                  <label><i className="ti ti-wind-off" style={{ color:"var(--text3)" }} /> Non-AC Rate per Night (BDT) *</label>
                  <input type="number" value={nonAcRate} min="0" onChange={e=>setNonAcRate(e.target.value)} placeholder="e.g. 1800" />
                </div>
              </div>
            ) : (
              <div className="form-group"><label>Rate per Night (BDT) *</label><input type="number" value={rate} min="0" onChange={e=>setRate(e.target.value)} /></div>
            )}
            <div className="form-group">
              <label>Amenities</label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:4 }}>
                {AMENITIES.map(a=>(
                  <button key={a} type="button" onClick={()=>toggleAmen(a)} style={{
                    padding:"4px 10px",borderRadius:16,border:"1.5px solid",cursor:"pointer",fontSize:11,fontWeight:600,
                    background:amen.includes(a)?"var(--navy)":"transparent",
                    color:amen.includes(a)?"var(--gold)":"var(--text3)",
                    borderColor:amen.includes(a)?"var(--navy)":"var(--border)" }}>{a}</button>
                ))}
              </div>
            </div>
            <div className="form-group"><label>Notes</label><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special notes about this room" /></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn primary" onClick={save} disabled={syncing}>
                <i className={"ti " + (syncing ? "ti-loader-2" : "ti-device-floppy")} />
                {syncing ? " Saving to cloud..." : modal==="new" ? " Add Room" : " Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
