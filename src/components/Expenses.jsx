import { useState, useMemo, useRef, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money } from "../utils/helpers";
import { loadHotelBookingsForMonth, loadHotelBookingsForRange, hasHotelSupabaseConfig } from "../lib/hotelSupabase";
import { monthMoney, bookingMonthlyParts, forfeitedAllocation } from "../lib/hotelMoney";
import { deleteRow, hasSupabase } from "../utils/supabaseSync";
import { gaRecordDeleted } from "../context/AppContext";
import { hotelExpenseType } from "../utils/expenseType";
import CostAnalysis from "./CostAnalysis";

// Hotel theme: navy primary (vs hall maroon) so the two sides are easy to tell apart
const C = { navy:"#1e3a5f", gold:"#c9a84c", dim:"#666", border:"#cdd7e4", green:"#1a7040", red:"#c0392b", orange:"#e67e22" };

const PAY_METHODS = [
  { v:"Cash",          i:"💵" },
  { v:"bKash",         i:"📱" },
  { v:"Nagad",         i:"📲" },
  { v:"Card",          i:"💳" },
  { v:"Bank Transfer", i:"🏦" },
];

const BUSINESS_CAT_OPTIONS = [
  { v:"Salaries",        l:"👤 Salaries" },
  { v:"Electricity",     l:"⚡ Electricity" },
  { v:"Generator Oil",   l:"🛢️ Generator Oil" },
  { v:"Food & Beverage", l:"🍳 Food & Beverage" },
  { v:"Laundry",         l:"🧺 Laundry" },
  { v:"Maintenance",     l:"🔧 Maintenance" },
  { v:"Utilities",       l:"🏢 Utilities" },
  { v:"Supplies",        l:"📦 Supplies" },
  { v:"Guest Amenities", l:"🧴 Guest Amenities (soap, shampoo)" },
  { v:"Marketing",       l:"📣 Marketing" },
  { v:"Transport",       l:"🚗 Transport" },
  { v:"Miscellaneous",   l:"📌 Miscellaneous" },
];

const NONBUSINESS_CAT_OPTIONS = [
  { v:"Bank Transfer",    l:"🏦 Bank Transfer" },
  { v:"Owner Withdrawal", l:"💸 Owner Withdrawal" },
  { v:"Donation",         l:"🤲 Donation" },
  { v:"Lending",          l:"🤝 Lending / Loan Given" },
  { v:"Personal Use",     l:"👤 Owner Personal Use" },
  { v:"Other Transfer",   l:"📌 Other" },
];

const CAT_EMOJI = {
  "Salaries":"👤","Electricity":"⚡","Food & Beverage":"🍳","Laundry":"🧺","Maintenance":"🔧",
  "Utilities":"🏢","Supplies":"📦","Generator Oil":"🛢️","Guest Amenities":"🧴","Marketing":"📣","Transport":"🚗","Miscellaneous":"📌",
  "Bank Transfer":"🏦","Owner Withdrawal":"💸","Donation":"🤲","Lending":"🤝","Personal Use":"👤","Other Transfer":"📌",
};

const MONTHS_LABEL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmtDate(iso) {
  if (!iso) return "—";
  const [y,m,d] = iso.split("-");
  return `${parseInt(d)} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${y}`;
}

function getHotelDue(b) {
  if (!b) return 0;
  const total = b.invoiceTotal ?? b.amount ?? 0;
  const paid  = (parseFloat(b.advance)||0) + (parseFloat(b.restPayment)||0) + (parseFloat(b.extrasAdvance)||0);
  return Math.max(0, total - paid);
}

const blankForm = (today) => ({
  type:"business", cat:"", date:today, amount:"", desc:"",
  payMethod:"Cash", empName:"", empRole:"", payPeriod:"",
  billNo:"", billPeriod:"", fileData:"", fileName:"",
});

