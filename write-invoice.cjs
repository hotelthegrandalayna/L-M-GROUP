const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Invoice.jsx';

const code = `import { useState, useMemo, useRef } from "react";
import { useApp } from "../context/AppContext";
import { todayStr, money, maxId } from "../utils/helpers";

const STATUS_COLORS = {
  confirmed:    { bg:"#fffbee", border:"#FCD34D", color:"#8a6200" },
  "checked-in": { bg:"#f0fdf4", border:"#86efac", color:"#166534" },
  "checked-out":{ bg:"#f8fafc", border:"#cbd5e1", color:"#475569" },
  cancelled:    { bg:"#fff1f2", border:"#fca5a5", color:"#991b1b" },
};

function Badge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.confirmed;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 9px", borderRadius:12,
      fontSize:11, fontWeight:700, background:s.bg, border:"1.5px solid "+s.border, color:s.color }}>
      {status.replace("-"," ")}
    </span>
  );
}

function PaymentModal({ booking, onClose }) {
  const { curUser, bookings, updateBookings, revenues, updateRevenues, notify } = useApp();
  const b = booking;
  const today = todayStr();
  const history   = b.paymentHistory || [];
  const totalPaid = history.reduce((s,p) => s+p.amount, 0);
  const invoiceTotal = b.invoiceTotal != null ? b.invoiceTotal : b.amount;
  const balance   = Math.max(0, invoiceTotal - totalPaid);
  const [amt,  setAmt]  = useState(balance);
  const [mtd,  setMtd]  = useState("Cash");
  const [txn,  setTxn]  = useState("");
  const [note, setNote] = useState("");
  const needsTxn = ["bKash","Nagad"].includes(mtd);

  function submit() {
    const a = parseFloat(amt)||0;
    if (a<=0) { notify("Enter a valid amount","error"); return; }
    if (a>balance+0.01) { notify("Amount exceeds balance due","error"); return; }
    const entry = { ts:new Date().toISOString(), amount:a, method:mtd, txnNumber:needsTxn?txn:"", note:note||"Payment", type:"room", by:curUser||"staff" };
    updateBookings(bookings.map(x => x.id===b.id ? {...x, paymentHistory:[...history,entry]} : x));
    updateRevenues([...revenues, { id:maxId(revenues), source:"Room Rent", amount:a, date:today,
      note:b.guest+" Rm "+b.room+" - "+(note||"payment")+" ("+mtd+")", bookingId:b.id }]);
    notify("Payment of "+money(a)+" recorded","success");
    onClose();
  }

  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{ maxWidth:400 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="ti ti-credit-card" style={{ color:"var(--gold)" }} /> Collect Payment</div>
            <div className="modal-sub">{b.guest} - Invoice #{b.id}</div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div style={{ background:"var(--navy)", color:"#fff", borderRadius:9, padding:"12px 16px", marginBottom:14, display:"flex", justifyContent:"space-around" }}>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:10, opacity:.6 }}>Invoice Total</div><div style={{ fontSize:17, fontWeight:800 }}>{money(invoiceTotal)}</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:10, opacity:.6 }}>Paid</div><div style={{ fontSize:17, fontWeight:800, color:"#6de8a8" }}>{money(totalPaid)}</div></div>
          <div style={{ textAlign:"center" }}><div style={{ fontSize:10, opacity:.6 }}>Balance</div><div style={{ fontSize:17, fontWeight:800, color:balance>0?"#f5a0a0":"#6de8a8" }}>{money(balance)}</div></div>
        </div>
        {balance<=0 ? (
          <div style={{ textAlign:"center", padding:20, color:"var(--green)", fontWeight:700 }}><i className="ti ti-circle-check" style={{ fontSize:28 }} /><br />Fully Paid</div>
        ) : (<>
          <div className="form-row">
            <div className="form-group"><label>Amount (BDT) *</label><input type="number" value={amt} min="0" max={balance} onChange={e=>setAmt(e.target.value)} /></div>
            <div className="form-group"><label>Method</label>
              <select value={mtd} onChange={e=>setMtd(e.target.value)}>
                {["Cash","bKash","Nagad","Card","Bank Transfer"].map(m=><option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          {needsTxn && <div className="form-group"><label>Transaction Number</label><input value={txn} onChange={e=>setTxn(e.target.value)} placeholder="01X-XXXXXXXXXX" /></div>}
          <div className="form-group"><label>Note</label><input value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional note" /></div>
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" onClick={submit}><i className="ti ti-credit-card" /> Record Payment</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

function InvoiceView({ booking, onClose, onPay }) {
  const { curRole, curUser, invItems, bookings, updateBookings, revenues, updateRevenues, expenses, updateExpenses, notify } = useApp();
  const b = booking;
  const today = todayStr();
  const printRef = useRef();
  const history    = b.paymentHistory || [];
  const totalPaid  = history.reduce((s,p)=>s+p.amount,0);
  const roomTotal  = b.amount || 0;
  const extras     = b.extraItems || [];
  const extrasTotal= extras.reduce((s,x)=>s+x.total,0);
  const invoiceTotal = b.invoiceTotal != null ? b.invoiceTotal : (roomTotal + extrasTotal);
  const balance    = Math.max(0, invoiceTotal - totalPaid);
  const [addingItem, setAddingItem] = useState(false);
  const [iName, setIName] = useState("");
  const [iQty,  setIQty]  = useState(1);
  const [iRate, setIRate] = useState(0);

  function addItem() {
    if (!iName.trim()) { notify("Item name required","error"); return; }
    const qty  = parseInt(iQty)||1;
    const rate = parseFloat(iRate)||0;
    const total = qty*rate;
    const item  = { id:Date.now(), name:iName.trim(), qty, rate, total };
    const newExtras = [...extras, item];
    const newTotal  = roomTotal + newExtras.reduce((s,x)=>s+x.total,0);
    updateBookings(bookings.map(x => x.id===b.id ? {...x, extraItems:newExtras, invoiceTotal:newTotal} : x));
    setIName(""); setIQty(1); setIRate(0); setAddingItem(false);
    notify("Item added to invoice","success");
  }

  function removeItem(itemId) {
    const newExtras = extras.filter(x=>x.id!==itemId);
    const newTotal  = roomTotal + newExtras.reduce((s,x)=>s+x.total,0);
    updateBookings(bookings.map(x => x.id===b.id ? {...x, extraItems:newExtras, invoiceTotal:newTotal} : x));
    notify("Item removed","success");
  }

  function doPrint() {
    const w = window.open("","_blank");
    w.document.write("<html><head><title>Invoice #"+b.id+"</title><style>body{font-family:Arial,sans-serif;margin:30px;color:#1a2340}table{width:100%;border-collapse:collapse}th,td{padding:8px 10px;border:1px solid #e2e8f0;font-size:12px}th{background:#1a2340;color:#C9A84C}h1{color:#1a2340}h3{color:#777;font-weight:400}.total{background:#f8fafc}.grand{background:#1a2340;color:#fff}@media print{button{display:none}}</style></head><body>");
    w.document.write("<h1>Hotel The Grand Alayna</h1><p style='color:#777;margin-top:-10px'>Sitakunda, Chattogram | +880 1XXX-XXXXXX</p><hr/>");
    w.document.write("<h2 style='margin-bottom:4px'>Invoice #"+b.id+"</h2>");
    w.document.write("<table style='margin-bottom:16px'><tr><th>Guest</th><th>Phone</th><th>Room</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Status</th></tr>");
    w.document.write("<tr><td>"+b.guest+"</td><td>"+b.phone+"</td><td>Rm "+b.room+"</td><td>"+b.checkin+"</td><td>"+b.checkout+"</td><td>"+b.nights+"</td><td>"+b.status+"</td></tr></table>");
    w.document.write("<table><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>");
    w.document.write("<tr><td>Room Rent (Rm "+b.room+" x "+b.nights+" nights)</td><td>"+b.nights+"</td><td>"+money(b.amount/b.nights)+"</td><td>"+money(b.amount)+"</td></tr>");
    extras.forEach(function(x){ w.document.write("<tr><td>"+x.name+"</td><td>"+x.qty+"</td><td>"+money(x.rate)+"</td><td>"+money(x.total)+"</td></tr>"); });
    w.document.write("<tr class='total'><td colspan='3'><strong>Invoice Total</strong></td><td><strong>"+money(invoiceTotal)+"</strong></td></tr>");
    w.document.write("<tr><td colspan='3'>Amount Paid</td><td>"+money(totalPaid)+"</td></tr>");
    w.document.write("<tr class='grand'><td colspan='3'><strong>Balance Due</strong></td><td><strong>"+money(balance)+"</strong></td></tr>");
    w.document.write("</table>");
    if (history.length>0) {
      w.document.write("<h3 style='margin-top:20px'>Payment History</h3><table><tr><th>Date</th><th>Amount</th><th>Method</th><th>Note</th></tr>");
      history.forEach(function(p){ w.document.write("<tr><td>"+new Date(p.ts).toLocaleString()+"</td><td>"+money(p.amount)+"</td><td>"+p.method+"</td><td>"+(p.note||"")+"</td></tr>"); });
      w.document.write("</table>");
    }
    w.document.write("<p style='margin-top:30px;color:#888;font-size:11px'>Printed: "+new Date().toLocaleString()+" by "+(curUser||"staff")+"</p>");
    w.document.write("</body></html>");
    w.document.close();
    w.focus();
    setTimeout(()=>w.print(),400);
  }

  function downloadXLS() {
    const rows = [
      ["Invoice #","Guest","Phone","Room","Type","Check-in","Check-out","Nights","Room Amt","Extras","Invoice Total","Paid","Balance","Status"],
      ["#"+b.id, b.guest, b.phone, "Rm "+b.room, b.type, b.checkin, b.checkout, b.nights,
       b.amount, extrasTotal, invoiceTotal, totalPaid, balance, b.status],
    ];
    const xls = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body><table>'
      + rows.map(r=>"<tr>"+r.map(c=>"<td>"+c+"</td>").join("")+"</tr>").join("")
      + "</table></body></html>";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xls],{type:"application/vnd.ms-excel;charset=UTF-8"}));
    a.download = "invoice_"+b.id+"_"+todayStr()+".xls";
    a.click();
  }

  const canEdit = curRole==="admin" || curRole==="manager";

  return (
    <div className="modal-overlay open" onClick={e => e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{ maxWidth:620 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title"><i className="ti ti-file-invoice" style={{ color:"var(--gold)" }} /> Invoice #{b.id}</div>
            <div className="modal-sub">{b.guest} &bull; Rm {b.room} &bull; <Badge status={b.status} /></div>
          </div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14, fontSize:12 }}>
          {[["Check-in",b.checkin],["Check-out",b.checkout],["Nights",b.nights],["Phone",b.phone]].map(([l,v])=>(
            <div key={l} style={{ background:"var(--panel)", borderRadius:7, padding:"7px 10px" }}>
              <div style={{ fontSize:10, color:"var(--text3)", marginBottom:2 }}>{l}</div>
              <strong>{v}</strong>
            </div>
          ))}
        </div>

        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, marginBottom:14 }}>
          <thead>
            <tr style={{ background:"var(--navy2)", color:"var(--gold)" }}>
              {["Description","Qty","Rate","Amount",""].map(h=>(
                <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, textTransform:"uppercase", letterSpacing:.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom:"1px solid var(--border)" }}>
              <td style={{ padding:"10px 10px" }}>Room Rent - Rm {b.room} ({b.type})</td>
              <td style={{ padding:"10px 10px" }}>{b.nights}</td>
              <td style={{ padding:"10px 10px" }}>{money(b.nights>0?Math.round(b.amount/b.nights):0)}/night</td>
              <td style={{ padding:"10px 10px", fontWeight:700 }}>{money(b.amount)}</td>
              <td></td>
            </tr>
            {extras.map(x=>(
              <tr key={x.id} style={{ borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"10px 10px" }}>{x.name}</td>
                <td style={{ padding:"10px 10px" }}>{x.qty}</td>
                <td style={{ padding:"10px 10px" }}>{money(x.rate)}</td>
                <td style={{ padding:"10px 10px", fontWeight:700 }}>{money(x.total)}</td>
                <td style={{ padding:"10px 10px" }}>
                  {canEdit && <button className="btn sm danger" style={{ fontSize:10 }} onClick={()=>removeItem(x.id)}><i className="ti ti-x" /></button>}
                </td>
              </tr>
            ))}
            {addingItem && (
              <tr style={{ background:"#fffbee", borderBottom:"1px solid var(--border)" }}>
                <td style={{ padding:"6px 8px" }}><input value={iName} onChange={e=>setIName(e.target.value)} placeholder="Item name" style={{ width:"100%", fontSize:12 }} /></td>
                <td style={{ padding:"6px 8px" }}><input type="number" value={iQty} min="1" onChange={e=>setIQty(e.target.value)} style={{ width:55, fontSize:12 }} /></td>
                <td style={{ padding:"6px 8px" }}><input type="number" value={iRate} min="0" onChange={e=>setIRate(e.target.value)} style={{ width:80, fontSize:12 }} /></td>
                <td style={{ padding:"6px 8px", fontSize:12, fontWeight:700 }}>{money((parseInt(iQty)||1)*(parseFloat(iRate)||0))}</td>
                <td style={{ padding:"6px 8px", display:"flex", gap:4 }}>
                  <button className="btn sm primary" style={{ fontSize:10 }} onClick={addItem}><i className="ti ti-check" /></button>
                  <button className="btn sm" style={{ fontSize:10 }} onClick={()=>setAddingItem(false)}><i className="ti ti-x" /></button>
                </td>
              </tr>
            )}
            <tr style={{ background:"var(--panel)", fontWeight:700 }}>
              <td colSpan={3} style={{ padding:"10px 10px", textAlign:"right" }}>Invoice Total</td>
              <td style={{ padding:"10px 10px", fontSize:15 }}>{money(invoiceTotal)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={3} style={{ padding:"8px 10px", textAlign:"right", color:"var(--green)" }}>Amount Paid</td>
              <td style={{ padding:"8px 10px", color:"var(--green)", fontWeight:700 }}>{money(totalPaid)}</td>
              <td></td>
            </tr>
            <tr style={{ background:"var(--navy)", color:"#fff" }}>
              <td colSpan={3} style={{ padding:"10px 10px", textAlign:"right", fontWeight:800 }}>Balance Due</td>
              <td style={{ padding:"10px 10px", fontWeight:800, fontSize:15, color:balance>0?"#f5a0a0":"#6de8a8" }}>{money(balance)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        {history.length>0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:800, color:"var(--text3)", textTransform:"uppercase", marginBottom:6 }}>Payment History</div>
            {history.map((p,i)=>(
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 10px", borderBottom:"1px solid var(--border)", fontSize:12 }}>
                <div><span style={{ fontWeight:700 }}>{money(p.amount)}</span> via {p.method} {p.note?"- "+p.note:""}</div>
                <div style={{ color:"var(--text3)", fontSize:11 }}>{new Date(p.ts).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {canEdit && !addingItem && !["cancelled","checked-out"].includes(b.status) && (
            <button className="btn sm" style={{ marginRight:"auto" }} onClick={()=>setAddingItem(true)}><i className="ti ti-plus" /> Add Item</button>
          )}
          <button className="btn sm" onClick={doPrint}><i className="ti ti-printer" /> Print</button>
          <button className="btn sm" onClick={downloadXLS}><i className="ti ti-download" /> Excel</button>
          {balance>0 && !["cancelled"].includes(b.status) && (
            <button className="btn primary sm" onClick={()=>onPay(b)}><i className="ti ti-credit-card" /> Collect Payment</button>
          )}
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

const FILTERS = ["all","confirmed","checked-in","checked-out","cancelled"];

export default function Invoice() {
  const { curRole, curUser, bookings, updateBookings, revenues, updateRevenues, notify } = useApp();
  const today = todayStr();
  const [filter, setFilter]   = useState("all");
  const [search, setSearch]   = useState("");
  const [viewBk, setViewBk]   = useState(null);
  const [payBk,  setPayBk]    = useState(null);
  const [selected, setSelected] = useState([]);
  const [pwInput, setPwInput]  = useState("");
  const [pwModal, setPwModal]  = useState(false);
  const [sortKey, setSortKey]  = useState("id");
  const [sortDir, setSortDir]  = useState("desc");

  const filtered = useMemo(() => {
    let arr = [...bookings];
    if (filter!=="all") arr = arr.filter(b=>b.status===filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter(b=>b.guest?.toLowerCase().includes(q)||b.phone?.includes(q)||String(b.id).includes(q)||String(b.room).includes(q));
    }
    arr.sort((a,b)=>{
      let va=a[sortKey],vb=b[sortKey];
      if(typeof va==="string") va=va.toLowerCase(),vb=(vb||"").toLowerCase();
      if(va<vb) return sortDir==="asc"?-1:1;
      if(va>vb) return sortDir==="asc"?1:-1;
      return 0;
    });
    return arr;
  }, [bookings, filter, search, sortKey, sortDir]);

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);
  }

  function toggleAll() {
    if (selected.length===filtered.length) setSelected([]);
    else setSelected(filtered.map(b=>b.id));
  }

  function deleteSelected() {
    if (selected.length===0) { notify("Select at least one invoice","error"); return; }
    setPwModal(true);
  }

  function confirmDelete() {
    if (pwInput !== "admin123") { notify("Incorrect password","error"); return; }
    updateBookings(bookings.filter(b=>!selected.includes(b.id)));
    updateRevenues(revenues.filter(r=>!r.bookingId||!selected.includes(r.bookingId)));
    notify(selected.length+" invoice(s) deleted and linked revenues removed","error");
    setSelected([]); setPwModal(false); setPwInput("");
  }

  function downloadSelected() {
    const ids = selected.length>0 ? selected : filtered.map(b=>b.id);
    const rows = bookings.filter(b=>ids.includes(b.id));
    if (!rows.length) { notify("Nothing to download","error"); return; }
    const COLS = ["Invoice #","Guest","Phone","Room","Type","Check-in","Check-out","Nights","Room Amt","Extras","Invoice Total","Paid","Balance","Status","Notes"];
    const data = rows.map(b=>{
      const inv = b.invoiceTotal!=null?b.invoiceTotal:b.amount;
      const paid = (b.paymentHistory||[]).reduce((s,p)=>s+p.amount,0);
      const ext  = (b.extraItems||[]).reduce((s,x)=>s+x.total,0);
      return ["#"+b.id,b.guest,b.phone,"Rm "+b.room,b.type,b.checkin,b.checkout,b.nights,b.amount,ext,inv,paid,Math.max(0,inv-paid),b.status,b.notes||""];
    });
    const hStyle = 'style="background:#1a2340;color:#C9A84C;font-weight:bold;padding:6px 10px;"';
    const xls = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">'
      +'<head><meta charset="UTF-8"/><style>td{padding:5px 9px;border:1px solid #e2e8f0;}</style></head><body>'
      +'<table><tr><td colspan="'+COLS.length+'" style="font-size:16px;font-weight:bold;padding:10px;background:#f8fafc;">Hotel The Grand Alayna - Invoices ('+todayStr()+')</td></tr>'
      +'<tr>'+COLS.map(h=>'<th '+hStyle+'>'+h+'</th>').join("")+'</tr>'
      +data.map((r,i)=>'<tr style="background:'+(i%2===0?"#fff":"#f8fafc")+'">'+r.map(c=>'<td>'+c+'</td>').join("")+'</tr>').join("")
      +'</table></body></html>';
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([xls],{type:"application/vnd.ms-excel;charset=UTF-8"}));
    a.download = "invoices_"+todayStr()+".xls";
    a.click();
    notify("Downloaded "+(selected.length>0?selected.length:filtered.length)+" invoices","success");
  }

  function toggleSort(key) {
    if (sortKey===key) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  function SortIcon({ k }) {
    if (sortKey!==k) return <i className="ti ti-selector" style={{ opacity:.3, fontSize:11 }} />;
    return <i className={"ti ti-sort-"+(sortDir==="asc"?"ascending":"descending")+"-letters"} style={{ fontSize:11, color:"var(--gold2)" }} />;
  }

  const counts = FILTERS.reduce((acc,f)=>{ acc[f]=f==="all"?bookings.length:bookings.filter(b=>b.status===f).length; return acc; },{});
  const totalRevenue = filtered.reduce((s,b)=>s+(b.invoiceTotal??b.amount),0);
  const totalPaid    = filtered.reduce((s,b)=>s+(b.paymentHistory||[]).reduce((a,p)=>a+p.amount,0),0);
  const totalDue     = filtered.reduce((s,b)=>{ const inv=b.invoiceTotal??b.amount; const pd=(b.paymentHistory||[]).reduce((a,p)=>a+p.amount,0); return s+Math.max(0,inv-pd); },0);

  return (
    <div style={{ padding:"22px 24px", maxWidth:1200, margin:"0 auto" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800, fontFamily:"'Playfair Display',serif", color:"var(--navy)" }}>Invoices</div>
          <div style={{ fontSize:12, color:"var(--text3)" }}>{bookings.length} total invoices</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {selected.length>0 && (
            <button className="btn danger sm" onClick={deleteSelected}><i className="ti ti-trash" /> Delete ({selected.length})</button>
          )}
          <button className="btn sm" onClick={downloadSelected}><i className="ti ti-download" /> {selected.length>0?"Download Selected":"Download All"}</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:18 }}>
        {[
          { label:"Total Invoiced", value:money(totalRevenue), icon:"ti-receipt", color:"var(--navy)" },
          { label:"Total Collected", value:money(totalPaid),   icon:"ti-circle-check", color:"var(--green)" },
          { label:"Outstanding",    value:money(totalDue),     icon:"ti-alert-circle", color:totalDue>0?"var(--red)":"var(--green)" },
        ].map(m=>(
          <div key={m.label} className="panel" style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:40, height:40, borderRadius:10, background:m.color+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <i className={"ti "+m.icon} style={{ fontSize:20, color:m.color }} />
            </div>
            <div><div style={{ fontSize:11, color:"var(--text3)" }}>{m.label}</div><div style={{ fontSize:17, fontWeight:800, color:m.color }}>{m.value}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {FILTERS.map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"6px 14px", borderRadius:20, border:"1.5px solid", cursor:"pointer", fontSize:12, fontWeight:700, transition:"all .15s",
            background:filter===f?"var(--navy)":"transparent", color:filter===f?"#fff":"var(--text3)", borderColor:filter===f?"var(--navy)":"var(--border)",
          }}>{f==="all"?"All":f.replace("-"," ")} <span style={{ fontSize:10, opacity:.7 }}>({counts[f]})</span></button>
        ))}
      </div>

      <div style={{ position:"relative", marginBottom:14 }}>
        <i className="ti ti-search" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"var(--text3)", fontSize:14 }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search guest, phone, room, invoice #..." style={{ paddingLeft:32, width:"100%", boxSizing:"border-box" }} />
      </div>

      <div className="panel" style={{ padding:0, overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
          <thead>
            <tr style={{ background:"var(--navy2)", color:"var(--gold)" }}>
              <th style={{ padding:"9px 12px", width:36 }}>
                <input type="checkbox" checked={selected.length===filtered.length&&filtered.length>0} onChange={toggleAll} />
              </th>
              {[["id","#",55],["guest","Guest",160],["room","Room",65],["checkin","Check-in",100],["checkout","Check-out",100],["nights","Nts",45],["amount","Amount",110],["status","Status",120],[null,"Actions",110]].map(([k,l,w])=>(
                <th key={l} style={{ padding:"9px 12px", textAlign:"left", fontSize:10, textTransform:"uppercase", letterSpacing:.5, width:w, whiteSpace:"nowrap", cursor:k?"pointer":"default" }}
                  onClick={()=>k&&toggleSort(k)}>
                  {l} {k&&<SortIcon k={k} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0&&<tr><td colSpan={10} style={{ textAlign:"center", padding:28, color:"var(--text3)" }}>No invoices found</td></tr>}
            {filtered.map((b,i)=>{
              const inv  = b.invoiceTotal!=null?b.invoiceTotal:b.amount;
              const paid = (b.paymentHistory||[]).reduce((s,p)=>s+p.amount,0);
              const bal  = Math.max(0,inv-paid);
              return (
                <tr key={b.id} style={{ borderBottom:"1px solid var(--border)", background:selected.includes(b.id)?"#fffbee":i%2===0?"":"var(--panel-alt)" }}>
                  <td style={{ padding:"10px 12px" }}><input type="checkbox" checked={selected.includes(b.id)} onChange={()=>toggleSelect(b.id)} onClick={e=>e.stopPropagation()} /></td>
                  <td style={{ padding:"10px 12px", fontWeight:700, color:"var(--text3)", fontSize:12, cursor:"pointer" }} onClick={()=>setViewBk(b)}>#{b.id}</td>
                  <td style={{ padding:"10px 12px", cursor:"pointer" }} onClick={()=>setViewBk(b)}><div style={{ fontWeight:700 }}>{b.guest}</div><div style={{ fontSize:11, color:"var(--text3)" }}>{b.phone}</div></td>
                  <td style={{ padding:"10px 12px" }}><strong>Rm {b.room}</strong></td>
                  <td style={{ padding:"10px 12px" }}>{b.checkin}</td>
                  <td style={{ padding:"10px 12px" }}>{b.checkout}</td>
                  <td style={{ padding:"10px 12px", textAlign:"center" }}>{b.nights}</td>
                  <td style={{ padding:"10px 12px" }}><div style={{ fontWeight:700 }}>{money(inv)}</div>{bal>0&&<div style={{ fontSize:10, color:"var(--red)", fontWeight:600 }}>Due: {money(bal)}</div>}{bal<=0&&inv>0&&<div style={{ fontSize:10, color:"var(--green)" }}>Paid</div>}</td>
                  <td style={{ padding:"10px 12px" }}><Badge status={b.status} /></td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <button className="btn sm" style={{ fontSize:10 }} onClick={()=>setViewBk(b)}><i className="ti ti-eye" /></button>
                      {bal>0&&!["cancelled"].includes(b.status)&&<button className="btn sm primary" style={{ fontSize:10 }} onClick={()=>setPayBk(b)}><i className="ti ti-credit-card" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display:"flex", gap:14, marginTop:12, fontSize:12, color:"var(--text3)", flexWrap:"wrap" }}>
        <span><i className="ti ti-list" /> Showing {filtered.length} of {bookings.length}</span>
        {selected.length>0&&<span style={{ color:"var(--gold2)", fontWeight:700 }}>{selected.length} selected</span>}
      </div>

      {pwModal && (
        <div className="modal-overlay open" onClick={e=>e.target===e.currentTarget&&(setPwModal(false),setPwInput(""))}>
          <div className="modal-box" style={{ maxWidth:360 }}>
            <div className="modal-header">
              <div className="modal-title"><i className="ti ti-lock" style={{ color:"var(--red)" }} /> Confirm Delete</div>
              <button className="modal-close" onClick={()=>{setPwModal(false);setPwInput("");}}><i className="ti ti-x" /></button>
            </div>
            <p style={{ fontSize:13, color:"var(--text2)", marginBottom:14 }}>
              You are about to permanently delete <strong>{selected.length} invoice(s)</strong> and all linked revenue entries. Enter admin password to confirm.
            </p>
            <div className="form-group"><label>Admin Password</label><input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmDelete()} autoFocus /></div>
            <div className="modal-actions">
              <button className="btn" onClick={()=>{setPwModal(false);setPwInput("");}}>Cancel</button>
              <button className="btn danger" onClick={confirmDelete}><i className="ti ti-trash" /> Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      {viewBk && <InvoiceView booking={bookings.find(b=>b.id===viewBk.id)||viewBk} onClose={()=>setViewBk(null)} onPay={b=>{setViewBk(null);setPayBk(b);}} />}
      {payBk  && <PaymentModal booking={bookings.find(b=>b.id===payBk.id)||payBk}  onClose={()=>setPayBk(null)} />}
    </div>
  );
}
`;

fs.writeFileSync(path, code, 'utf8');
console.log('OK size=' + fs.statSync(path).size);
