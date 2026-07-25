import { useState, useEffect, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { todayStr } from "../utils/helpers";
import { pendingTasks, freqLabel } from "../utils/tasks";
import { sendNtfyAlert } from "../utils/ntfy";

const C = { navy:"#1e3a5f", dim:"#666", green:"#1a7040", red:"#c0392b" };

// Pops up when the app opens if any task is due/overdue, so it can't be missed.
// Also fires one daily push notification when tasks are pending.
export default function TaskReminderPopup() {
  const { tasks, taskDone, setTaskDone, curUser, setActiveTab } = useApp();
  const today = todayStr();
  const [dismissed, setDismissed] = useState(false);

  const pending = useMemo(() => pendingTasks(tasks, taskDone, today), [tasks, taskDone, today]);

  // One push per day when there are pending tasks
  useEffect(() => {
    if (!pending.length) return;
    const key = "ga_task_notified_" + today;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const overdue = pending.filter(p => p.overdue).length;
    sendNtfyAlert(
      `TASKS DUE — ${pending.length} pending`,
      pending.slice(0, 6).map(p => (p.overdue ? "⚠ " : "• ") + p.task.title).join("\n")
        + (pending.length > 6 ? `\n…and ${pending.length - 6} more` : "")
        + (overdue ? `\n\n${overdue} OVERDUE` : ""),
      undefined,
      { tags: overdue ? "red_circle" : "clipboard", priority: overdue ? "high" : "default" }
    ).catch(() => {});
  }, [pending, today]);

  if (dismissed || !pending.length) return null;

  function quickDone(task, due) {
    setTaskDone(prev => ({ ...prev, [`${task.id}_${due}`]: { by: curUser || "staff", at: new Date().toISOString(), hasPhoto: false } }));
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:99998, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth:440, maxHeight:"88vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 20px 60px rgba(0,0,0,.35)" }}>
        <div style={{ background:C.navy, color:"#fff", padding:"14px 18px" }}>
          <div style={{ fontSize:16, fontWeight:800 }}>📋 Tasks to do</div>
          <div style={{ fontSize:12, opacity:.8, marginTop:2 }}>{pending.length} task{pending.length>1?"s":""} pending — please confirm when done</div>
        </div>

        <div style={{ padding:"12px 16px", overflowY:"auto", flex:1 }}>
          {pending.map(({ task, due, overdue }) => (
            <div key={task.id+"_"+due} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", border:`1.5px solid ${overdue?"#fca5a5":"#e5e3de"}`, background:overdue?"#fff5f5":"#fafaf9", borderRadius:10, marginBottom:8 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:800, fontSize:14 }}>{task.title}</div>
                <div style={{ fontSize:11, marginTop:3 }}>
                  <span style={{ color:C.dim }}>{freqLabel(task)}</span>{" · "}
                  <span style={{ fontWeight:800, color:overdue?C.red:C.green }}>{overdue ? "OVERDUE" : "Due today"}</span>
                </div>
              </div>
              <button onClick={()=>quickDone(task, due)} style={{ padding:"8px 13px", borderRadius:8, border:"none", background:C.green, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:12 }}>✓ Done</button>
            </div>
          ))}
        </div>

        <div style={{ padding:"12px 16px", borderTop:"1px solid #edf1f6", display:"flex", justifyContent:"space-between", gap:8 }}>
          <button onClick={()=>{ setActiveTab("tasks"); setDismissed(true); }} style={{ padding:"9px 14px", borderRadius:9, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13 }}>Open Tasks tab (add photo)</button>
          <button onClick={()=>setDismissed(true)} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:C.navy, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800, fontSize:13 }}>Later</button>
        </div>
      </div>
    </div>
  );
}
