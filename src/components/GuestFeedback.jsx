// Guest satisfaction surveys — moved here from the old Insights tab so that
// guest feedback lives with the guest records in CRM. The Desk star-rating
// overlay writes into the same store (surveyData), so nothing is lost.
import { useState, useMemo } from "react";
import { useApp } from "../context/AppContext";
import { todayStr } from "../utils/helpers";

const LABELS = {
  cleanliness: "Room cleanliness",
  staff: "Staff",
  value: "Value for money",
  facilities: "Facilities",
  overall: "Overall",
};
const BLANK = { guest:"", cleanliness:5, staff:5, value:5, facilities:5, overall:5, comment:"" };

export default function GuestFeedback() {
  const { surveyData, setSurveys, notify, curUser } = useApp();
  const [form, setForm] = useState(BLANK);
  const [showForm, setShowForm] = useState(false);
  const [showList, setShowList] = useState(false);

  const rows = surveyData || [];

  const avg = useMemo(() => {
    if (!rows.length) return null;
    const k = ["cleanliness","staff","value","facilities","overall"];
    const out = {};
    k.forEach(key => { out[key] = rows.reduce((s, r) => s + (+r[key] || 0), 0) / rows.length; });
    out.total = k.reduce((s, key) => s + out[key], 0) / k.length;
    return out;
  }, [rows]);

  function submit() {
    if (!form.guest.trim()) { notify("Enter guest name", "error"); return; }
    setSurveys([...rows, { ...form, date: todayStr(), by: curUser || "staff" }]);
    notify("Feedback saved", "success");
    setForm(BLANK);
    setShowForm(false);
  }

  function remove(i) {
    if (window.confirm("Delete this feedback entry?")) setSurveys(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:"13px 14px", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap" }}>
        <span style={{ fontSize:10, fontWeight:600, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" }}>
          Guest feedback
        </span>
        {avg && (
          <span style={{ fontSize:11, color:"var(--text3)" }}>
            ★ {avg.total.toFixed(1)}/5 · {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </span>
        )}
        <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
          {rows.length > 0 && (
            <button onClick={() => setShowList(v => !v)} style={btn()}>
              {showList ? "Hide entries" : "All entries"}
            </button>
          )}
          <button onClick={() => setShowForm(v => !v)} style={btn()}>
            <i className="ti ti-plus" style={{ fontSize:12 }} /> Add
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background:"var(--bg3)", borderRadius:9, padding:"11px 12px", marginBottom:11 }}>
          <div className="form-group" style={{ marginBottom:8 }}>
            <label style={{ fontSize:10 }}>Guest name / phone</label>
            <input value={form.guest} onChange={e => setForm(p => ({ ...p, guest:e.target.value }))}
              placeholder="Guest name" style={{ fontSize:13 }} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            {Object.entries(LABELS).map(([k, l]) => (
              <div key={k} className="form-group" style={{ marginBottom:0 }}>
                <label style={{ fontSize:10 }}>{l} (1-5)</label>
                <input type="number" min={1} max={5} value={form[k]}
                  onChange={e => setForm(p => ({ ...p, [k]: Math.min(5, Math.max(1, +e.target.value)) }))}
                  style={{ fontSize:13 }} />
              </div>
            ))}
          </div>
          <div className="form-group" style={{ marginBottom:8 }}>
            <label style={{ fontSize:10 }}>Comment (optional)</label>
            <textarea value={form.comment} onChange={e => setForm(p => ({ ...p, comment:e.target.value }))}
              rows={2} style={{ fontSize:12, width:"100%", boxSizing:"border-box" }} />
          </div>
          <div style={{ display:"flex", gap:7 }}>
            <button onClick={() => setShowForm(false)} style={btn()}>Cancel</button>
            <button onClick={submit} style={{ ...btn(), background:"var(--navy)", color:"#fff", borderColor:"var(--navy)" }}>
              <i className="ti ti-check" style={{ fontSize:12 }} /> Save
            </button>
          </div>
        </div>
      )}

      {showList && rows.length > 0 && (
        <div style={{ maxHeight:260, overflowY:"auto", marginBottom:11, paddingRight:2 }}>
          {[...rows].reverse().map((sv, i) => (
            <div key={i} style={{ padding:"8px 0", borderBottom:"1px solid var(--border)", fontSize:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4, gap:8 }}>
                <span style={{ fontWeight:600, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sv.guest}</span>
                <span style={{ display:"flex", gap:8, alignItems:"center", flex:"0 0 auto" }}>
                  <span style={{ fontSize:12, fontWeight:600, color:"#a6832c" }}>★ {sv.overall}</span>
                  <span style={{ fontSize:10, color:"var(--text3)" }}>{sv.date}</span>
                  <button onClick={() => remove(rows.length - 1 - i)} title="Delete entry"
                    style={{ ...btn(), padding:"2px 7px", color:"#8f2323", borderColor:"#e0b3b0", background:"#fdf4f3" }}>
                    <i className="ti ti-trash" style={{ fontSize:11 }} />
                  </button>
                </span>
              </div>
              <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                {Object.entries(LABELS).map(([k, l]) => (
                  <span key={k} style={{ fontSize:10, color:"var(--text3)" }}>
                    {l.split(" ")[0]}: <strong style={{ color:"var(--text)" }}>{sv[k]}</strong>
                  </span>
                ))}
              </div>
              {sv.comment && <div style={{ fontSize:11, color:"var(--text2)", marginTop:4, fontStyle:"italic" }}>“{sv.comment}”</div>}
            </div>
          ))}
        </div>
      )}

      {!avg ? (
        <div style={{ fontSize:12, color:"var(--text3)", padding:"6px 0" }}>
          No feedback yet. Guests can rate on the front desk tablet, or add an entry here.
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"6px 18px" }}>
          {Object.entries(LABELS).map(([k, l]) => (
            <div key={k}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                <span>{l}</span>
                <span style={{ fontWeight:600, fontVariantNumeric:"tabular-nums" }}>{avg[k].toFixed(1)}</span>
              </div>
              <div style={{ height:6, background:"var(--bg3)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:(avg[k] / 5 * 100) + "%", borderRadius:3,
                  background: avg[k] >= 4 ? "#2f7d4f" : avg[k] >= 3 ? "#8fb3aa" : "#c96a63" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn() {
  return {
    display:"inline-flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:7,
    border:"1px solid var(--border)", background:"var(--bg2)", color:"var(--text)",
    fontSize:11, fontWeight:600, fontFamily:"inherit", cursor:"pointer",
  };
}
