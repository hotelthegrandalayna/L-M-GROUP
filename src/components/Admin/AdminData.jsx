import { useApp } from "../../context/AppContext";

export default function AdminData() {
  const { bookings, updateBookings, revenues, updateRevenues, expenses, updateExpenses, rooms, setRooms, notify } = useApp();

  function exportAll() {
    const data = { bookings, revenues, expenses, rooms, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "grand_alayna_backup_"+new Date().toISOString().slice(0,10)+".json";
    a.click();
    notify("Data exported successfully","success");
  }

  function importAll(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!window.confirm("This will REPLACE all current data with the imported file. Continue?")) return;
        if (data.bookings) updateBookings(data.bookings);
        if (data.revenues) updateRevenues(data.revenues);
        if (data.expenses) updateExpenses(data.expenses);
        if (data.rooms)    setRooms(data.rooms);
        notify("Data imported successfully","success");
      } catch { notify("Invalid backup file","error"); }
    };
    reader.readAsText(file);
    e.target.value="";
  }

  const totalSize = JSON.stringify({bookings,revenues,expenses,rooms}).length;

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 }}>
        {[["Bookings",bookings.length,"ti-calendar"],["Revenues",revenues.length,"ti-currency-taka"],["Expenses",expenses.length,"ti-receipt"],["Rooms",rooms.length,"ti-building"]].map(([l,v,ic])=>(
          <div key={l} className="panel" style={{ padding:"12px 14px",textAlign:"center" }}>
            <i className={"ti "+ic} style={{ fontSize:22,color:"var(--navy)",display:"block",marginBottom:4 }} />
            <div style={{ fontSize:20,fontWeight:800,color:"var(--navy)" }}>{v}</div>
            <div style={{ fontSize:11,color:"var(--text3)" }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize:12,color:"var(--text3)",marginBottom:18 }}>Storage used: ~{(totalSize/1024).toFixed(1)} KB</div>

      <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
        <div className="panel" style={{ flex:"1 1 220px", padding:18 }}>
          <div style={{ fontSize:14,fontWeight:800,marginBottom:6 }}><i className="ti ti-download" /> Export Backup</div>
          <div style={{ fontSize:12,color:"var(--text3)",marginBottom:12 }}>Download all data as a JSON backup file. Keep this safe — it contains all your hotel records.</div>
          <button className="btn primary sm" onClick={exportAll}><i className="ti ti-download" /> Export All Data</button>
        </div>
        <div className="panel" style={{ flex:"1 1 220px", padding:18 }}>
          <div style={{ fontSize:14,fontWeight:800,marginBottom:6 }}><i className="ti ti-upload" /> Import Backup</div>
          <div style={{ fontSize:12,color:"var(--text3)",marginBottom:12 }}>Restore from a previously exported JSON backup. This will replace all current data.</div>
          <label className="btn sm" style={{ cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6 }}>
            <i className="ti ti-upload" /> Import Backup
            <input type="file" accept=".json" style={{ display:"none" }} onChange={importAll} />
          </label>
        </div>
      </div>
    </div>
  );
}
