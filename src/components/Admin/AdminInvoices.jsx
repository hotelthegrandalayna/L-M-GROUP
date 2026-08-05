import { useState, useMemo, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { checkAdminPassword } from "../../utils/auth";
import { deleteHotelBooking, deleteHotelBookings, loadHotelGuestImages, persistHotelBookingBundle } from "../../lib/hotelSupabase";
import { logEvent } from "../../utils/auditLog";

const STATUS_OPTS = ["All", "checked-in", "reserved", "checked-out", "cancelled"];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtMoney(n) { return "৳" + Number(n || 0).toLocaleString(); }

// Use whichever is higher: paymentHistory total OR advance field
// This handles old bookings where advance was set directly without a history entry
function calcPaid(bk) {
  const hist = Array.isArray(bk.paymentHistory) ? bk.paymentHistory : [];
  const fromHistory = hist.reduce((s, p) => s + (p.amount || 0), 0);
  const fromAdvance = (parseFloat(bk.advance) || 0) + (parseFloat(bk.restPayment) || 0) + (parseFloat(bk.extrasAdvance) || 0);
  return Math.max(fromHistory, fromAdvance);
}
function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  return new Date(+y, +m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
function getBookingMonth(bk) { return (bk.checkin || bk.createdAt || "").slice(0, 7); }

// ── Excel export via SpreadsheetML XML (guaranteed proper columns in Excel) ──
function exportExcel(rows, filename) {
  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/\r?\n/g, " ");
  }
  function numCell(v) { return `<Cell><Data ss:Type="Number">${Number(v) || 0}</Data></Cell>`; }
  function strCell(v) { return `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`; }
  function hdrCell(v) { return `<Cell ss:StyleID="h"><Data ss:Type="String">${esc(v)}</Data></Cell>`; }

  const headers = [
    "Booking ID","Guest Name","Phone","Room No.","Check-in","Check-out",
    "Nights","Status","Invoice Total","Total Paid","Balance Due",
    "Advance","Discount","ID / NID Number","Referrer","Purpose","Notes","Created At",
  ];

  const dataRows = rows.map(bk => {
    const paid  = calcPaid(bk);
    const total = bk.invoiceTotal ?? bk.amount ?? 0;
    return `<Row>
      ${strCell(bk.id)}${strCell(bk.guest)}${strCell(bk.phone)}${strCell(bk.room)}
      ${strCell(bk.checkin)}${strCell(bk.checkout)}${numCell(bk.nights)}${strCell(bk.status)}
      ${numCell(total)}${numCell(paid)}${numCell(Math.max(0, total - paid))}
      ${numCell(bk.advance || 0)}${numCell(bk.discAmt || 0)}
      ${strCell(bk.idDocs?.[0]?.idNum || bk.idNum || "")}
      ${strCell(bk.referrer || "")}${strCell(bk.purpose || "")}${strCell(bk.notes || "")}
      ${strCell(bk.createdAt || "")}
    </Row>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="h">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2D1B69" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Invoices">
    <Table>
      <Row>${headers.map(hdrCell).join("")}</Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename + ".xls"; a.click();
  URL.revokeObjectURL(url);
}

// ── PDF export via print window ───────────────────────────────────────────────
function exportPDF(rows, label) {
  const fmtM = n => "BDT " + Number(n || 0).toLocaleString();
  const rowsHtml = rows.map(bk => {
    const paid  = calcPaid(bk);
    const total = bk.invoiceTotal ?? bk.amount ?? 0;
    const bal   = Math.max(0, total - paid);
    return `<tr>
      <td>${bk.id}</td><td>${bk.guest || "—"}</td><td>${bk.phone || "—"}</td>
      <td>${bk.room}</td><td>${fmtDate(bk.checkin)}</td><td>${fmtDate(bk.checkout)}</td>
      <td style="text-align:center">${bk.nights || "—"}</td>
      <td style="text-align:center">${bk.status || "—"}</td>
      <td style="text-align:right">${fmtM(total)}</td>
      <td style="text-align:right;color:#065f46">${fmtM(paid)}</td>
      <td style="text-align:right;color:${bal > 0 ? "#991b1b" : "#065f46"}">${fmtM(bal)}</td>
    </tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Invoices — ${label}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
    h2 { font-size: 15px; margin-bottom: 4px; }
    p  { font-size: 11px; color: #555; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #2D1B69; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; white-space: nowrap; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; vertical-align: top; }
    tr:nth-child(even) td { background: #f8f7ff; }
    @media print { body { margin: 10px; } }
  </style></head><body>
  <h2>Invoice Report — ${label}</h2>
  <p>Generated: ${new Date().toLocaleString("en-GB")} &nbsp;·&nbsp; ${rows.length} record(s)</p>
  <table>
    <thead><tr>
      <th>Booking ID</th><th>Guest</th><th>Phone</th><th>Room</th>
      <th>Check-in</th><th>Check-out</th><th>Nights</th><th>Status</th>
      <th>Total</th><th>Paid</th><th>Balance</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload=()=>{ window.print(); }<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
}

// ── Invoice detail modal ──────────────────────────────────────────────────────
function InvoiceDetail({ bk, onClose }) {
  const { curRole, curUser, updateBookings, notify } = useApp();
  // Use the shared calcPaid so this modal matches the list, the summary,
  // the invoice and the rest of the app (advance + restPayment counts as
  // paid, not only paymentHistory entries).
  const paid    = calcPaid(bk);
  const total   = bk.invoiceTotal ?? bk.amount ?? 0;
  const balance = Math.max(0, total - paid);

  // ── Full edit (admin only) ──────────────────────────────────────────────
  const canEdit = curRole === "admin";
  const [editing, setEditing] = useState(false);
  const [ed, setEd] = useState(null);        // edit field values
  const [pwOpen, setPwOpen] = useState(false); // password confirm before saving
  const [savePw, setSavePw] = useState("");
  const setF = (k, v) => setEd(p => ({ ...p, [k]: v }));

  function startEdit() {
    setEd({
      guest: bk.guest || "", phone: bk.phone || "", room: String(bk.room || ""),
      checkin: bk.checkin || "", checkout: bk.checkout || "",
      status: bk.status || "confirmed",
      total: bk.invoiceTotal ?? bk.amount ?? 0,
      disc: bk.discAmt || 0,
      paid: calcPaid(bk),
      idNum: bk.idDocs?.[0]?.idNum || bk.idNum || "",
      referrer: bk.referrer || "", purpose: bk.purpose || "", notes: bk.notes || "",
    });
    setEditing(true);
  }

  const edNights = (() => {
    if (!ed?.checkin || !ed?.checkout) return bk.nights || 0;
    const n = Math.round((new Date(ed.checkout + "T00:00:00") - new Date(ed.checkin + "T00:00:00")) / 86400000);
    return n > 0 ? n : 0;
  })();

  function commitSave() {
    if (!checkAdminPassword(savePw)) { notify("Incorrect admin password", "error"); return; }
    const newTotal = parseFloat(ed.total) || 0;
    const newPaid  = parseFloat(ed.paid)  || 0;
    const origPaid = calcPaid(bk);
    let advance = bk.advance, restPayment = bk.restPayment, paymentHistory = bk.paymentHistory;
    if (newPaid !== origPaid) {
      // Make the admin-entered paid amount authoritative
      paymentHistory = newPaid > 0
        ? [{ ts: new Date().toISOString(), amount: newPaid, method: bk.paymentMethod || "Cash", note: "Adjusted by admin", type: "room", by: curUser || "admin" }]
        : [];
      advance = newPaid; restPayment = 0;
    }
    let idDocs = bk.idDocs;
    if (idDocs && idDocs.length && ed.idNum !== (bk.idDocs?.[0]?.idNum || "")) {
      idDocs = idDocs.map((d, i) => i === 0 ? { ...d, idNum: ed.idNum } : d);
    }
    const updated = {
      ...bk,
      guest: ed.guest.trim(), phone: ed.phone.trim(), room: ed.room.trim(),
      checkin: ed.checkin, checkout: ed.checkout, nights: edNights || bk.nights,
      status: ed.status,
      invoiceTotal: newTotal, amount: newTotal,
      discAmt: parseFloat(ed.disc) || 0,
      advance, restPayment, paymentHistory,
      dueAmount: Math.max(0, newTotal - newPaid),
      idNum: ed.idNum, idDocs,
      referrer: ed.referrer.trim(), purpose: ed.purpose.trim(), notes: ed.notes.trim(),
      editedAt: new Date().toISOString(), editedBy: curUser || "admin",
    };
    // Update ONLY the exact invoice that was opened. Matching by id alone would
    // overwrite any other booking that happens to share the same id (legacy
    // data can have id collisions) — so prefer object-reference identity, and
    // fall back to the first id match only if the reference was replaced.
    updateBookings(prev => {
      if (prev.some(b => b === bk)) return prev.map(b => b === bk ? updated : b);
      let done = false;
      return prev.map(b => (!done && b.id === bk.id) ? (done = true, updated) : b);
    });
    void persistHotelBookingBundle(updated).catch(err => {
      console.error("Invoice edit sync failed:", err);
      notify("Saved locally, but cloud sync failed — will retry", "error");
    });
    logEvent("hotel", "invoice_edited", { num: String(bk.id), guest: updated.guest, amount: newTotal, note: `Rm ${updated.room} · full edit by admin` }, curUser);
    notify("Invoice updated", "success");
    setPwOpen(false); setSavePw(""); setEditing(false);
    onClose();
  }

  // ID photos are no longer downloaded on every sync (keeps sync fast). Fetch
  // this booking's photos on demand, only now that its details are open.
  const [fetchedImgs, setFetchedImgs] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const hasLocalImages = (bk.idDocs || []).length > 0 || bk.idFront || bk.idBack;

  useEffect(() => {
    let alive = true;
    const gid = bk.guest_id ?? bk.guestId;
    if (hasLocalImages || !gid) return;
    setImgLoading(true);
    loadHotelGuestImages(gid).then(res => {
      if (alive) { setFetchedImgs(res); setImgLoading(false); }
    }).catch(() => { if (alive) setImgLoading(false); });
    return () => { alive = false; };
  }, [bk.guest_id, bk.guestId, hasLocalImages]);

  // Normalise documents into per-person groups (local images, or fetched ones)
  const persons = useMemo(() => {
    const src = hasLocalImages ? bk : { ...bk, ...(fetchedImgs || {}) };
    const list = [];
    if ((src.idDocs || []).length > 0) {
      src.idDocs.forEach((doc, i) => list.push({
        label: `Guest ${i + 1}`,
        idNum: doc.idNum || "",
        images: [
          ...((doc.front || []).map(img => ({ img, side: "Front" }))),
          ...((doc.back  || []).map(img => ({ img, side: "Back"  }))),
        ],
      }));
    } else {
      const imgs = [];
      if (src.idFront) imgs.push({ img: src.idFront, side: "Front" });
      if (src.idBack)  imgs.push({ img: src.idBack,  side: "Back"  });
      if (imgs.length) list.push({ label: "Guest 1", idNum: src.idNum || "", images: imgs });
    }
    return list;
  }, [bk, fetchedImgs, hasLocalImages]);

  const statusColor = {
    "checked-out": { bg: "#d1fae5", color: "#065f46" },
    "checked-in":  { bg: "#dbeafe", color: "#1e3a8a" },
    "cancelled":   { bg: "#fee2e2", color: "#991b1b" },
  }[bk.status] || { bg: "#fef3c7", color: "#92400e" };

  return (
    <div className="modal-overlay open" onClick={ev => ev.target === ev.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 740, maxHeight: "90vh", overflowY: "auto", padding: 0 }}>

        <div style={{ background: "var(--navy)", color: "#fff", padding: "16px 20px", borderRadius: "10px 10px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Booking #{bk.id}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{bk.guest} · Room {bk.room}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {canEdit && !editing && (
              <button onClick={startEdit} style={{ background: "var(--gold)", border: "none", color: "#1a1a2e", fontSize: 13, fontWeight: 800, cursor: "pointer", padding: "7px 14px", borderRadius: 8 }}>
                <i className="ti ti-edit" style={{ marginRight: 5 }} />Edit Invoice
              </button>
            )}
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: 20, cursor: "pointer" }}>✕</button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {editing ? (() => {
            const inp = { padding: "8px 10px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", width: "100%", boxSizing: "border-box" };
            const lbl = { fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4, display: "block" };
            const newTotal = parseFloat(ed.total) || 0, newPaid = parseFloat(ed.paid) || 0;
            // NOTE: build fields as plain inlined JSX (a function call, not a
            // <Component/>). Defining a component inside render remounts the
            // input on every keystroke and steals focus — this avoids that.
            const F = (label, k, type = "text") => (
              <div key={k}><label style={lbl}>{label}</label>
                <input type={type} value={ed[k]} onWheel={type === "number" ? e => e.target.blur() : undefined}
                  onChange={e => setF(k, e.target.value)} style={inp} /></div>
            );
            return (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--navy)", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <i className="ti ti-edit" style={{ color: "var(--gold)" }} /> Editing Invoice #{bk.id} — admin
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px,1fr))", gap: 12, marginBottom: 12 }}>
                  {F("Guest Name", "guest")}
                  {F("Phone", "phone")}
                  {F("Room No.", "room")}
                  <div><label style={lbl}>Status</label>
                    <select value={ed.status} onChange={e => setF("status", e.target.value)} style={inp}>
                      <option value="confirmed">Reserved (confirmed)</option>
                      <option value="checked-in">Checked-in</option>
                      <option value="checked-out">Checked-out</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  {F("Check-in", "checkin", "date")}
                  {F("Check-out", "checkout", "date")}
                  <div><label style={lbl}>Nights</label>
                    <input value={edNights} readOnly style={{ ...inp, background: "var(--bg4)", fontWeight: 700 }} /></div>
                  {F("Invoice Total (৳)", "total", "number")}
                  {F("Discount (৳)", "disc", "number")}
                  {F("Amount Paid (৳)", "paid", "number")}
                  {F("ID / NID Number", "idNum")}
                  {F("Referrer", "referrer")}
                  {F("Purpose", "purpose")}
                </div>
                <div><label style={lbl}>Notes</label>
                  <textarea value={ed.notes} onChange={e => setF("notes", e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} /></div>
                <div style={{ display: "flex", gap: 16, marginTop: 12, padding: "10px 14px", background: "var(--bg4)", borderRadius: 8, fontSize: 13 }}>
                  <span>Total <strong>{fmtMoney(newTotal)}</strong></span>
                  <span style={{ color: "#065f46" }}>Paid <strong>{fmtMoney(newPaid)}</strong></span>
                  <span style={{ color: newTotal - newPaid > 0 ? "#991b1b" : "#065f46" }}>Balance <strong>{fmtMoney(Math.max(0, newTotal - newPaid))}</strong></span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                  <button onClick={() => { setEditing(false); setEd(null); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1.5px solid var(--border)", background: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                  <button onClick={() => { setSavePw(""); setPwOpen(true); }} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "#1a7040", color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                    <i className="ti ti-device-floppy" style={{ marginRight: 5 }} />Save Changes
                  </button>
                </div>
              </div>
            );
          })() : (<>
          <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 16, ...statusColor }}>
            {(bk.status || "reserved").toUpperCase()}
          </span>

          {/* Guest & room */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: 10, marginBottom: 16 }}>
            {[
              ["Guest",     bk.guest],
              ["Phone",     bk.phone    || "—"],
              ["Room",      bk.room],
              ["Check-in",  fmtDate(bk.checkin)],
              ["Check-out", fmtDate(bk.checkout)],
              ["Nights",    bk.nights],
              ["Referrer",  bk.referrer || "—"],
              ["Purpose",   bk.purpose  || "—"],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ background: "var(--bg4)", borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", marginBottom: 3 }}>{lbl}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Financials */}
          <div style={{ background: "var(--bg4)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--navy)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>Financial Summary</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))", gap: 10 }}>
              {[
                ["Total",   fmtMoney(total),      "#1e3a8a"],
                ["Paid",    fmtMoney(paid),        "#065f46"],
                ["Balance", fmtMoney(balance),     balance > 0 ? "#991b1b" : "#065f46"],
                ["Advance", fmtMoney(bk.advance),  "#6b4a00"],
                ...(bk.discAmt > 0 ? [["Discount", fmtMoney(bk.discAmt), "#7c3aed"]] : []),
              ].map(([lbl, val, col]) => (
                <div key={lbl} style={{ textAlign: "center", padding: "8px 0" }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>{lbl}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: col }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
          </>)}

          {/* Payment history */}
          {(bk.paymentHistory || []).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--navy)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Payment History</div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", background: "var(--navy)", color: "#fff", padding: "8px 12px", fontSize: 11, fontWeight: 700 }}>
                  <span>Date</span><span>Amount</span><span>Note</span>
                </div>
                {bk.paymentHistory.map((p, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", padding: "8px 12px", fontSize: 12, borderBottom: i < bk.paymentHistory.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <span>{fmtDate(p.date || p.ts)}</span>
                    <span style={{ fontWeight: 700, color: "var(--green)" }}>{fmtMoney(p.amount)}</span>
                    <span style={{ color: "var(--text3)" }}>{p.note || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ID photos loading on demand */}
          {imgLoading && persons.length === 0 && (
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--bg4)", borderRadius: 8, fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 8 }}>
              <i className="ti ti-loader ti-spin" /> Loading ID photos from cloud…
            </div>
          )}

          {/* Documents — one card per person */}
          {persons.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--navy)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                ID Documents ({persons.length} person{persons.length > 1 ? "s" : ""})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {persons.map((person, pi) => (
                  <div key={pi} style={{ border: "1.5px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ background: "var(--navy)", color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <i className="ti ti-user" style={{ fontSize: 15, color: "var(--gold)" }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{person.label}</div>
                        {person.idNum && <div style={{ fontSize: 11, opacity: 0.75 }}>ID / NID: {person.idNum}</div>}
                      </div>
                    </div>
                    <div style={{ padding: 12, display: "flex", flexWrap: "wrap", gap: 12, background: "var(--bg4)" }}>
                      {person.images.length === 0 && (
                        <div style={{ fontSize: 12, color: "var(--text3)" }}>No photos uploaded.</div>
                      )}
                      {person.images.map((item, ii) => (
                        <div key={ii} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                            {item.side}
                          </div>
                          <img src={item.img} alt={`${person.label} ${item.side}`}
                            onClick={() => setZoomImg(item.img)}
                            style={{ maxWidth: 170, maxHeight: 115, borderRadius: 8, border: "1.5px solid var(--border)", objectFit: "cover", cursor: "pointer", display: "block" }} />
                          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>Click to enlarge</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {bk.notes && (
            <div style={{ background: "#fffbee", border: "1.5px solid var(--gold)", borderRadius: 8, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b4a00", marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 13 }}>{bk.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Full-screen photo viewer (data-URL images can't open in a new tab) */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
          <img src={zoomImg} alt="ID document" style={{ maxWidth: "95%", maxHeight: "95%", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,.6)" }} />
          <button onClick={() => setZoomImg(null)}
            style={{ position: "fixed", top: 18, right: 22, background: "rgba(255,255,255,.15)", border: "1.5px solid rgba(255,255,255,.4)", color: "#fff", fontSize: 22, width: 44, height: 44, borderRadius: "50%", cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Admin password confirm before saving edits */}
      {pwOpen && (
        <div className="modal-overlay open" style={{ zIndex: 100001 }} onClick={ev => ev.target === ev.currentTarget && setPwOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">🔒 Confirm Invoice Changes</div>
              <button className="modal-close" onClick={() => setPwOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0 14px" }}>
              You are editing the invoice for <strong>{bk.guest}</strong> (Rm {bk.room}). Enter the admin password to save these changes.
            </p>
            <div className="form-group">
              <label>Admin Password</label>
              <input type="password" value={savePw} onChange={e => setSavePw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && commitSave()} autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPwOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={commitSave} style={{ background: "#1a7040", borderColor: "#1a7040" }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminInvoices() {
  const { bookings, updateBookings, notify, ensureMonthLoaded, loadingMonths } = useApp();

  const [search,         setSearch]         = useState("");
  const [filterMonth,    setFilterMonth]    = useState("");
  const [filterStatus,   setFilterStatus]   = useState("All");
  const [filterRoom,     setFilterRoom]     = useState("");
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [detail,         setDetail]         = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null); // single invoice
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false); // bulk delete modal
  const [delPw,          setDelPw]          = useState("");

  const allMonths = useMemo(() => {
    const set = new Set(bookings.map(getBookingMonth).filter(Boolean));
    // Always offer the last 24 months so any past month is selectable and can
    // be pulled from the cloud on demand, even before its invoices are loaded.
    const d = new Date();
    for (let i = 0; i < 24; i++) { set.add(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')); d.setMonth(d.getMonth()-1); }
    return [...set].sort().reverse();
  }, [bookings]);

  // When a past month is selected, fetch that whole month's invoices from the cloud
  useEffect(() => { if (filterMonth) ensureMonthLoaded(filterMonth); }, [filterMonth, ensureMonthLoaded]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bookings.filter(bk => {
      if (filterStatus !== "All" && bk.status !== filterStatus) return false;
      if (filterMonth && getBookingMonth(bk) !== filterMonth) return false;
      if (filterRoom && !String(bk.room || "").toLowerCase().includes(filterRoom.toLowerCase())) return false;
      if (q && !(
        String(bk.guest || "").toLowerCase().includes(q) ||
        String(bk.id    ?? "").toLowerCase().includes(q) ||
        String(bk.phone || "").toLowerCase().includes(q) ||
        String(bk.room  || "").toLowerCase().includes(q)
      )) return false;
      return true;
    }).sort((a, b) => (b.checkin || b.createdAt || "") > (a.checkin || a.createdAt || "") ? 1 : -1);
  }, [bookings, search, filterStatus, filterMonth, filterRoom]);

  const totals = useMemo(() => {
    const rows = selectedIds.size > 0 ? filtered.filter(b => selectedIds.has(b.id)) : filtered;
    const paid  = rows.reduce((s, bk) => s + calcPaid(bk), 0);
    const total = rows.reduce((s, bk) => s + (bk.invoiceTotal ?? bk.amount ?? 0), 0);
    return { total, paid, balance: Math.max(0, total - paid) };
  }, [filtered, selectedIds]);

  const selCount   = filtered.filter(b => selectedIds.has(b.id)).length;
  const allChecked = filtered.length > 0 && filtered.every(b => selectedIds.has(b.id));
  const someChecked = filtered.some(b => selectedIds.has(b.id));

  function toggleAll() {
    if (allChecked) {
      setSelectedIds(prev => { const n = new Set(prev); filtered.forEach(b => n.delete(b.id)); return n; });
    } else {
      setSelectedIds(prev => { const n = new Set(prev); filtered.forEach(b => n.add(b.id)); return n; });
    }
  }
  function toggleOne(id) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function getDownloadRows() {
    if (selCount > 0) return filtered.filter(b => selectedIds.has(b.id));
    if (selectedMonths.length > 0) return bookings.filter(bk => selectedMonths.includes(getBookingMonth(bk)));
    return filtered;
  }

  function doExcel() {
    const rows = getDownloadRows();
    if (!rows.length) { notify("No invoices to export", "error"); return; }
    const label = selCount > 0 ? `selected-${rows.length}` : selectedMonths.length > 0 ? selectedMonths.join("_") : "all";
    exportExcel(rows, `invoices-${label}`);
    notify(`Downloaded ${rows.length} invoice${rows.length > 1 ? "s" : ""} as Excel/CSV`, "success");
  }

  function doPDF() {
    const rows = getDownloadRows();
    if (!rows.length) { notify("No invoices to export", "error"); return; }
    const label = selCount > 0 ? `${rows.length} selected` : selectedMonths.length > 0 ? selectedMonths.map(monthLabel).join(", ") : "All";
    exportPDF(rows, label);
  }

  function toggleMonth(m) {
    setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  }

  function confirmDelete() {
    if (!checkAdminPassword(delPw)) { notify("Incorrect admin password", "error"); return; }
    const target = deleteTarget;
    updateBookings(prev => prev.filter(b => b.id !== target.id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(target.id); return n; });
    notify("Invoice deleted", "success");
    setDeleteTarget(null); setDelPw("");
    if (detail?.id === target.id) setDetail(null);
    const sbId = target.supabaseBookingId ?? target.bookingDbId ?? target.id;
    // Record deleted ID locally so it's never restored from Supabase on reload
    try {
      const ids = JSON.parse(localStorage.getItem('ga_deleted_booking_ids') || '[]');
      ids.push(String(sbId), String(target.id));
      localStorage.setItem('ga_deleted_booking_ids', JSON.stringify([...new Set(ids)]));
    } catch {}
    void deleteHotelBooking(sbId, target.guest_id).catch(err => console.error("Supabase delete failed:", err));
  }

  function confirmBulkDelete() {
    if (!checkAdminPassword(delPw)) { notify("Incorrect admin password", "error"); return; }
    const toDelete = filtered.filter(b => selectedIds.has(b.id));
    const ids = new Set(toDelete.map(b => b.id));
    updateBookings(prev => prev.filter(b => !ids.has(b.id)));
    setSelectedIds(new Set());
    if (detail && ids.has(detail.id)) setDetail(null);
    notify(`Deleted ${ids.size} invoice${ids.size > 1 ? "s" : ""}`, "success");
    setBulkDeleteOpen(false); setDelPw("");
    const sbIds = toDelete.map(b => b.supabaseBookingId ?? b.bookingDbId ?? b.id).filter(Boolean);
    const localIds = toDelete.map(b => b.id).filter(Boolean);
    // Record all deleted IDs so they're never restored from Supabase on reload
    try {
      const existing = JSON.parse(localStorage.getItem('ga_deleted_booking_ids') || '[]');
      const merged = [...new Set([...existing, ...sbIds.map(String), ...localIds.map(String)])];
      localStorage.setItem('ga_deleted_booking_ids', JSON.stringify(merged));
    } catch {}
    const guestIds = toDelete.map(b => b.guest_id).filter(Boolean);
    void deleteHotelBookings(sbIds, guestIds).catch(err => console.error("Supabase bulk delete failed:", err));
  }

  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)", marginBottom: 4 }}>
        <i className="ti ti-file-invoice" style={{ color: "var(--gold)", marginRight: 8 }} />All Invoices
      </div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 18 }}>
        Click any row to view full details including ID documents. Use checkboxes to select — then download or delete selected. Select all with the header checkbox.
      </div>

      {/* Filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px,1fr))", gap: 10, marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest, ID, phone, room…"
          style={{ padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", gridColumn: "span 2", minWidth: 0 }} />
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          style={{ padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
          <option value="">All months</option>
          {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }}>
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <input value={filterRoom} onChange={e => setFilterRoom(e.target.value)} placeholder="Room no."
          style={{ padding: "9px 12px", border: "1.5px solid var(--border)", borderRadius: 8, fontSize: 13, fontFamily: "inherit" }} />
      </div>

      {/* Loading a past month from the cloud */}
      {filterMonth && loadingMonths[filterMonth] && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: "9px 14px", background: "#eef6ff", border: "1.5px solid #90c2f0", borderRadius: 9, fontSize: 12.5, color: "#1a4a7a", fontWeight: 600 }}>
          <i className="ti ti-loader ti-spin" /> Loading {monthLabel(filterMonth)} invoices from cloud…
        </div>
      )}

      {/* Summary bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, padding: "12px 16px", background: "var(--bg4)", borderRadius: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>
          <strong>{filtered.length}</strong> invoice{filtered.length !== 1 ? "s" : ""}
          {selCount > 0 && <> · <strong style={{ color: "var(--navy)" }}>{selCount} selected</strong></>}
        </span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>·</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)" }}>Total: {fmtMoney(totals.total)}</span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>·</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}>Collected: {fmtMoney(totals.paid)}</span>
        <span style={{ fontSize: 12, color: "var(--text3)" }}>·</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: totals.balance > 0 ? "#991b1b" : "#065f46" }}>Due: {fmtMoney(totals.balance)}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={doPDF} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#2D1B69", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <i className="ti ti-file-type-pdf" /> PDF{selCount > 0 ? ` (${selCount})` : ""}
          </button>
          <button onClick={doExcel} style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#1a6b3c", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <i className="ti ti-file-spreadsheet" /> Excel{selCount > 0 ? ` (${selCount})` : ""}
          </button>
          {selCount > 0 && (
            <button onClick={() => { setBulkDeleteOpen(true); setDelPw(""); }}
              style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: "#c0392b", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🗑 Delete selected ({selCount})
            </button>
          )}
          {selCount > 0 && (
            <button onClick={() => setSelectedIds(new Set())}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid var(--border)", background: "#fff", color: "var(--text3)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              ✕ Deselect all
            </button>
          )}
        </div>
      </div>

      {/* Month picker — only shown when no rows selected */}
      {selCount === 0 && (
        <div style={{ border: "1.5px solid var(--gold)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, background: "#fffbee" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#6b4a00", marginBottom: 8 }}>
            <i className="ti ti-calendar-month" style={{ marginRight: 6 }} />
            Export by month — select months below, or leave blank to export all filtered results
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            {allMonths.map(m => (
              <button key={m} onClick={() => toggleMonth(m)} style={{
                padding: "4px 12px", borderRadius: 20, border: "1.5px solid",
                borderColor: selectedMonths.includes(m) ? "var(--gold2)" : "var(--border)",
                background: selectedMonths.includes(m) ? "var(--gold)" : "#fff",
                color: selectedMonths.includes(m) ? "#fff" : "var(--text3)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{monthLabel(m)}</button>
            ))}
            {!allMonths.length && <span style={{ fontSize: 12, color: "var(--text3)" }}>No invoices yet.</span>}
            {selectedMonths.length > 0 && (
              <button onClick={() => setSelectedMonths([])} style={{ fontSize: 12, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>✕ Clear</button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 1.2fr 60px 100px 100px 80px 80px", gap: 6, background: "var(--navy)", color: "#f0e8ff", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5, padding: "9px 12px", alignItems: "center" }}>
          <input type="checkbox" checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
            onChange={toggleAll}
            style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--gold)" }} />
          <span>Guest</span>
          <span>Room / Dates</span>
          <span>Nights</span>
          <span>Total</span>
          <span>Paid</span>
          <span>Balance</span>
          <span>Delete</span>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No invoices match your search.</div>
        )}

        {filtered.map(bk => {
          const paid    = calcPaid(bk);
          const total   = bk.invoiceTotal ?? bk.amount ?? 0;
          const balance = Math.max(0, total - paid);
          const checked = selectedIds.has(bk.id);
          const sColor  = { "checked-out": "#065f46", "checked-in": "#1e3a8a", "cancelled": "#991b1b" }[bk.status] || "#92400e";
          const sBg     = { "checked-out": "#d1fae5", "checked-in": "#dbeafe", "cancelled": "#fee2e2"  }[bk.status] || "#fef3c7";

          return (
            <div key={bk.id}
              onClick={() => setDetail(bk)}
              style={{ display: "grid", gridTemplateColumns: "36px 1fr 1.2fr 60px 100px 100px 80px 80px", gap: 6, padding: "10px 12px", borderBottom: "1px solid var(--border)", fontSize: 12, alignItems: "center", cursor: "pointer", background: checked ? "rgba(45,27,105,.06)" : "", transition: "background .1s" }}
              onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--bg4)"; }}
              onMouseLeave={e => { if (!checked) e.currentTarget.style.background = ""; }}>

              <div onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={checked} onChange={() => toggleOne(bk.id)}
                  style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--navy)" }} />
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{bk.guest || "—"}</div>
                <div style={{ color: "var(--text3)", fontSize: 11 }}>{bk.phone || ""}</div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: sBg, color: sColor }}>
                  {bk.status || "reserved"}
                </span>
              </div>

              <div>
                <div style={{ fontWeight: 600 }}>Rm {bk.room}</div>
                <div style={{ color: "var(--text3)", fontSize: 11 }}>{fmtDate(bk.checkin)} → {fmtDate(bk.checkout)}</div>
                <div style={{ color: "var(--text3)", fontSize: 10 }}>#{bk.id}</div>
              </div>

              <div style={{ fontWeight: 600 }}>{bk.nights || "—"}</div>
              <div style={{ fontWeight: 700 }}>{fmtMoney(total)}</div>
              <div style={{ fontWeight: 700, color: "#065f46" }}>{fmtMoney(paid)}</div>
              <div style={{ fontWeight: 700, color: balance > 0 ? "#991b1b" : "#065f46" }}>{fmtMoney(balance)}</div>

              <div onClick={e => e.stopPropagation()}>
                <button onClick={() => { setDeleteTarget(bk); setDelPw(""); }} style={{
                  padding: "5px 9px", borderRadius: 6, border: "1.5px solid #fca5a5",
                  background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, cursor: "pointer",
                }}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal */}
      {detail && <InvoiceDetail bk={detail} onClose={() => setDetail(null)} />}

      {/* Bulk delete modal */}
      {bulkDeleteOpen && (
        <div className="modal-overlay open" onClick={ev => ev.target === ev.currentTarget && setBulkDeleteOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div className="modal-title">🗑 Delete {selCount} Invoice{selCount > 1 ? "s" : ""}</div>
              <button className="modal-close" onClick={() => setBulkDeleteOpen(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0 14px" }}>
              This will permanently delete <strong>{selCount} selected invoice{selCount > 1 ? "s" : ""}</strong>. This cannot be undone. Enter the admin password to confirm.
            </p>
            <div className="form-group">
              <label>Admin Password</label>
              <input type="password" value={delPw} onChange={e => setDelPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmBulkDelete()} autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setBulkDeleteOpen(false)}>Cancel</button>
              <button className="btn primary" onClick={confirmBulkDelete} style={{ background: "#c0392b", borderColor: "#c0392b" }}>
                Delete {selCount} Invoice{selCount > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single delete confirm modal */}
      {deleteTarget && (
        <div className="modal-overlay open" onClick={ev => ev.target === ev.currentTarget && setDeleteTarget(null)}>
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">🗑 Delete Invoice</div>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "4px 0 14px" }}>
              Permanently delete the invoice for <strong>{deleteTarget.guest}</strong> (Rm {deleteTarget.room}, {fmtDate(deleteTarget.checkin)})? This cannot be undone.
            </p>
            <div className="form-group">
              <label>Admin Password</label>
              <input type="password" value={delPw} onChange={e => setDelPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmDelete()} autoFocus />
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn primary" onClick={confirmDelete} style={{ background: "#c0392b", borderColor: "#c0392b" }}>Delete Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
