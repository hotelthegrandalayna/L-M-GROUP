import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { todayStr } from "../utils/helpers";
import {
  pendingTasks, freqLabel, scheduledOn, saveTaskPhoto, loadTaskPhoto,
  DAY_LABELS, PHOTO_TTL_DAYS,
} from "../utils/tasks";

const C = { navy:"#1e3a5f", gold:"#c9a84c", dim:"#666", border:"#cdd7e4", green:"#1a7040", red:"#c0392b", orange:"#e67e22" };
const FREQS = [
  { v:"daily",   l:"Daily" },
  { v:"weekly",  l:"Weekly (choose days)" },
  { v:"monthly", l:"Monthly (choose date)" },
  { v:"once",    l:"One-time (specific date)" },
];

function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${y}`;
}
const blankForm = (today) => ({ id:null, title:"", notes:"", freq:"daily", days:[], date:1, onceDate:today, active:true });

export default function Tasks() {
  const { tasks, setTasks, taskDone, setTaskDone, curRole, curUser, notify } = useApp();
  const today = todayStr();
  const isAdmin = curRole === "admin";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

  const [doneModal, setDoneModal] = useState(null); // { task, due }
  const [photoData, setPhotoData] = useState("");
  const [form, setForm] = useState(() => blankForm(today));
  const [editing, setEditing] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null); // dataUrl or "loading"|"expired"

  const pending = useMemo(() => pendingTasks(tasks, taskDone, today), [tasks, taskDone, today]);

  // ── Mark a task done (with optional proof photo) ──
  async function confirmDone() {
    const { task, due } = doneModal;
    if (photoData) { try { await saveTaskPhoto(task.id, due, photoData); } catch {} }
    setTaskDone(prev => ({ ...prev, [`${task.id}_${due}`]: { by: curUser || "staff", at: new Date().toISOString(), hasPhoto: !!photoData } }));
    notify(`"${task.title}" marked done ✓`, "success");
    setDoneModal(null); setPhotoData("");
  }

  function pickPhoto(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notify("Max 5MB photo", "error"); return; }
    const r = new FileReader(); r.onload = ev => setPhotoData(ev.target.result); r.readAsDataURL(file);
  }

  // ── Admin: save / edit / delete task ──
  function saveTask() {
    if (!form.title.trim()) { notify("Task name required", "error"); return; }
    if (form.freq === "weekly" && !form.days.length) { notify("Pick at least one weekday", "error"); return; }
    if (form.id) {
      setTasks(prev => prev.map(t => t.id === form.id ? { ...t, ...form, title: form.title.trim() } : t));
      notify("Task updated", "success");
    } else {
      setTasks(prev => [...prev, { ...form, id: String(Date.now()), title: form.title.trim(), createdAt: new Date().toISOString() }]);
      notify("Task added", "success");
    }
    setForm(blankForm(today)); setEditing(false);
  }
  function editTask(t) { setForm({ ...blankForm(today), ...t }); setEditing(true); window.scrollTo({ top:0, behavior:"smooth" }); }
  function deleteTask(t) {
    if (!window.confirm(`Delete task "${t.title}"?`)) return;
    setTasks(prev => prev.filter(x => x.id !== t.id));
    notify("Task deleted", "success");
  }
  function toggleActive(t) { setTasks(prev => prev.map(x => x.id === t.id ? { ...x, active: x.active === false } : x)); }
  function toggleDay(d) { setForm(f => ({ ...f, days: f.days.includes(d) ? f.days.filter(x=>x!==d) : [...f.days, d].sort() })); }

  async function showPhoto(taskId, due, hasPhoto) {
    if (!hasPhoto) { setViewPhoto("none"); return; }
    setViewPhoto("loading");
    const img = await loadTaskPhoto(taskId, due);
    setViewPhoto(img || "expired");
  }

  // ── Completion log (admin) — most recent first ──
  const log = useMemo(() => {
    return Object.entries(taskDone || {})
      .map(([k, v]) => {
        const i = k.lastIndexOf("_");
        const taskId = k.slice(0, i), due = k.slice(i + 1);
        const t = (tasks || []).find(x => String(x.id) === taskId);
        return { taskId, due, title: t?.title || "(deleted task)", ...v };
      })
      .sort((a, b) => (b.at || b.due) > (a.at || a.due) ? 1 : -1)
      .slice(0, 40);
  }, [taskDone, tasks]);

  const inp = (s={}) => ({ padding:"9px 12px", border:"1.5px solid #d5dce6", borderRadius:8, fontSize:13, fontFamily:"inherit", background:"#fff", width:"100%", boxSizing:"border-box", outline:"none", ...s });
  const lbl = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };

  return (
    <div style={{ padding: isMobile?"10px 8px":"22px 28px", maxWidth:1000, margin:"0 auto", width:"100%", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>

      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:26, fontWeight:700, fontFamily:"'Playfair Display',serif", color:C.navy }}>✅ Tasks & Schedule</div>
        <div style={{ fontSize:12, color:C.dim, marginTop:4 }}>Daily, weekly and monthly duties — confirm each when done{isAdmin ? " · admin can add and edit" : ""}</div>
      </div>

      {/* ── Pending (everyone) ── */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderTop:`3px solid ${pending.length?C.red:C.green}`, borderRadius:12, padding:"16px 18px", marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:12 }}>
          {pending.length ? `📋 To do now (${pending.length})` : "🎉 All tasks are done — nothing pending"}
        </div>
        {pending.map(({ task, due, overdue }) => (
          <div key={task.id+"_"+due} style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 12px", border:`1.5px solid ${overdue?"#fca5a5":"#e5e3de"}`, background:overdue?"#fff5f5":"#fafaf9", borderRadius:10, marginBottom:8, flexWrap:"wrap" }}>
            <div style={{ flex:1, minWidth:160 }}>
              <div style={{ fontWeight:800, fontSize:14 }}>{task.title}</div>
              {task.notes && <div style={{ fontSize:12, color:C.dim, marginTop:2 }}>{task.notes}</div>}
              <div style={{ fontSize:11, marginTop:4 }}>
                <span style={{ color:C.dim }}>{freqLabel(task)}</span>
                {" · "}
                <span style={{ fontWeight:800, color:overdue?C.red:C.green }}>
                  {overdue ? `OVERDUE — due ${fmtDate(due)}` : "Due today"}
                </span>
              </div>
            </div>
            <button onClick={()=>{ setDoneModal({ task, due }); setPhotoData(""); }}
              style={{ padding:"9px 16px", borderRadius:9, border:"none", background:C.green, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13 }}>
              ✓ Mark Done
            </button>
          </div>
        ))}
      </div>

      {/* ── Admin: add / edit ── */}
      {isAdmin && (
        <div style={{ background:"#dbe7f5", border:`2px solid ${C.navy}`, borderRadius:12, padding:"18px 20px", marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:800, color:C.navy, marginBottom:14 }}>{editing ? "✏️ Edit Task" : "➕ Add New Task"}</div>
          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"2fr 1fr", gap:12, marginBottom:12 }}>
            <div><label style={lbl}>Task name *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Clean rooftop water tank" style={inp()} /></div>
            <div><label style={lbl}>Frequency</label>
              <select value={form.freq} onChange={e=>setForm(f=>({...f,freq:e.target.value}))} style={inp()}>
                {FREQS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </div>
          </div>

          {form.freq === "weekly" && (
            <div style={{ marginBottom:12 }}>
              <label style={lbl}>On which days</label>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {DAY_LABELS.map((d,i)=>(
                  <button key={i} type="button" onClick={()=>toggleDay(i)}
                    style={{ padding:"7px 12px", borderRadius:8, border:`1.5px solid ${form.days.includes(i)?C.navy:"#d5dce6"}`, background:form.days.includes(i)?C.navy:"#fff", color:form.days.includes(i)?"#fff":C.dim, cursor:"pointer", fontWeight:700, fontSize:12 }}>{d}</button>
                ))}
              </div>
            </div>
          )}
          {form.freq === "monthly" && (
            <div style={{ marginBottom:12, maxWidth:200 }}>
              <label style={lbl}>Day of month (1–31)</label>
              <input type="number" min="1" max="31" value={form.date} onChange={e=>setForm(f=>({...f,date:Math.min(31,Math.max(1,parseInt(e.target.value)||1))}))} style={inp()} />
            </div>
          )}
          {form.freq === "once" && (
            <div style={{ marginBottom:12, maxWidth:220 }}>
              <label style={lbl}>Date</label>
              <input type="date" value={form.onceDate} onChange={e=>setForm(f=>({...f,onceDate:e.target.value}))} style={inp()} />
            </div>
          )}

          <div style={{ marginBottom:12 }}><label style={lbl}>Notes / instructions (optional)</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any details for the staff" style={inp()} /></div>

          <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
            {editing && <button onClick={()=>{ setForm(blankForm(today)); setEditing(false); }} style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Cancel</button>}
            <button onClick={saveTask} style={{ padding:"9px 22px", borderRadius:9, border:"none", background:C.navy, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800 }}>💾 {editing ? "Update Task" : "Add Task"}</button>
          </div>
        </div>
      )}

      {/* ── All tasks list (admin sees manage controls) ── */}
      {isAdmin && (
        <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"16px 18px", marginBottom:18 }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:12 }}>🗂️ All Tasks ({tasks.length})</div>
          {tasks.length === 0 && <div style={{ fontSize:13, color:C.dim }}>No tasks yet — add one above.</div>}
          {tasks.map(t=>(
            <div key={t.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderBottom:"1px solid #edf1f6", opacity:t.active===false?.5:1, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:150 }}>
                <div style={{ fontWeight:700, fontSize:13 }}>{t.title} {t.active===false && <span style={{ fontSize:10, color:C.dim }}>(paused)</span>}</div>
                <div style={{ fontSize:11, color:C.dim }}>{freqLabel(t)}</div>
              </div>
              <button onClick={()=>toggleActive(t)} title={t.active===false?"Resume":"Pause"} style={{ padding:"5px 10px", borderRadius:7, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontSize:12 }}>{t.active===false?"▶":"⏸"}</button>
              <button onClick={()=>editTask(t)} style={{ padding:"5px 10px", borderRadius:7, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontSize:12 }}>✏️</button>
              <button onClick={()=>deleteTask(t)} style={{ padding:"5px 10px", borderRadius:7, border:`1.5px solid ${C.red}40`, background:"#fff0f0", cursor:"pointer", fontSize:12 }}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Completion log (admin) ── */}
      {isAdmin && (
        <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, padding:"16px 18px" }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.navy, marginBottom:4 }}>📖 Completion Log</div>
          <div style={{ fontSize:11, color:C.dim, marginBottom:12 }}>Proof photos are kept for {PHOTO_TTL_DAYS} days, then auto-deleted.</div>
          {log.length === 0 && <div style={{ fontSize:13, color:C.dim }}>No completions yet.</div>}
          {log.map((e,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", borderBottom:"1px solid #edf1f6", fontSize:12, flexWrap:"wrap" }}>
              <span style={{ flex:1, minWidth:140, fontWeight:700 }}>{e.title}</span>
              <span style={{ color:C.dim }}>{fmtDate(e.due)}</span>
              <span style={{ color:C.dim }}>by {e.by}</span>
              {e.hasPhoto
                ? <button onClick={()=>showPhoto(e.taskId, e.due, true)} style={{ padding:"4px 9px", borderRadius:6, border:"1.5px solid #d5dce6", background:"#f2f6fb", cursor:"pointer", fontSize:11 }}>📷 View</button>
                : <span style={{ color:"#bbb", fontSize:11 }}>no photo</span>}
            </div>
          ))}
        </div>
      )}

      {/* ── Mark-done modal ── */}
      {doneModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }} onClick={e=>e.target===e.currentTarget&&setDoneModal(null)}>
          <div style={{ background:"#fff", borderRadius:16, padding:22, width:"100%", maxWidth:400 }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginBottom:6 }}>Confirm task done</div>
            <div style={{ fontSize:13, color:C.dim, marginBottom:14 }}>{doneModal.task.title}</div>
            <div style={{ marginBottom:14 }}>
              <label style={lbl}>Add proof photo (optional)</label>
              <input type="file" accept="image/*" onChange={pickPhoto} style={{ fontSize:12 }} />
              {photoData && <img src={photoData} alt="proof" style={{ maxWidth:"100%", maxHeight:160, borderRadius:8, marginTop:8, border:`1px solid ${C.border}` }} />}
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={()=>{ setDoneModal(null); setPhotoData(""); }} style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Cancel</button>
              <button onClick={confirmDone} style={{ padding:"9px 20px", borderRadius:9, border:"none", background:C.green, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800 }}>✓ Confirm Done</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Photo viewer ── */}
      {viewPhoto && (
        <div onClick={()=>setViewPhoto(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.9)", zIndex:100000, display:"flex", alignItems:"center", justifyContent:"center", padding:20, cursor:"zoom-out" }}>
          {viewPhoto === "loading" && <div style={{ color:"#fff", fontSize:14 }}>Loading photo…</div>}
          {viewPhoto === "expired" && <div style={{ color:"#fff", fontSize:14 }}>Photo expired (older than {PHOTO_TTL_DAYS} days).</div>}
          {viewPhoto === "none" && <div style={{ color:"#fff", fontSize:14 }}>No photo attached.</div>}
          {viewPhoto.startsWith?.("data:") && <img src={viewPhoto} alt="proof" style={{ maxWidth:"95%", maxHeight:"95%", objectFit:"contain", borderRadius:8 }} />}
        </div>
      )}
    </div>
  );
}