export default function Expenses() {
  const { expenses, updateExpenses, expTypes, setExpenseType, removeExpenseType, bookings, revenues, curRole, curUser, notify } = useApp();
  const today = todayStr();
  const thisMonth = today.slice(0,7);
  const isAdmin = curRole === "admin";

  const [form, setForm]       = useState(() => blankForm(today));
  const [editId, setEditId]   = useState(null);
  const [errors, setErrors]   = useState({});
  const [search, setSearch]   = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterType, setFilterType] = useState(""); // "" | "business" | "nonbusiness"
  // Choosing a month is an admin tool. A manager always sees THIS month — the
  // value is forced here rather than merely hiding the dropdown, so every figure
  // below (revenue, cash in hand, the records list, the CSV export) is locked to
  // the current month and a past month cannot be reached at all.
  const [filterMonthSel, setFilterMonth] = useState(() => thisMonth);
  const filterMonth = isAdmin ? filterMonthSel : thisMonth;
  const [delTarget, setDelTarget] = useState(null);
  const [showRecords, setShowRecords] = useState(false);
  const [showForm,    setShowForm]    = useState(false); // add-record form starts collapsed
  const fileRef = useRef();

  // ── Past-month revenue accuracy (isolated) ───────────────────────────────
  // The live sync only keeps the last ~30 days of bookings, so a past month's
  // room-payment revenue is undercounted. When a past month is selected we fetch
  // THAT month's bookings into local state used ONLY for the revenue figures on
  // this page. It is never merged into the app's live bookings, so the room map,
  // checkouts, and notifications are completely unaffected.
  const [monthBookings, setMonthBookings] = useState({}); // { 'YYYY-MM': [bookings] }
  const [loadingRevMonth, setLoadingRevMonth] = useState(null);
  useEffect(() => {
    const m = filterMonth;
    if (!hasHotelSupabaseConfig()) return;
    // "All Months" needs EVERY booking, not just the live 30-day window —
    // otherwise the all-time totals come out far too low.
    const key = m || "ALL";
    if (m && m >= thisMonth) return;        // current/future already fully loaded
    if (monthBookings[key]) return;         // already fetched
    let alive = true;
    setLoadingRevMonth(key);
    const load = m
      ? loadHotelBookingsForMonth(m)
      : loadHotelBookingsForRange("2000-01-01", "2999-12-31");
    load
      .then(rows => { if (alive) setMonthBookings(p => ({ ...p, [key]: rows || [] })); })
      .catch(() => {})
      .finally(() => { if (alive) setLoadingRevMonth(null); });
    return () => { alive = false; };
  }, [filterMonth, thisMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bookings used ONLY for revenue math on this page: live bookings + the
  // on-demand month (or the full history for "All Months"), de-duplicated,
  // excluding deleted ones.
  const revBookings = useMemo(() => {
    const extra = monthBookings[filterMonth || "ALL"] || [];
    if (!extra.length) return bookings;
    const deleted = (() => { try { return new Set(JSON.parse(localStorage.getItem('ga_deleted_booking_ids') || '[]')); } catch { return new Set(); } })();
    const alive = b => !deleted.has(String(b.id)) && !deleted.has(String(b.supabaseBookingId ?? ''));
    // The cloud wins, exactly as in Accounts — the device only adds bookings the
    // cloud has never seen. Otherwise each computer reports its own leftovers.
    const cloud = extra.filter(alive);
    const have = new Set(cloud.map(b => String(b.supabaseBookingId ?? b.id)));
    const localOnly = bookings.filter(b => alive(b) && !have.has(String(b.supabaseBookingId ?? b.id)));
    return localOnly.length ? [...cloud, ...localOnly] : cloud;
  }, [bookings, monthBookings, filterMonth]);

  const setF = (k,v) => setForm(p => ({ ...p, [k]:v }));
  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

  // ── Normalize expenses with the Supabase-synced type map ─────────────────────
  const normalizedExpenses = useMemo(() => expenses.map(e => ({
    ...e, expType: hotelExpenseType(e, expTypes),
  })), [expenses, expTypes]);

  // ── Revenue entries — same derivation as Desk (paymentHistory + manual) ──────
  const allRevEntries = useMemo(() => {
    const entries = [];
    revBookings.forEach(b => {
      // A cancelled booking brings in only what it kept — see hotelMoney.js.
      if (b.status === "cancelled") {
        forfeitedAllocation(b).forEach(a => entries.push({ date: a.day || b.checkin, amount: a.amount }));
        return;
      }
      const history = b.paymentHistory || [];
      if (history.length > 0) {
        history.forEach(p => {
          const date = p.ts ? p.ts.split("T")[0] : b.checkin;
          entries.push({ date, amount: parseFloat(p.amount) || 0 });
        });
      } else {
        const totalPaid = (parseFloat(b.advance)||0) + (parseFloat(b.restPayment)||0) + (parseFloat(b.extrasAdvance)||0);
        if (totalPaid > 0) entries.push({ date: b.checkin, amount: totalPaid });
      }
    });
    revenues.filter(r => !r.bookingId && !r.fromBooking).forEach(r => entries.push({ date: r.date, amount: r.amount || 0 }));
    return entries;
  }, [revBookings, revenues]);

  // ── Row 1: billing — single source of truth (check-in / stay month basis) ────
  // Uses the shared hotelMoney helper so this matches Admin Invoices, Admin
  // Finance and the Desk to the taka. revBookings is the COMPLETE month.
  const { monthBilled, monthRevenue, monthOutstanding } = useMemo(() => {
    // "All Months" (empty filterMonth) = the SUM OF EVERY MONTH, computed with the
    // exact same monthMoney engine as a single month. Summing the months (rather
    // than totalling the raw bookings) guarantees All Months can never disagree
    // with the individual months you see when you pick them one by one.
    if (!filterMonth) {
      const months = new Set();
      revBookings.forEach(b => {
        if (!b) return;
        bookingMonthlyParts(b).forEach(p => p.month && months.add(p.month));
      });
      (revenues || []).forEach(r => {
        if (r && !r.bookingId && !r.fromBooking && r.date) months.add(String(r.date).slice(0, 7));
      });
      let billed = 0, collected = 0, outstanding = 0;
      months.forEach(m => {
        const mm = monthMoney({ bookings: revBookings, revenues, month: m });
        billed += mm.billed; collected += mm.collected; outstanding += mm.outstanding;
      });
      return { monthBilled: billed, monthRevenue: collected, monthOutstanding: outstanding };
    }
    const mm = monthMoney({ bookings: revBookings, revenues, month: filterMonth });
    return { monthBilled: mm.billed, monthRevenue: mm.collected, monthOutstanding: mm.outstanding };
  }, [revBookings, revenues, filterMonth]);

  // ── Expense stats ─────────────────────────────────────────────────────────────
  // NOTE: startsWith("") matches every date, so an empty filterMonth correctly
  // means "all months" here — never fall back to the current month.
  const { businessTotal, nonBusinessTotal } = useMemo(() => {
    const mExp = normalizedExpenses.filter(e => (e.date||"").startsWith(filterMonth));
    return {
      businessTotal:    mExp.filter(e => e.expType === "business").reduce((s,e) => s+(e.amount||0), 0),
      nonBusinessTotal: mExp.filter(e => e.expType === "nonbusiness").reduce((s,e) => s+(e.amount||0), 0),
    };
  }, [normalizedExpenses, filterMonth]);

  const netProfit   = monthRevenue - businessTotal;
  const cashInHand  = monthRevenue - businessTotal - nonBusinessTotal;

  // ── Cost analysis inputs — business expenses only, normalized to {cat, amount, date}
  const allBizItems = useMemo(() =>
    normalizedExpenses.filter(e => e.expType === "business")
      .map(e => ({ cat: e.category, amount: e.amount, date: e.date })),
  [normalizedExpenses]);
  const monthBizItems = useMemo(() =>
    allBizItems.filter(e => (e.date||"").startsWith(filterMonth)),
  [allBizItems, filterMonth]);

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...normalizedExpenses];
    if (search)      list = list.filter(e => (e.category||"").toLowerCase().includes(search.toLowerCase()) || (e.note||"").toLowerCase().includes(search.toLowerCase()) || (e.empName||"").toLowerCase().includes(search.toLowerCase()));
    if (filterCat)   list = list.filter(e => e.category === filterCat);
    if (filterType)  list = list.filter(e => e.expType === filterType);
    if (filterMonth) list = list.filter(e => (e.date||"").startsWith(filterMonth));
    return list.sort((a,b) => (b.date||"") > (a.date||"") ? 1 : -1);
  }, [normalizedExpenses, search, filterCat, filterType, filterMonth]);

  const filteredTotal = filtered.reduce((s,e)=>s+(e.amount||0),0);

  const allMonths = useMemo(() => {
    const s = new Set([
      ...normalizedExpenses.map(e=>(e.date||"").slice(0,7)),
      ...allRevEntries.map(r=>(r.date||"").slice(0,7)),
      thisMonth,
    ].filter(Boolean));
    // Always offer this month + the last 2 so recent past months can be picked
    // (and their full revenue loaded on demand), even before their rows arrive.
    const d = new Date();
    for (let i = 0; i < 3; i++) { s.add(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); d.setMonth(d.getMonth()-1); }
    return [...s].sort().reverse();
  }, [normalizedExpenses, allRevEntries, thisMonth]);

  const catOptions = form.type === "nonbusiness" ? NONBUSINESS_CAT_OPTIONS : BUSINESS_CAT_OPTIONS;

  // ── Form actions ─────────────────────────────────────────────────────────────
  function clearForm() {
    setForm(blankForm(today));
    setEditId(null);
    setErrors({});
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setF("fileData", ev.target.result);
    reader.readAsDataURL(file);
    setF("fileName", file.name);
  }

  function clearFile() {
    setF("fileData",""); setF("fileName","");
    if (fileRef.current) fileRef.current.value="";
  }

  function saveExpense() {
    const errs = {};
    if (!form.cat) errs.cat = "Category is required.";
    if (!form.date) errs.date = "Date is required.";
    if (!form.amount || parseFloat(form.amount) <= 0) errs.amount = "Enter valid amount.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const rec = {
      category: form.cat, date: form.date, amount: parseFloat(form.amount),
      note: form.desc, method: form.payMethod, by: curUser || "staff",
      empName: form.empName, empRole: form.empRole, payPeriod: form.payPeriod,
      billNo: form.billNo, billPeriod: form.billPeriod,
      fileData: form.fileData, fileName: form.fileName,
    };

    if (editId) {
      setExpenseType(editId, form.type);
      updateExpenses(expenses.map(e => e.id===editId ? { ...e, ...rec } : e));
      notify("Expense updated", "success");
    } else {
      const newId = String(Date.now());
      setExpenseType(newId, form.type);
      updateExpenses([...expenses, { id: newId, ...rec, createdAt: new Date().toISOString() }]);
      notify("Expense saved!", "success");
    }
    clearForm();
  }

  function startEdit(e) {
    setForm({
      type: hotelExpenseType(e, expTypes), cat: e.category||"", date: e.date||today,
      amount: String(e.amount||""), desc: e.note||"", payMethod: e.method||"Cash",
      empName: e.empName||"", empRole: e.empRole||"", payPeriod: e.payPeriod||"",
      billNo: e.billNo||"", billPeriod: e.billPeriod||"",
      fileData: e.fileData||"", fileName: e.fileName||"",
    });
    setEditId(e.id);
    setErrors({});
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  function confirmDelete() {
    gaRecordDeleted("exp", delTarget.id);
    removeExpenseType(delTarget.id);
    updateExpenses(expenses.filter(e => e.id !== delTarget.id));
    if (hasSupabase()) deleteRow("expenses", delTarget.id).catch(() => {});
    notify("Expense deleted","success");
    setDelTarget(null);
  }

  function exportCSV() {
    const headers = ["Date","Type","Category","Description","Amount","Payment","By"];
    const rows = filtered.map(e => [e.date,e.expType,e.category,e.note,e.amount,e.method,e.by].map(v=>`"${(v||"").toString().replace(/"/g,'""')}"`));
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const a = document.createElement("a"); a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv); a.download="hotel-expenses.csv"; a.click();
  }

  const inp = (s={}) => ({ padding:"9px 12px", border:"1.5px solid #d5dce6", borderRadius:8, fontSize:13, fontFamily:"inherit", background:"#fff", width:"100%", boxSizing:"border-box", outline:"none", ...s });
  const lbl = { fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:.5, marginBottom:4, display:"block" };
  const errT = { fontSize:11, color:C.red, marginTop:3 };

  const isSalary = form.cat === "Salaries";
  const isBill   = form.cat === "Electricity" || form.cat === "Utilities";
  const isNonBusiness = form.type === "nonbusiness";

  const monthLabel = filterMonth
    ? new Date(filterMonth+"-01").toLocaleString("en-GB",{month:"long",year:"numeric"})
    : "All Time";

  return (
    <div style={{ padding: isMobile?"10px 8px":"22px 24px", width:"100%", overflowY:"auto", height:"100%", boxSizing:"border-box" }}>

      {/* ── Page title + month selector (synced with the filter bar below) ── */}
      <div style={{ display:"flex", alignItems:"center", gap:11, flexWrap:"wrap", marginBottom:14 }}>
        <span style={{ width:30, height:30, borderRadius:9, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <i className="ti ti-wallet" style={{ color:"var(--gold2)", fontSize:16 }} />
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--text)" }}>Expenses &amp; Cash</div>
          <div style={{ fontSize:11, color:C.dim }}>Hotel money overview — {monthLabel}
            {loadingRevMonth && loadingRevMonth === filterMonth && (
              <span style={{ marginLeft:8, color:C.navy, fontWeight:600 }}><i className="ti ti-loader ti-spin" /> loading full month…</span>
            )}
          </div>
        </div>
        {/* Picking a month is an admin tool. A manager sees this month only. */}
        {!isAdmin && (
          <span style={{ display:"inline-flex", alignItems:"center", gap:7, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 11px", fontSize:12.5, fontWeight:600, color:"var(--text2)" }}>
            <i className="ti ti-calendar" style={{ fontSize:14, color:"var(--text3)" }} />{monthLabel}
          </span>
        )}
        {isAdmin && <div style={{ display:"flex", alignItems:"center", gap:7, background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:8, padding:"5px 9px" }}>
          <i className="ti ti-calendar" style={{ fontSize:14, color:"var(--text3)" }} />
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
            style={{ padding:0, border:"none", background:"transparent", fontSize:12.5, fontWeight:600, fontFamily:"inherit", color:"var(--text)", cursor:"pointer", outline:"none" }}>
            <option value="">All Months</option>
            {allMonths.map(m=>{
              const [y,mo]=m.split("-");
              return <option key={m} value={m}>{MONTHS_LABEL[parseInt(mo)-1]} {y}</option>;
            })}
          </select>
        </div>}
      </div>

      {/* ── All seven figures on one compact line ── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile?"repeat(2,minmax(0,1fr))":"repeat(7,minmax(0,1fr))", gap:7, marginBottom:12 }}>
        {[
          ["Billed",        monthBilled,      "var(--text)",                       false],
          ["Collected",     monthRevenue,     "#2f7d4f",                           false],
          ["Outstanding",   monthOutstanding, monthOutstanding>0?"#b5322a":"var(--text3)", false],
          ["Business exp.", businessTotal,    "#b5322a",                           false],
          ["Non-business",  nonBusinessTotal, "var(--text)",                       false],
          ["Net profit",    netProfit,        netProfit>=0?"#2f7d4f":"#b5322a",    false],
          ["Cash in hand",  cashInHand,       cashInHand>=0?"#a6832c":"#b5322a",   true ],
        ].map(([label,val,color,accent])=>(
          <div key={label} title={label} style={{ background:"var(--bg2)", border:"1px solid "+(accent?"#e3d6a8":"var(--border)"), borderRadius:10, padding:"8px 10px", minWidth:0 }}>
            <div style={{ fontSize:8.5, letterSpacing:.5, textTransform:"uppercase", color:accent?"#a6832c":C.dim, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{label}</div>
            <div style={{ fontSize:14.5, fontWeight:600, color, marginTop:2, fontVariantNumeric:"tabular-nums", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{money(val)}</div>
          </div>
        ))}
      </div>

      {/* ── Cost analysis — where did the money go? ── */}
      <CostAnalysis
        items={monthBizItems}
        allItems={allBizItems}
        monthKey={filterMonth || thisMonth}
        monthLabel={monthLabel}
        catEmoji={CAT_EMOJI}
        accent={C.navy}
        onPickCategory={cat => { setFilterCat(prev => prev === cat ? "" : cat); setShowRecords(true); }}
      />

      {/* ── Record Expense Form — whole panel tints with the selected type ── */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:12, padding:"14px 15px", marginBottom:14 }}>

        {/* Collapsed by default so the whole page fits one screen; auto-opens while editing */}
        <div onClick={() => !editId && setShowForm(v => !v)}
          style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap", cursor: editId ? "default" : "pointer" }}>
          <span style={{ width:24, height:24, borderRadius:7, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <i className={"ti "+(editId ? "ti-edit" : "ti-plus")} style={{ fontSize:13, color:"var(--text2)" }} />
          </span>
          <span style={{ fontSize:10.5, fontWeight:600, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" }}>
            {editId ? "Editing record" : "Add a record"}
          </span>
          {!editId && (
            <span style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, fontSize:10.5, color:"var(--text3)" }}>
              {(showForm ? "Hide" : "Open")}
              <i className={"ti "+((showForm||editId) ? "ti-chevron-up" : "ti-chevron-down")} style={{ fontSize:14 }} />
            </span>
          )}
        </div>

        {(showForm || editId) && (<div style={{ marginTop:12 }}>

        {/* Business / Non-Business toggle */}
        <div style={{ display:"inline-flex", border:"1px solid var(--border)", borderRadius:8, overflow:"hidden", marginBottom:11 }}>
          <button type="button" onClick={()=>{ setF("type","business"); setF("cat",""); }}
            style={{ padding:"6px 14px", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, fontSize:12, transition:"all .12s",
              background:form.type==="business"?"var(--navy)":"transparent",
              color:form.type==="business"?"#fff":"var(--text2)" }}>
            Business expense
          </button>
          <button type="button" onClick={()=>{ setF("type","nonbusiness"); setF("cat",""); }}
            style={{ padding:"6px 14px", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, fontSize:12, transition:"all .12s",
              background:form.type==="nonbusiness"?"var(--navy)":"transparent",
              color:form.type==="nonbusiness"?"#fff":"var(--text2)" }}>
            Non-business transfer
          </button>
        </div>

        {/* Info line */}
        <div style={{ fontSize:11, color:"var(--text3)", marginBottom:12, lineHeight:1.5 }}>
          {isNonBusiness
            ? "Non-business transfers (bank, donation, lending, owner use) reduce cash in hand but do NOT affect profit."
            : "Business expenses (salaries, electricity, supplies) reduce both profit and cash in hand."}
        </div>

        {/* Main fields */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr 1fr", gap:14, marginBottom:12 }}>
          <div>
            <label style={lbl}>Category *</label>
            <select value={form.cat} onChange={e=>setF("cat",e.target.value)} style={inp(errors.cat?{borderColor:C.red}:{})}>
              <option value="">— Select —</option>
              {catOptions.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            {errors.cat && <div style={errT}>{errors.cat}</div>}
          </div>
          <div>
            <label style={lbl}>Date *</label>
            <input type="date" value={form.date} onChange={e=>setF("date",e.target.value)} style={inp(errors.date?{borderColor:C.red}:{})} />
            {errors.date && <div style={errT}>{errors.date}</div>}
          </div>
          <div>
            <label style={lbl}>Amount (৳) *</label>
            <input type="number" value={form.amount} onChange={e=>setF("amount",e.target.value)} placeholder="0" min="0" style={inp(errors.amount?{borderColor:C.red}:{})} />
            {errors.amount && <div style={errT}>{errors.amount}</div>}
          </div>
        </div>

        {/* Salary extra fields */}
        {isSalary && (
          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr 1fr", gap:14, marginBottom:12 }}>
            <div><label style={lbl}>Employee Name</label><input value={form.empName} onChange={e=>setF("empName",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Role</label><input value={form.empRole} onChange={e=>setF("empRole",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Pay Period</label><input value={form.payPeriod} onChange={e=>setF("payPeriod",e.target.value)} placeholder="e.g. July 2026" style={inp()} /></div>
          </div>
        )}

        {/* Bill extra fields */}
        {isBill && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:12 }}>
            <div><label style={lbl}>Bill / Account No</label><input value={form.billNo} onChange={e=>setF("billNo",e.target.value)} style={inp()} /></div>
            <div><label style={lbl}>Billing Period</label><input value={form.billPeriod} onChange={e=>setF("billPeriod",e.target.value)} style={inp()} /></div>
          </div>
        )}

        {/* Description + Payment */}
        <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:14, marginBottom:12 }}>
          <div><label style={lbl}>Description / Note</label><input value={form.desc} onChange={e=>setF("desc",e.target.value)} placeholder="Optional details..." style={inp()} /></div>
          <div>
            <label style={lbl}>Payment Method</label>
            <select value={form.payMethod} onChange={e=>setF("payMethod",e.target.value)} style={inp()}>
              {PAY_METHODS.map(p=><option key={p.v} value={p.v}>{p.i} {p.v}</option>)}
            </select>
          </div>
        </div>

        {/* File attachment */}
        <div style={{ background:"#fff", border:"1.5px dashed #b9cbe2", borderRadius:10, padding:14, marginBottom:14 }}>
          <div style={{ fontSize:10, letterSpacing:1.5, textTransform:"uppercase", color:C.gold, marginBottom:9, fontWeight:700 }}>📎 Attach Invoice / Receipt</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <label htmlFor="hotelExpFile" style={{ display:"inline-block", padding:"7px 13px", background:"#eef4fb", border:`1.5px solid ${C.navy}60`, borderRadius:8, cursor:"pointer", fontSize:11, color:C.navy, fontWeight:600 }}>
              📁 Choose File
            </label>
            <input id="hotelExpFile" type="file" ref={fileRef} accept="image/*,.pdf" onChange={handleFile} style={{ display:"none" }} />
            <span style={{ fontSize:11, color:C.dim }}>{form.fileName || "No file chosen"}</span>
            {form.fileName && (
              <button onClick={clearFile} style={{ padding:"4px 9px", background:"transparent", border:`1.5px solid ${C.red}`, borderRadius:6, color:C.red, fontSize:10, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>✕ Remove</button>
            )}
          </div>
          {form.fileData && form.fileData.startsWith("data:image") && (
            <img src={form.fileData} alt="receipt" style={{ maxWidth:180, maxHeight:120, borderRadius:8, border:`1.5px solid ${C.border}`, marginTop:8 }} />
          )}
          {form.fileData && form.fileData.startsWith("data:application/pdf") && (
            <div style={{ marginTop:8, padding:"7px 11px", background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:11, color:C.dim }}>📄 PDF attached: {form.fileName}</div>
          )}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
          <button onClick={clearForm} style={{ padding:"9px 18px", borderRadius:9, border:"1px solid var(--border)", background:"var(--bg2)", cursor:"pointer", fontFamily:"inherit", fontWeight:600, fontSize:13 }}>Cancel</button>
          <button onClick={saveExpense} style={{ padding:"9px 22px", borderRadius:9, border:"none", background:"var(--navy)", color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:600, fontSize:13 }}>
            {editId ? "Update expense" : "Save expense"}
          </button>
        </div>
        </div>)}
      </div>

      {/* ── Collapsible records section ── */}
      <button onClick={()=>setShowRecords(v=>!v)} style={{
        width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", gap:9,
        padding:"12px 15px", marginBottom:12, borderRadius:12, cursor:"pointer",
        border:"1px solid var(--border)", background:"var(--bg2)", fontFamily:"inherit" }}>
        <span style={{ display:"flex", alignItems:"center", gap:9, minWidth:0 }}>
          <span style={{ width:24, height:24, borderRadius:7, background:"var(--bg3)", display:"inline-flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <i className="ti ti-list-details" style={{ fontSize:13, color:"var(--text2)" }} />
          </span>
          <span style={{ fontSize:10.5, fontWeight:600, letterSpacing:.8, textTransform:"uppercase", color:"var(--text2)" }}>All expense records</span>
          <span style={{ fontSize:11.5, color:"var(--text3)", fontVariantNumeric:"tabular-nums" }}>{filtered.length} · {money(filteredTotal)}</span>
        </span>
        <span style={{ fontSize:11.5, fontWeight:600, color:"var(--text3)", display:"flex", alignItems:"center", gap:4 }}>
          <i className={"ti "+(showRecords ? "ti-chevron-up" : "ti-chevron-down")} style={{ fontSize:14 }} />{showRecords ? "Hide" : "Show"}
        </span>
      </button>

      {showRecords && (<>
      {/* ── Filter bar ── */}
      <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search..." style={{ ...inp(), flex:1, minWidth:140 }} />
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...inp(), maxWidth:190 }}>
          <option value="">All Types</option>
          <option value="business">🏨 Business</option>
          <option value="nonbusiness">💸 Non-Business</option>
        </select>
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ ...inp(), maxWidth:200 }}>
          <option value="">All Categories</option>
          {[...BUSINESS_CAT_OPTIONS,...NONBUSINESS_CAT_OPTIONS].map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        {isAdmin && <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={{ ...inp(), maxWidth:170 }}>
          <option value="">All Months</option>
          {allMonths.map(m=>{
            const [y,mo]=m.split("-");
            return <option key={m} value={m}>{MONTHS_LABEL[parseInt(mo)-1]} {y}</option>;
          })}
        </select>}
        <button onClick={exportCSV} style={{ padding:"9px 14px", borderRadius:8, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:11, whiteSpace:"nowrap" }}>⬇ CSV</button>
      </div>

      {/* ── Filtered total bar ── */}
      <div style={{ display:"flex", gap:12, marginBottom:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:12, color:C.dim }}>
          <strong style={{ color:"#333" }}>{filtered.length}</strong> records &nbsp;·&nbsp;
          Total: <strong style={{ color:C.red }}>{money(filteredTotal)}</strong>
        </div>
      </div>

      {/* ── Expenses table ── */}
      <div style={{ background:"#fff", border:`1.5px solid ${C.border}`, borderRadius:12, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
          <thead>
            <tr style={{ background:"#f2f6fb" }}>
              {["Date","Type","Category","Description","Amount","Payment","Receipt","Actions"].map(h=>(
                <th key={h} style={{ padding:"10px 12px", fontSize:10, color:C.dim, fontWeight:800, textTransform:"uppercase", letterSpacing:.5, borderBottom:`1.5px solid ${C.border}`, textAlign:"left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign:"center", padding:32, color:C.dim, fontSize:13 }}>No expenses found.</td></tr>
            ) : filtered.map(e => {
              const isBiz = e.expType === "business";
              return (
                <tr key={e.id} style={{ borderBottom:"1px solid #edf1f6" }}>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>
                    <div style={{ fontWeight:700 }}>{fmtDate(e.date)}</div>
                    {e.payPeriod && <div style={{ fontSize:10, color:C.dim }}>{e.payPeriod}</div>}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <span style={{ fontSize:10, fontWeight:800, padding:"3px 8px", borderRadius:6,
                      background: isBiz?"#e3ecf7":"#fff7ed",
                      color: isBiz?C.navy:C.orange, whiteSpace:"nowrap" }}>
                      {isBiz ? "🏨 Business" : "💸 Non-Business"}
                    </span>
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <span style={{ width:28, height:28, borderRadius:7, background:"#f2f6fb", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{CAT_EMOJI[e.category]||"📌"}</span>
                      <div>
                        <div style={{ fontWeight:700, fontSize:12 }}>{e.category}</div>
                        {e.empName && <div style={{ fontSize:10, color:C.dim }}>{e.empName}{e.empRole?" · "+e.empRole:""}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12, color:C.dim }}>{e.note || "—"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:800, color:isBiz?C.red:C.orange, fontFamily:"'Playfair Display',serif", fontSize:14 }}>৳{(e.amount||0).toLocaleString()}</div>
                  </td>
                  <td style={{ padding:"10px 12px", fontSize:12 }}>{e.method || "Cash"}</td>
                  <td style={{ padding:"10px 12px" }}>
                    {e.fileData && e.fileData.startsWith("data:image") ? (
                      <img src={e.fileData} alt="receipt" onClick={()=>window.open(e.fileData)} style={{ width:36, height:36, borderRadius:6, objectFit:"cover", cursor:"pointer", border:`1px solid ${C.border}` }} title="Click to view" />
                    ) : e.fileData ? (
                      <button onClick={()=>window.open(e.fileData)} style={{ fontSize:10, padding:"3px 8px", borderRadius:6, border:`1px solid ${C.border}`, background:"#f2f6fb", cursor:"pointer" }}>📄 PDF</button>
                    ) : <span style={{ color:"#ccc", fontSize:11 }}>—</span>}
                  </td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <button onClick={()=>startEdit(e)} style={{ padding:"4px 8px", borderRadius:7, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontSize:12 }}>✏️</button>
                      {isAdmin && <button onClick={()=>setDelTarget(e)} style={{ padding:"4px 8px", borderRadius:7, border:`1.5px solid ${C.red}40`, background:"#fff0f0", cursor:"pointer", fontSize:12 }}>🗑</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>)}

      {/* ── Delete confirm modal ── */}
      {delTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 }}
          onClick={e=>e.target===e.currentTarget&&setDelTarget(null)}>
          <div style={{ background:"#fff", borderRadius:16, padding:24, width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,.2)" }}>
            <div style={{ fontSize:15, fontWeight:800, color:C.navy, marginBottom:12 }}>🗑 Delete Expense</div>
            <div style={{ fontSize:13, marginBottom:14, color:C.dim }}>
              Delete <strong>{delTarget.category}</strong> · ৳{(delTarget.amount||0).toLocaleString()} on {fmtDate(delTarget.date)}? This cannot be undone.
            </div>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <button onClick={()=>setDelTarget(null)} style={{ padding:"9px 18px", borderRadius:9, border:"1.5px solid #d5dce6", background:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>Cancel</button>
              <button onClick={confirmDelete} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:C.red, color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:800 }}>🗑 Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
