
import { useState, useCallback, useEffect } from "react";
import { useHall } from "../HallContext";
import useIsMobile from "../useIsMobile";
import { saveConfig, loadConfig } from "../../utils/supabaseSync";

const NAVY = "#1e3a5f";
const MAROON = "#7B1212";
const GOLD = "#c9a84c";

const DEFAULT_C1 = [
  { n:"প্লেট",          qty:"১২ পিস", rate:10,   total:120  },
  { n:"তরকারির বাটি",   qty:"৬ পিস",  rate:10,   total:60   },
  { n:"রাইস প্লেট",     qty:"২ পিস",  rate:20,   total:40   },
  { n:"লবণ বাটি",       qty:"২ পিস",  rate:10,   total:20   },
  { n:"সসের বাটি",      qty:"২ পিস",  rate:10,   total:20   },
  { n:"গ্লাস",           qty:"১২ পিস", rate:10,   total:120  },
  { n:"টেবিল কভার",     qty:"২ পিস",  rate:50,   total:100  },
  { n:"চেয়ার ও কভার",  qty:"১২ পিস", rate:15,   total:180  },
  { n:"পানির জগ",       qty:"২ পিস",  rate:10,   total:20   },
  { n:"টেবিল",           qty:"২ পিস",  rate:50,   total:100  },
  { n:"বন বাটি",         qty:"২ পিস",  rate:10,   total:20   },
  { n:"", qty:"", rate:0, total:0 },
  { n:"", qty:"", rate:0, total:0 },
  { n:"", qty:"", rate:0, total:0 },
];

const DEFAULT_C2 = [
  { n:"কুকিং ডেক",    qty:"১৫ পিস", rate:100,  total:1500 },
  { n:"পানির ড্রাম",  qty:"২ পিস",  rate:50,   total:100  },
  { n:"পানির টব",     qty:"২ পিস",  rate:50,   total:100  },
  { n:"বড় গামলা",    qty:"২ পিস",  rate:50,   total:100  },
  { n:"বালতি",        qty:"২ পিস",  rate:50,   total:100  },
  { n:"কড়াই",        qty:"২ পিস",  rate:50,   total:100  },
  { n:"জেনারেটর",    qty:"২ দিন",  rate:1500, total:3000 },
  { n:"স্টেজ টেবিল", qty:"৮ পিস",  rate:50,   total:400  },
  { n:"স্টেজ চেয়ার", qty:"৫০ পিস", rate:15,   total:750  },
  { n:"বেসিক লাইটিং", qty:"",       rate:0,    total:0    },
  { n:"", qty:"", rate:0, total:0 },
  { n:"", qty:"", rate:0, total:0 },
  { n:"", qty:"", rate:0, total:0 },
];

function loadCut() {
  try { const s = localStorage.getItem("ameliaCutData"); if (s) return JSON.parse(s); } catch {}
  return null;
}
function saveCut(d) {
  try { localStorage.setItem("ameliaCutData", JSON.stringify(d)); } catch {}
  saveConfig("hall_cutlery", d).catch(() => {});
}

function bnToNum(s) {
  if (!s) return 0;
  const map = {"০":0,"১":1,"২":2,"৩":3,"৪":4,"৫":5,"৬":6,"৭":7,"৮":8,"৯":9};
  let out = "";
  for (const ch of String(s)) { out += map[ch] !== undefined ? map[ch] : (ch >= "0" && ch <= "9") ? ch : ""; }
  return parseInt(out) || 0;
}

function calcRow(row) {
  if (!row.rate) return { ...row, total: row.total || 0 };
  const q = bnToNum(row.qty);
  const total = q > 0 ? q * row.rate : 0;
  return { ...row, total };
}

function initData() {
  const saved = loadCut();
  if (saved?.c1 && saved?.c2) {
    return { c1: saved.c1, c2: saved.c2, locked: saved.locked || false };
  }
  const c1 = DEFAULT_C1.map(r => ({ ...r }));
  const c2 = DEFAULT_C2.map(r => ({ ...r }));
  saveCut({ c1, c2, locked: false });
  return { c1, c2, locked: false };
}

export default function HallCutlery() {
  const isMobile = useIsMobile();
  const { curRole, notify } = useHall();
  const isAdmin = curRole === "admin";

  const [data, setData] = useState(initData);
  const [tables, setTables] = useState(1);

  useEffect(() => {
    loadConfig("hall_cutlery").then(v => {
      if (v?.c1 && v?.c2) {
        setData({ c1: v.c1, c2: v.c2, locked: v.locked || false });
        try { localStorage.setItem("ameliaCutData", JSON.stringify(v)); } catch {}
      }
    }).catch(() => {});
  }, []);

  const { c1, c2, locked } = data;

  const tot1 = c1.reduce((s, r) => s + (r.total || 0), 0);
  const tot2 = c2.reduce((s, r) => s + (r.total || 0), 0);
  const multResult = tot1 * (parseInt(tables) || 1);
  const grandTotal = multResult + tot2;

  function updateRow(chart, idx, field, val) {
    setData(prev => {
      const arr = prev[chart].map((r, i) => {
        if (i !== idx) return r;
        const upd = { ...r, [field]: field === "rate" ? parseFloat(val) || 0 : val };
        return calcRow(upd);
      });
      return { ...prev, [chart]: arr };
    });
  }

  function lockSave() {
    saveCut({ c1, c2, locked: true });
    setData(prev => ({ ...prev, locked: true }));
    notify("চার্ট লক হয়েছে! ✅", "success");
  }

  function unlock() {
    saveCut({ c1, c2, locked: false });
    setData(prev => ({ ...prev, locked: false }));
    notify("সম্পাদনাযোগ্য করা হয়েছে 🔓", "info");
  }

  function resetDefaults() {
    if (!isAdmin) { notify("Admin only 🔒", "error"); return; }
    if (!window.confirm("সকল তথ্য ডিফল্টে ফিরিয়ে দেওয়া হবে?")) return;
    const c1 = DEFAULT_C1.map(r => ({ ...r }));
    const c2 = DEFAULT_C2.map(r => ({ ...r }));
    saveCut({ c1, c2, locked: false });
    setData({ c1, c2, locked: false });
    notify("ডিফল্টে ফিরিয়ে দেওয়া হয়েছে ↺", "success");
  }

  function printCutlery() {
    const numTables = parseInt(tables) || 1;
    const c1Total = tot1;
    const c2Total = tot2;
    const chart1xTables = multResult;
    const grand = grandTotal;

    function rows(arr, startIdx) {
      return arr.filter(r => r.n).map((r, i) => `
        <tr>
          <td style="text-align:center;color:#555;">${startIdx + i}</td>
          <td>${r.n}</td>
          <td style="text-align:center;">${r.qty || "—"}</td>
          <td style="text-align:right;">${r.rate ? r.rate.toLocaleString() : "০"}</td>
          <td style="text-align:right;font-weight:700;color:#7B1212;">${r.total ? r.total.toLocaleString() + " ৳" : "—"}</td>
        </tr>`).join("");
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>কাটলারি চার্ট</title>
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      body { font-family:"Noto Sans Bengali","Segoe UI",sans-serif; background:#fff; color:#111; padding:24px; font-size:13px; }
      h1 { font-size:20px; color:#1e3a5f; margin-bottom:4px; }
      .sub { color:#666; font-size:12px; margin-bottom:16px; }
      .grand-box { background:#7B1212; color:#fff; padding:10px 18px; border-radius:8px; font-size:18px; font-weight:800; display:inline-block; margin-bottom:18px; }
      .mult-box { background:#f5f0ff; border:1.5px solid #1e3a5f; border-radius:8px; padding:8px 16px; font-size:13px; margin-bottom:16px; color:#1e3a5f; font-weight:600; }
      table { width:100%; border-collapse:collapse; margin-bottom:20px; }
      thead tr { background:#1e3a5f; color:#fff; }
      thead th { padding:8px 10px; font-size:12px; font-weight:700; text-align:left; }
      tbody tr:nth-child(even) { background:#f9f9f9; }
      tbody td { padding:7px 10px; border-bottom:1px solid #eee; }
      .section-title { font-size:14px; font-weight:800; color:#fff; background:#1e3a5f; padding:8px 12px; border-radius:6px 6px 0 0; margin-top:16px; }
      .total-row { background:#f0f4ff!important; }
      .total-row td { font-weight:800; color:#1e3a5f; font-size:13px; }
      @media print { body { padding:10px; } }
    </style></head><body>
    <h1>🍽 কাটলারি চার্ট</h1>
    <div class="sub">Grand Total Breakdown</div>

    <div class="mult-box">
      টেবিল সংখ্যা: <strong>${numTables}</strong> &nbsp;×&nbsp; Chart 1 = <strong>${chart1xTables.toLocaleString()} ৳</strong>
      &nbsp;+&nbsp; Chart 2 = <strong>${c2Total.toLocaleString()} ৳</strong>
    </div>
    <div class="grand-box">গ্র্যান্ড টোটাল: ৳ ${grand.toLocaleString()}</div>

    <div class="section-title">চার্ট ১ — প্রতি টেবিল (১২ জন)</div>
    <table>
      <thead><tr><th>#</th><th>আইটেম</th><th>পরিমাণ</th><th style="text-align:right">ইউনিট মূল্য (৳)</th><th style="text-align:right">মোট (৳)</th></tr></thead>
      <tbody>
        ${rows(c1, 1)}
        <tr class="total-row"><td colspan="4" style="text-align:right;">Chart 1 Total</td><td style="text-align:right;">${c1Total.toLocaleString()} ৳</td></tr>
      </tbody>
    </table>

    <div class="section-title">চার্ট ২ — রান্না, স্টেজ ও অন্যান্য সরবরাহ</div>
    <table>
      <thead><tr><th>#</th><th>আইটেম</th><th>পরিমাণ</th><th style="text-align:right">ইউনিট মূল্য (৳)</th><th style="text-align:right">মোট (৳)</th></tr></thead>
      <tbody>
        ${rows(c2, 11)}
        <tr class="total-row"><td colspan="4" style="text-align:right;">Chart 2 Total</td><td style="text-align:right;">${c2Total.toLocaleString()} ৳</td></tr>
      </tbody>
    </table>

    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}</script>
    </body></html>`;

    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { notify("পপআপ ব্লক করা হয়েছে — ব্রাউজারে পপআপ অনুমতি দিন।", "error"); return; }
    w.document.write(html);
    w.document.close();
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const thStyle = { padding:"8px 6px", fontSize:10, color:"#fff", fontWeight:800, textAlign:"center", borderBottom:`1.5px solid rgba(255,255,255,.2)`, background:NAVY, whiteSpace:"nowrap" };
  const thLeft  = { ...thStyle, textAlign:"left", paddingLeft:10 };
  const tdNum   = { padding:"7px 6px", textAlign:"center", fontSize:12, fontWeight:700, color:NAVY };

  function adminInp(val, onChange) {
    if (!isAdmin) return <span style={{ fontSize:12, fontWeight:600, color:"#111" }}>{val || "—"}</span>;
    return (
      <input value={val} onChange={e => onChange(e.target.value)}
        style={{ width:"100%", padding:"4px 6px", fontSize:12, border:"1.5px solid #ffc107", borderRadius:5, background:"#fffdf5", textAlign:"center", color:"#111", fontWeight:500, fontFamily:"inherit", boxSizing:"border-box" }} />
    );
  }
  function adminNumInp(val, onChange) {
    if (!isAdmin) return <span style={{ fontSize:12, fontWeight:700, color:NAVY }}>{val || "০"}</span>;
    return (
      <input type="number" value={val} onChange={e => onChange(e.target.value)} min={0}
        style={{ width:"100%", padding:"4px 6px", fontSize:12, border:"1.5px solid #ffc107", borderRadius:5, background:"#fffdf5", textAlign:"center", color:"#111", fontWeight:600, fontFamily:"inherit", boxSizing:"border-box" }} />
    );
  }
  function openInp(val, onChange) {
    return (
      <input value={val} onChange={e => onChange(e.target.value)}
        style={{ width:"100%", padding:"4px 6px", fontSize:12, border:"1.5px solid #90caf9", borderRadius:5, background:"#f0f8ff", textAlign:"center", color:"#111", fontWeight:500, fontFamily:"inherit", boxSizing:"border-box" }} />
    );
  }
  function openNumInp(val, onChange) {
    return (
      <input type="number" value={val} onChange={e => onChange(e.target.value)} min={0}
        style={{ width:"100%", padding:"4px 6px", fontSize:12, border:"1.5px solid #90caf9", borderRadius:5, background:"#f0f8ff", textAlign:"center", color:"#111", fontWeight:600, fontFamily:"inherit", boxSizing:"border-box" }} />
    );
  }
  function qtyInp(val, onChange) {
    return (
      <input value={val} onChange={e => onChange(e.target.value)}
        style={{ width:"100%", padding:"4px 6px", fontSize:12, border:"1.5px solid #90caf9", borderRadius:5, background:"#f0f8ff", textAlign:"center", color:"#111", fontWeight:500, fontFamily:"inherit", boxSizing:"border-box" }} />
    );
  }

  // C1: rows 11-13 (index 11,12,13) open for all; rest admin-only
  const c1OpenRows = [11,12,13];
  // C2: rows 10-12 (index 10,11,12) open for all; rest admin-only
  const c2OpenRows = [10,11,12];

  function ChartTable({ rows, chart, openRows, startNum, footLabel, footTotal, footColor }) {
    return (
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width:32 }}>#</th>
            <th style={{ ...thLeft }}>Item {isAdmin ? "🔒" : ""}</th>
            <th style={{ ...thStyle, width:80 }}>Qty</th>
            <th style={{ ...thStyle, width:110 }}>Unit Price (৳) {isAdmin ? "🔒" : ""}</th>
            <th style={{ ...thStyle, width:100 }}>Total (৳)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isOpen = openRows.includes(i);
            return (
              <tr key={i} style={{ borderBottom:"1px solid #eee", background: i%2===0?"#fafaf8":"#fff" }}>
                <td style={tdNum}>{i + startNum}</td>
                <td style={{ padding:"7px 6px" }}>
                  {isOpen
                    ? openInp(row.n, v => updateRow(chart, i, "n", v))
                    : adminInp(row.n, v => updateRow(chart, i, "n", v))}
                </td>
                <td style={{ padding:"7px 4px", textAlign:"center" }}>
                  {qtyInp(row.qty, v => updateRow(chart, i, "qty", v))}
                </td>
                <td style={{ padding:"7px 4px", textAlign:"center" }}>
                  {isOpen
                    ? openNumInp(row.rate, v => updateRow(chart, i, "rate", v))
                    : adminNumInp(row.rate, v => updateRow(chart, i, "rate", v))}
                </td>
                <td style={{ padding:"7px 6px", textAlign:"center", fontSize:12, fontWeight:700, color:footColor }}>
                  {row.total ? row.total + " টাকা" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background:"#e8f0f8" }}>
            <td colSpan={4} style={{ padding:"10px 12px", fontSize:12, fontWeight:800, color:NAVY, textAlign:"center" }}>{footLabel}</td>
            <td style={{ padding:"10px 8px", fontSize:13, fontWeight:800, color:NAVY, textAlign:"center" }}>{footTotal.toLocaleString()} টাকা</td>
          </tr>
        </tfoot>
      </table>
    );
  }

  return (
    <div className="hall-page" style={{ padding: isMobile?"10px 8px":"22px 28px", maxWidth:1200, margin:"0 auto", width:"100%" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:26, fontWeight:700, fontFamily:"'Playfair Display',serif", color:MAROON }}>🍽 কাটলারি চার্ট</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {locked
            ? <button onClick={unlock} style={btnS("#fff","#e5e3de","#333")}>🔓 Unlock All</button>
            : <button onClick={lockSave} style={btnS(MAROON,"transparent","#fff",true)}>🔒 Lock &amp; Save</button>
          }
          {isAdmin && <button onClick={resetDefaults} style={btnS("#fff","#e5e3de","#333")}>↺ Reset Defaults</button>}
          <button onClick={printCutlery} style={btnS("#fff","#1e3a5f",NAVY)}>🖨 Print</button>
        </div>
      </div>

      {/* ── Multiplier bar ── */}
      <div style={{ background:"linear-gradient(135deg,#f0f4fa,#e8f0f8)", border:`2px solid ${NAVY}`, borderRadius:12, padding:"14px 20px", marginBottom:14, display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <span style={{ fontSize:17 }}>🪑</span>
          <span style={{ fontSize:12, fontWeight:800, color:NAVY, textTransform:"uppercase", letterSpacing:.5 }}>Multiply by No. of Tables</span>
        </div>
        <div style={{ width:1, background:"#c0d0e0", height:36, flexShrink:0 }} />
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <input type="number" value={tables} onChange={e=>setTables(e.target.value)} min={1}
            style={{ width:72, padding:"7px 10px", fontSize:18, fontWeight:800, border:`2px solid ${NAVY}`, borderRadius:8, textAlign:"center", color:NAVY, background:"#fff", fontFamily:"inherit" }} />
          <span style={{ fontSize:12, color:"#555", fontWeight:600 }}>tables × Chart 1 =</span>
          <div style={{ background:"#fff", border:`2px solid ${NAVY}`, borderRadius:8, padding:"5px 16px", textAlign:"center", minWidth:100 }}>
            <div style={{ fontSize:9, letterSpacing:1.2, textTransform:"uppercase", color:NAVY, fontWeight:700 }}>Chart 1 × Tables</div>
            <div style={{ fontSize:19, fontFamily:"'Playfair Display',serif", color:NAVY, fontWeight:800 }}>৳ {multResult.toLocaleString()}</div>
          </div>
          <span style={{ fontSize:14, color:"#888", fontWeight:500 }}>+ Chart 2 =</span>
          <div style={{ background:"#fff5f0", border:`2px solid ${MAROON}`, borderRadius:8, padding:"5px 20px", textAlign:"center", minWidth:120 }}>
            <div style={{ fontSize:9, letterSpacing:1.2, textTransform:"uppercase", color:MAROON, fontWeight:700 }}>Grand Total</div>
            <div style={{ fontSize:21, fontFamily:"'Playfair Display',serif", color:MAROON, fontWeight:800 }}>৳ {grandTotal.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* ── Legend ── */}
      {isAdmin ? (
        <div style={{ display:"flex", gap:16, fontSize:10, fontWeight:600, marginBottom:10, flexWrap:"wrap" }}>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:"#fffdf5", border:"1.5px solid #ffc107", display:"inline-block" }} /> শুধু Admin সম্পাদনা করতে পারবেন
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:12, height:12, borderRadius:3, background:"#f0f8ff", border:"1.5px solid #90caf9", display:"inline-block" }} /> সবাই সম্পাদনা করতে পারবেন
          </span>
        </div>
      ) : (
        <div style={{ fontSize:10, color:"#666", fontWeight:600, marginBottom:10 }}>
          🔒 আইটেম ও মূল্য শুধু Admin পরিবর্তন করতে পারবেন। নীল ঘরগুলো আপনি পরিবর্তন করতে পারবেন।
        </div>
      )}

      {/* ── Two charts side by side ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        {/* Chart 1 */}
        <div style={{ background:"#fff", border:"2px solid #e0d0b0", borderRadius:12, overflow:"hidden" }}>
          <div style={{ background:NAVY, padding:"11px 16px", textAlign:"center" }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", fontFamily:"'Playfair Display',serif" }}>Per Table — 12 Persons</div>
          </div>
          <ChartTable
            rows={c1} chart="c1" openRows={c1OpenRows} startNum={1}
            footLabel="Chart 1 Total" footTotal={tot1} footColor={MAROON}
          />
        </div>

        {/* Chart 2 */}
        <div style={{ background:"#fff", border:"2px solid #e0d0b0", borderRadius:12, overflow:"hidden" }}>
          <div style={{ background:NAVY, padding:"11px 16px", textAlign:"center" }}>
            <div style={{ fontSize:15, fontWeight:800, color:"#fff", fontFamily:"'Playfair Display',serif" }}>Cooking, Stage &amp; Other Supplies (Items 11–23)</div>
          </div>
          <ChartTable
            rows={c2} chart="c2" openRows={c2OpenRows} startNum={11}
            footLabel="Chart 2 Total" footTotal={tot2} footColor="#9a7000"
          />
        </div>
      </div>

    </div>
  );
}

function btnS(bg, border, color, bold=false) {
  return { padding:"8px 16px", borderRadius:9, border:`1.5px solid ${border}`, background:bg, color, cursor:"pointer", fontFamily:"inherit", fontWeight:bold?800:700, fontSize:12 };
}
