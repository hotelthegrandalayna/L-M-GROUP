import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp, gaRecordDeleted } from "../../context/AppContext";
import { checkAdminPassword } from "../../utils/auth";
import { deleteHotelBooking, deleteHotelBookings, loadHotelGuestImages, persistHotelBookingBundle, loadHotelBookingsForRange } from "../../lib/hotelSupabase";
import { useMonthBookings, bookingMonthlyParts } from "../../lib/hotelMoney";
import { allRoomNumbers, roomLabel, buildInvoiceHTML, buildTCHtml, hotelPrint } from "../Invoice";
import { filterInvoices } from "../../lib/invoiceFilter";
import { logEvent } from "../../utils/auditLog";

const STATUS_OPTS = ["All", "checked-in", "reserved", "checked-out", "cancelled"];

// Shared column widths so the header and the rows can never drift apart
const INV_COLS = "30px 92px 1.5fr 1.1fr 1.2fr 90px 90px 250px";

// Quiet outlined row-action button, matching the front-desk system
function invBtn(danger) {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 9px", borderRadius: 7, cursor: "pointer",
    fontSize: 11, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap",
    border: "1px solid " + (danger ? "#e0b3b0" : "var(--border)"),
    background: danger ? "#fdf4f3" : "var(--bg2)",
    color: danger ? "#8f2323" : "var(--text2)",
  };
}

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
// ── Customer invoice view ────────────────────────────────────────────────────
// The invoice exactly as the guest receives it, with Print and Print + T&C.
function InvoiceViewModal({ bk, rooms, onClose }) {
  const html = buildInvoiceHTML(bk, rooms, bk.invoiceExtras || [], "room");
  return (
    <div className="modal-overlay open" onClick={ev => ev.target === ev.currentTarget && onClose()} style={{ zIndex: 10000 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "96vw", maxWidth: 820, maxHeight: "92vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 18px", background: "var(--navy)" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <i className="ti ti-file-invoice" style={{ marginRight: 8, color: "var(--gold)" }} />
            Invoice — {bk.guest} · {roomLabel(bk)}
          </span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => hotelPrint(html, null)}
              style={{ background: "var(--gold)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 16px", fontWeight: 600, cursor: "pointer", fontSize: 12.5, fontFamily: "inherit" }}>
              <i className="ti ti-printer" style={{ marginRight: 5 }} />Print
            </button>
            <button onClick={() => hotelPrint(html, buildTCHtml(bk))}
              style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 600, cursor: "pointer", fontSize: 12.5, fontFamily: "inherit" }}>
              <i className="ti ti-printer" style={{ marginRight: 5 }} />Print + T&amp;C
            </button>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "7px 11px", cursor: "pointer", fontSize: 15 }}><i className="ti ti-x" /></button>
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: 20, background: "#fafaf8" }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ── ID documents view ────────────────────────────────────────────────────────
// Guest identity papers only — no invoice figures. Uses the same on-demand photo
// loader as the invoice detail, so it's the same data in its own clean window.
function GuestIdView({ bk, onClose }) {
  const [fetched, setFetched] = useState(null);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState(null);
  const hasLocal = (bk.idDocs || []).length > 0 || bk.idFront || bk.idBack;

  useEffect(() => {
    let alive = true;
    const gid = bk.guest_id ?? bk.guestId;
    if (hasLocal || !gid) return;
    setLoading(true);
    loadHotelGuestImages(gid)
      .then(res => { if (alive) { setFetched(res); setLoading(false); } })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [bk.guest_id, bk.guestId, hasLocal]);

  const persons = useMemo(() => {
    const src = hasLocal ? bk : { ...bk, ...(fetched || {}) };
    const list = [];
    if ((src.idDocs || []).length > 0) {
      src.idDocs.forEach((doc, i) => list.push({
        label: `Guest ${i + 1}`, idType: doc.idType || src.idType || "", idNum: doc.idNum || "",
        images: [
          ...((doc.front || []).map(img => ({ img, side: "Front" }))),
          ...((doc.back  || []).map(img => ({ img, side: "Back"  }))),
        ],
      }));
    } else {
      const imgs = [];
      if (src.idFront) imgs.push({ img: src.idFront, side: "Front" });
      if (src.idBack)  imgs.push({ img: src.idBack,  side: "Back"  });
      list.push({ label: "Guest 1", idType: src.idType || "", idNum: src.idNum || "", images: imgs });
    }
    return list;
  }, [bk, fetched, hasLocal]);

  // Print the ID as a standalone document — guest, rooms and stay dates on top so
  // the printed sheet makes sense on its own in an emergency.
  function printId() {
    const rows = [
      ["Guest", bk.guest], ["Phone", bk.phone], ["Nationality", bk.nationality || "—"],
      ["Room(s)", allRoomNumbers(bk).join(", ") || "—"],
      ["Check-in", fmtDate(bk.checkin)], ["Check-out", fmtDate(bk.checkout)],
      ["Nights", bk.nights || "—"],
    ].map(([l, v]) => `<tr><td style="padding:5px 10px;color:#666;font-size:12px;white-space:nowrap;">${l}</td><td style="padding:5px 10px;font-weight:700;font-size:13px;">${v ?? "—"}</td></tr>`).join("");

    const docs = persons.map(p => `
      <div style="margin-top:14px;">
        <div style="font-size:11px;font-weight:700;color:#333;margin-bottom:6px;">
          ${p.label}${p.idType ? " · " + p.idType : ""}${p.idNum ? " · " + p.idNum : ""}
        </div>
        ${p.images.length
          ? p.images.map(im => `<div style="margin-bottom:10px;page-break-inside:avoid;">
              <div style="font-size:10px;color:#777;margin-bottom:3px;">${im.side}</div>
              <img src="${im.img}" style="max-width:100%;max-height:420px;object-fit:contain;border:1px solid #ddd;border-radius:6px;" />
            </div>`).join("")
          : '<div style="font-size:12px;color:#888;">No ID photo on file.</div>'}
      </div>`).join("");

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Guest ID — ${bk.guest}</title></head>
      <body style="font-family:Arial,sans-serif;padding:24px;color:#1a1a2e;">
        <h2 style="margin:0 0 2px;">Hotel The Grand Alayna</h2>
        <div style="color:#777;font-size:12px;margin-bottom:14px;">Guest identification record</div>
        <table style="border-collapse:collapse;border:1px solid #eee;">${rows}</table>
        ${docs}
      </body></html>`);
    w.document.close();
    w.focus();
    // give the images a moment to decode before printing
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="modal-overlay open" onClick={ev => ev.target === ev.currentTarget && onClose()} style={{ zIndex: 10000 }}>
      <div className="modal-box" style={{ maxWidth: 700, maxHeight: "90vh", overflowY: "auto", padding: 0 }}>
        <div style={{ background: "var(--navy)", color: "#fff", padding: "14px 18px", borderRadius: "10px 10px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 600, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <i className="ti ti-id" style={{ marginRight: 8, color: "var(--gold)" }} />
            Guest ID — {bk.guest}
          </span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={printId} style={{ background: "var(--gold)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
              <i className="ti ti-printer" style={{ marginRight: 5 }} />Print
            </button>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 15 }}><i className="ti ti-x" /></button>
          </div>
        </div>

        <div style={{ padding: "16px 18px" }}>
          {/* Guest + stay summary — printed with the ID so the document stands alone */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 14 }}>
            {[
              ["Guest", bk.guest],
              ["Phone", bk.phone],
              ["Nationality", bk.nationality || "—"],
              ["Room(s)", allRoomNumbers(bk).join(", ") || "—"],
              ["Check-in", fmtDate(bk.checkin)],
              ["Check-out", fmtDate(bk.checkout)],
            ].map(([l, v]) => (
              <div key={l}>
                <div style={{ fontSize: 10, color: "var(--text3)", textTransform: "uppercase", letterSpacing: .6 }}>{l}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{v || "—"}</div>
              </div>
            ))}
          </div>

          {loading && <div style={{ fontSize: 12.5, color: "var(--text3)", padding: "10px 0" }}>Loading ID documents…</div>}

          {persons.map((p, i) => (
            <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "11px 13px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: .7, color: "var(--text3)" }}>{p.label}</span>
                {p.idType && <span style={{ fontSize: 11.5, color: "var(--text2)" }}>{p.idType}</span>}
                {p.idNum && <span style={{ fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{p.idNum}</span>}
              </div>
              {p.images.length ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
                  {p.images.map((im, j) => (
                    <div key={j} style={{ border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden" }}>
                      {/* contain, not cover — the WHOLE document must be visible, never cropped */}
                      <div style={{ background: "#f4f4f6", cursor: "zoom-in" }} onClick={() => setZoom(im.img)}>
                        <img src={im.img} alt={im.side} style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "contain" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "var(--bg3)" }}>
                        <span style={{ fontSize: 10.5, color: "var(--text3)" }}>{im.side}</span>
                        <a href={im.img} download={`ID-${(bk.guest || "guest").replace(/\s+/g, "_")}-${im.side}.jpg`}
                          onClick={e => e.stopPropagation()}
                          style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--text2)", textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "2px 8px", background: "var(--bg2)" }}>
                          <i className="ti ti-download" style={{ fontSize: 11, marginRight: 3 }} />Save
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "var(--text3)" }}>{loading ? "" : "No ID photo on file for this guest."}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10001, cursor: "zoom-out" }}>
          <img src={zoom} alt="ID" style={{ maxWidth: "94vw", maxHeight: "94vh", borderRadius: 8 }} />
        </div>
      )}
    </div>
  );
}

function InvoiceDetail({ bk, onClose, autoEdit }) {
  const { curRole, curUser, updateBookings, notify, rooms } = useApp();
  const isMultiRoom = !!(bk.isMultiRoomBooking && (bk.multiRooms || []).length);
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
      // Per-room rows for multi-room bookings — each room keeps its OWN dates/AC/discount
      rooms: isMultiRoom ? bk.multiRooms.map(r => ({
        number: String(r.number),
        checkin: r.checkin || bk.checkin || "",
        checkout: r.checkout || bk.checkout || "",
        acChoice: r.acChoice || "",
        disc: r.discAmt || 0,
      })) : [],
    });
    setEditing(true);
  }

  // "Edit" pressed on the row — open this invoice straight into edit mode.
  // Saving still requires the admin password, exactly as before.
  useEffect(() => {
    if (autoEdit && canEdit && !editing) startEdit();
  }, [autoEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rate for a room given its AC choice (falls back to stored rate / room config)
  function roomRateFor(number, acChoice, storedRate) {
    const cfg = (rooms || []).find(r => String(r.number) === String(number));
    if (cfg && cfg.acRate && cfg.nonAcRate) return acChoice === "Non-AC" ? cfg.nonAcRate : cfg.acRate;
    return cfg?.rate ?? storedRate ?? 0;
  }
  function roomIsDual(number) {
    const cfg = (rooms || []).find(r => String(r.number) === String(number));
    return !!(cfg && cfg.acRate && cfg.nonAcRate);
  }
  function nightsBetweenD(ci, co) {
    if (!ci || !co) return 0;
    const n = Math.round((new Date(co + "T00:00:00") - new Date(ci + "T00:00:00")) / 86400000);
    return n > 0 ? n : 0;
  }

  // Live per-room computation while editing a multi-room booking
  const edMultiRooms = (ed?.rooms || []).map(er => {
    const orig = (bk.multiRooms || []).find(m => String(m.number) === String(er.number)) || {};
    // Keep the ACTUAL booked rate unless the AC choice was changed (which legitimately
    // switches to the room's standard AC / Non-AC rate). This stops opening the editor
    // from silently re-pricing at the standard rate.
    const acUnchanged = (er.acChoice || "") === (orig.acChoice || "");
    const rate = acUnchanged ? (orig.rate ?? roomRateFor(er.number, er.acChoice, orig.rate))
                             : roomRateFor(er.number, er.acChoice, orig.rate);
    const nights = Math.max(1, nightsBetweenD(er.checkin, er.checkout));
    const gross = nights * rate;
    const disc = Math.min(parseFloat(er.disc) || 0, gross);
    const amount = Math.max(0, gross - disc);
    return { ...er, orig, name: orig.name, type: orig.type, rate, nights, gross, disc, amount, isDual: roomIsDual(er.number) };
  });
  const edMultiTotal = edMultiRooms.reduce((s, r) => s + r.amount, 0);
  const setRoomF = (idx, k, v) => setEd(p => ({ ...p, rooms: p.rooms.map((r, i) => i === idx ? { ...r, [k]: v } : r) }));

  const edNights = (() => {
    if (!ed?.checkin || !ed?.checkout) return bk.nights || 0;
    const n = Math.round((new Date(ed.checkout + "T00:00:00") - new Date(ed.checkin + "T00:00:00")) / 86400000);
    return n > 0 ? n : 0;
  })();

  function commitSave() {
    if (!checkAdminPassword(savePw)) { notify("Incorrect admin password", "error"); return; }
    // Multi-room: the total comes from the per-room rows, not a single field.
    const newTotal = isMultiRoom ? edMultiTotal : (parseFloat(ed.total) || 0);
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

    // Rebuild per-room data for multi-room bookings so the invoice matches
    let multiFields = {};
    if (isMultiRoom) {
      const newRooms = edMultiRooms.map(r => ({
        ...r.orig, number: r.number, name: r.name, type: r.type,
        acChoice: r.isDual ? r.acChoice : r.orig.acChoice,
        rate: r.rate, nights: r.nights, checkin: r.checkin, checkout: r.checkout,
        grossAmt: r.gross, discAmt: r.disc, amount: r.amount,
      }));
      const minCi = newRooms.reduce((m, r) => (r.checkin && (!m || r.checkin < m)) ? r.checkin : m, "");
      const maxCo = newRooms.reduce((m, r) => (r.checkout && r.checkout > m) ? r.checkout : m, "");
      const maxNights = newRooms.reduce((m, r) => Math.max(m, r.nights || 0), 0);
      const totalDisc = newRooms.reduce((s, r) => s + (r.discAmt || 0), 0);
      multiFields = { multiRooms: newRooms, checkin: minCi || bk.checkin, checkout: maxCo || bk.checkout, nights: maxNights || bk.nights, discAmt: totalDisc };
    }

    const updated = {
      ...bk,
      guest: ed.guest.trim(), phone: ed.phone.trim(),
      status: ed.status,
      invoiceTotal: newTotal, amount: newTotal,
      advance, restPayment, paymentHistory,
      dueAmount: Math.max(0, newTotal - newPaid),
      idNum: ed.idNum, idDocs,
      referrer: ed.referrer.trim(), purpose: ed.purpose.trim(), notes: ed.notes.trim(),
      editedAt: new Date().toISOString(), editedBy: curUser || "admin",
      // single-room fields (overridden by multiFields for multi-room)
      ...(isMultiRoom ? {} : { room: ed.room.trim(), checkin: ed.checkin, checkout: ed.checkout, nights: edNights || bk.nights, discAmt: parseFloat(ed.disc) || 0 }),
      ...multiFields,
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
            const newTotal = isMultiRoom ? edMultiTotal : (parseFloat(ed.total) || 0), newPaid = parseFloat(ed.paid) || 0;
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
                  <div><label style={lbl}>Status</label>
                    <select value={ed.status} onChange={e => setF("status", e.target.value)} style={inp}>
                      <option value="confirmed">Reserved (confirmed)</option>
                      <option value="checked-in">Checked-in</option>
                      <option value="checked-out">Checked-out</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  {!isMultiRoom && F("Room No.", "room")}
                  {!isMultiRoom && F("Check-in", "checkin", "date")}
                  {!isMultiRoom && F("Check-out", "checkout", "date")}
                  {!isMultiRoom && (
                    <div><label style={lbl}>Nights</label>
                      <input value={edNights} readOnly style={{ ...inp, background: "var(--bg4)", fontWeight: 700 }} /></div>
                  )}
                  {!isMultiRoom && F("Invoice Total (৳)", "total", "number")}
                  {!isMultiRoom && F("Discount (৳)", "disc", "number")}
                  {F("Amount Paid (৳)", "paid", "number")}
                  {F("ID / NID Number", "idNum")}
                  {F("Referrer", "referrer")}
                  {F("Purpose", "purpose")}
                </div>

                {/* Multi-room: edit EACH room separately (dates, AC, discount) */}
                {isMultiRoom && (
                  <div style={{ border: "1.5px solid #c4a8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 12, background: "#f8f4ff" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#5a2ea8", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
                      Rooms in this booking — edit each on its own
                    </div>
                    {edMultiRooms.map((r, idx) => (
                      <div key={idx} style={{ border: "1px solid #e0d4f5", borderRadius: 8, background: "#fff", padding: "10px 12px", marginBottom: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--navy)", marginBottom: 8 }}>Room {r.number}{r.name ? " — " + r.name : ""}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 10 }}>
                          <div><label style={lbl}>Check-in</label>
                            <input type="date" value={r.checkin} onChange={e => setRoomF(idx, "checkin", e.target.value)} style={inp} /></div>
                          <div><label style={lbl}>Check-out</label>
                            <input type="date" value={r.checkout} onChange={e => setRoomF(idx, "checkout", e.target.value)} style={inp} /></div>
                          {r.isDual && (
                            <div><label style={lbl}>AC / Non-AC</label>
                              <select value={r.acChoice || "AC"} onChange={e => setRoomF(idx, "acChoice", e.target.value)} style={inp}>
                                <option value="AC">❄️ AC</option>
                                <option value="Non-AC">🌬️ Non-AC</option>
                              </select></div>
                          )}
                          <div><label style={lbl}>Discount (৳)</label>
                            <input type="number" value={r.disc} onWheel={e => e.target.blur()} onChange={e => setRoomF(idx, "disc", e.target.value)} style={inp} /></div>
                          <div><label style={lbl}>Nights</label>
                            <input value={r.nights} readOnly style={{ ...inp, background: "var(--bg4)", fontWeight: 700 }} /></div>
                          <div><label style={lbl}>Amount</label>
                            <input value={fmtMoney(r.amount)} readOnly style={{ ...inp, background: "var(--bg4)", fontWeight: 800 }} /></div>
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--text3)", marginTop: 5 }}>{r.nights} night{r.nights > 1 ? "s" : ""} × ৳{(r.rate || 0).toLocaleString()}{r.disc > 0 ? ` − ৳${r.disc.toLocaleString()} discount` : ""}</div>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 14, fontWeight: 800, color: "var(--navy)", padding: "4px 2px" }}>
                      Total (all rooms): ৳{edMultiTotal.toLocaleString()}
                    </div>
                  </div>
                )}
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
  const { bookings, updateBookings, notify, revenues, rooms } = useApp();

  const [search,         setSearch]         = useState("");
  // Default view is THIS month only — "All months" is available on demand.
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [filterMonth,    setFilterMonth]    = useState(thisMonth);
  const [filterStatus,   setFilterStatus]   = useState("All");
  const [filterRooms,    setFilterRooms]    = useState([]); // multiple room numbers
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [viewTarget,     setViewTarget]     = useState(null); // customer invoice view
  const [idTarget,       setIdTarget]       = useState(null); // guest ID documents view
  const [editIntent,     setEditIntent]     = useState(null); // open detail straight into edit
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [selectedMonths, setSelectedMonths] = useState([]);
  const [detail,         setDetail]         = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null); // single invoice
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false); // bulk delete modal
  const [delPw,          setDelPw]          = useState("");

  // Complete set of bookings for the selected month (live + on-demand cloud fetch
  // for past months), so totals never shrink as old bookings age out of memory.
  const { bookings: monthBookings, loading: loadingMonth } = useMonthBookings(filterMonth, bookings);

  // The live app only holds the last 30 days. When a date range is searched, pull
  // the matching bookings from the cloud so older invoices are actually findable.
  const [rangeRows, setRangeRows] = useState([]);
  const [loadingRange, setLoadingRange] = useState(false);
  useEffect(() => {
    if (!dateFrom && !dateTo) { setRangeRows([]); return; }
    const from = dateFrom || "2000-01-01";
    const to   = dateTo   || "2999-12-31";
    let alive = true;
    setLoadingRange(true);
    loadHotelBookingsForRange(from, to)
      .then(rows => { if (alive) setRangeRows(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setRangeRows([]); })
      .finally(() => { if (alive) setLoadingRange(false); });
    return () => { alive = false; };
  }, [dateFrom, dateTo]);

  // Merge the range results in, de-duplicated and honouring deletions
  const srcBookings = useMemo(() => {
    if (!rangeRows.length) return monthBookings;
    const deleted = (() => {
      try {
        const legacy = JSON.parse(localStorage.getItem("ga_deleted_booking_ids") || "[]");
        const v1 = (JSON.parse(localStorage.getItem("ga_deleted_ids_v1") || "{}").bkg) || [];
        return new Set([...legacy, ...v1].map(String));
      } catch { return new Set(); }
    })();
    const have = new Set(monthBookings.map(b => String(b.supabaseBookingId ?? b.id)));
    const add = rangeRows.filter(b =>
      !have.has(String(b.supabaseBookingId ?? b.id)) &&
      !deleted.has(String(b.id)) && !deleted.has(String(b.supabaseBookingId ?? "")));
    return add.length ? [...monthBookings, ...add] : monthBookings;
  }, [monthBookings, rangeRows]);

  const allMonths = useMemo(() => {
    const set = new Set(srcBookings.map(getBookingMonth).filter(Boolean));
    set.add(thisMonth); // always offer the current month, even before it has invoices
    return [...set].sort().reverse();
  }, [srcBookings, thisMonth]);

  // Detect the same stay recorded more than once (same guest + room + check-in).
  // These are real duplicate rows from an earlier id mismatch. Read-only — it only
  // groups them so you can see both and delete the wrong one yourself.
  const duplicateGroups = useMemo(() => {
    const groups = new Map();
    bookings.forEach(b => {
      if (!b || !b.guest || b.status === "cancelled") return;
      const key = [String(b.guest).trim().toLowerCase(), String(b.room || ""), b.checkin || ""].join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(b);
    });
    // Only groups with more than one record are duplicates. Within each, mark the
    // one to KEEP (latest check-out, then most paid) so the choice is obvious.
    return [...groups.values()].filter(g => g.length > 1).map(g => {
      const sorted = [...g].sort((a, b) =>
        (b.checkout || "").localeCompare(a.checkout || "") || (calcPaid(b) - calcPaid(a)));
      return { keep: sorted[0], list: sorted };
    });
  }, [bookings]);

  // Uses the pure, unit-tested filter in lib/invoiceFilter.js (see its test file —
  // the 5–8 Aug date-range bug is locked down there).
  const filtered = useMemo(
    () => filterInvoices(srcBookings, { search, rooms: filterRooms, month: filterMonth, dateFrom, dateTo, status: filterStatus }),
    [srcBookings, search, filterStatus, filterMonth, filterRooms, dateFrom, dateTo],
  );

  // A stay that crosses a month boundary belongs partly to each month, so when one
  // month is being viewed this returns just that month's share of the invoice.
  // With no month selected it returns the whole invoice.
  const shareOf = useCallback((bk) => {
    // A cancelled invoice may still be listed, but its money is NOT revenue —
    // the revenue engine ignores cancelled bookings, so the totals must too.
    if (bk.status === "cancelled") return { billed: 0, collected: 0, partial: false, cancelled: true };
    if (!filterMonth) {
      const total = bk.invoiceTotal ?? bk.amount ?? 0;
      return { billed: total, collected: calcPaid(bk), partial: false };
    }
    let billed = 0, collected = 0;
    bookingMonthlyParts(bk).forEach(p => {
      if (p.month === filterMonth) { billed += p.billed; collected += p.collected; }
    });
    const full = bk.invoiceTotal ?? bk.amount ?? 0;
    return { billed, collected, partial: Math.abs(billed - full) > 1 };
  }, [filterMonth]);

  // The figures on top always describe exactly what you are looking at:
  //  · tick some rows  → only those invoices
  //  · otherwise       → every invoice the current search is showing (this month by default)
  // When a month is selected they use each stay's share of that month, so they
  // reconcile exactly with the revenue on the Desk and Reports screens.
  const totals = useMemo(() => {
    const rows = selectedIds.size > 0 ? filtered.filter(b => selectedIds.has(b.id)) : filtered;
    let total = 0, paid = 0;
    rows.forEach(bk => { const s = shareOf(bk); total += s.billed; paid += s.collected; });
    return { total, paid, balance: Math.max(0, total - paid), count: rows.length };
  }, [filtered, selectedIds, shareOf]);

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
    if (selectedMonths.length > 0) return srcBookings.filter(bk => selectedMonths.includes(getBookingMonth(bk)));
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
    // Cross-device tombstone so it stays deleted on every device, not just this one
    gaRecordDeleted('bkg', sbId); gaRecordDeleted('bkg', target.id);
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
    // Cross-device tombstones so these stay deleted on every device
    [...sbIds, ...localIds].forEach(id => gaRecordDeleted('bkg', id));
    const guestIds = toDelete.map(b => b.guest_id).filter(Boolean);
    void deleteHotelBookings(sbIds, guestIds).catch(err => console.error("Supabase bulk delete failed:", err));
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--bg3)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <i className="ti ti-file-invoice" style={{ color: "var(--gold2)", fontSize: 16 }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>Invoices</div>
          <div style={{ fontSize: 11, color: "var(--text3)" }}>View, edit, search and print every guest invoice</div>
        </div>
        <button onClick={doPDF} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg2)", color: "var(--text)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <i className="ti ti-file-type-pdf" style={{ marginRight: 5 }} />PDF{selCount > 0 ? ` (${selCount})` : ""}
        </button>
        <button onClick={doExcel} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #cfe2d5", background: "#f2f8f4", color: "#2f7d4f", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          <i className="ti ti-file-spreadsheet" style={{ marginRight: 5 }} />Excel{selCount > 0 ? ` (${selCount})` : ""}
        </button>
      </div>

      {/* Summary cards — always describe exactly what is on screen */}
      <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 7 }}>
        {selCount > 0
          ? <>Showing totals for <strong style={{ color: "var(--navy)" }}>{selCount} selected invoice{selCount !== 1 ? "s" : ""}</strong></>
          : filterMonth
            ? <>Showing totals for <strong style={{ color: "var(--navy)" }}>{monthLabel(filterMonth)}</strong></>
            : <>Showing totals for <strong style={{ color: "var(--navy)" }}>all months</strong></>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 12 }}>
        {[
          { label: "Invoices", value: (loadingRange || loadingMonth) ? "…" : totals.count, color: "var(--text)" },
          { label: "Total billed", value: fmtMoney(totals.total), color: "var(--text)" },
          { label: "Collected", value: fmtMoney(totals.paid), color: "#2f7d4f" },
          { label: "Due", value: fmtMoney(totals.balance), color: totals.balance > 0 ? "#b5322a" : "#2f7d4f" },
        ].map(c => (
          <div key={c.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 13px" }}>
            <div style={{ fontSize: 9, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: .7 }}>{c.label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: c.color, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Search panel */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 13px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
          <span style={{ fontSize: 9.5, letterSpacing: .9, textTransform: "uppercase", color: "var(--text3)", fontWeight: 600 }}>Search</span>
          {(loadingRange || loadingMonth) && <span style={{ fontSize: 10.5, color: "var(--text3)" }}>· searching older records…</span>}
          {(search || filterMonth !== thisMonth || filterRooms.length || dateFrom || dateTo || filterStatus !== "All") && (
            <button type="button"
              onClick={() => { setSearch(""); setFilterMonth(thisMonth); setFilterRooms([]); setDateFrom(""); setDateTo(""); setFilterStatus("All"); setSelectedIds(new Set()); }}
              style={{ marginLeft: "auto", padding: "4px 11px", border: "1px solid var(--border)", background: "var(--bg3)", borderRadius: 7, fontSize: 11, fontFamily: "inherit", cursor: "pointer", color: "var(--text2)" }}>
              Reset to this month
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 9 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Guest name, phone, invoice no, ID…"
            style={{ padding: "8px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", gridColumn: "span 2", minWidth: 0 }} />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: "8px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", minWidth: 0 }}>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            style={{ padding: "8px 11px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12.5, fontFamily: "inherit", minWidth: 0 }}>
            <option value="">All months</option>
            {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text3)", minWidth: 0 }}>
            From
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "inherit" }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text3)", minWidth: 0 }}>
            To
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ flex: 1, minWidth: 0, padding: "7px 9px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, fontFamily: "inherit" }} />
          </label>
        </div>

        {/* Rooms — tick as many as you like */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: .7, textTransform: "uppercase", color: "var(--text3)" }}>Rooms</span>
          {(rooms || []).map(r => {
            const num = String(r.number);
            const on = filterRooms.includes(num);
            return (
              <button key={num} type="button"
                onClick={() => setFilterRooms(prev => on ? prev.filter(x => x !== num) : [...prev, num])}
                style={{
                  padding: "4px 11px", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                  border: "1px solid " + (on ? "var(--navy)" : "var(--border)"),
                  background: on ? "var(--navy)" : "var(--bg2)",
                  color: on ? "#fff" : "var(--text2)",
                }}>{num}</button>
            );
          })}
          {filterRooms.length > 0 && (
            <button type="button" onClick={() => setFilterRooms([])}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--text3)", fontFamily: "inherit" }}>
              ✕ clear rooms
            </button>
          )}
        </div>
      </div>

      {/* Selection actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
        {selCount > 0 && <span style={{ fontSize: 12, color: "var(--text2)" }}><strong>{selCount}</strong> selected</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
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

      {/* Export-by-month panel removed — the PDF / Excel buttons at the top already
          export whatever the search is currently showing. */}

      {/* Possible duplicate invoices — read-only finder */}
      {duplicateGroups.length > 0 && (
        <div style={{ border: "2px solid #e0a800", borderRadius: 10, background: "#fffbea", padding: "14px 16px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#8a5a00", marginBottom: 4 }}>
            <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />Possible duplicate invoices ({duplicateGroups.length})
          </div>
          <div style={{ fontSize: 12, color: "#7a5c00", marginBottom: 12 }}>
            The same stay appears to be recorded more than once. Keep the correct copy (marked <strong>KEEP</strong> — the latest check-out / most paid) and delete the others. Nothing is removed until you confirm with the admin password.
          </div>
          {duplicateGroups.map((grp, gi) => (
            <div key={gi} style={{ border: "1px solid #e8d48a", borderRadius: 8, background: "#fff", padding: "8px 10px", marginBottom: 10 }}>
              {grp.list.map(b => {
                const isKeep = b === grp.keep;
                return (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "7px 4px", borderBottom: "1px solid #f0ecdc" }}>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: isKeep ? "#d1fae5" : "#fee2e2", color: isKeep ? "#065f46" : "#991b1b" }}>
                      {isKeep ? "KEEP" : "DUPLICATE"}
                    </span>
                    <span style={{ fontSize: 12.5 }}>
                      <strong>{b.guest}</strong> · Rm {b.room} · {fmtDate(b.checkin)} → {fmtDate(b.checkout)} · {b.nights || "?"}n · {fmtMoney(b.invoiceTotal ?? b.amount)} · paid {fmtMoney(calcPaid(b))} · <span style={{ textTransform: "capitalize" }}>{b.status}</span> <span style={{ color: "var(--text3)", fontSize: 10 }}>#{b.id}</span>
                    </span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button onClick={() => setDetail(b)} style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid var(--border)", background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>View</button>
                      {!isKeep && (
                        <button onClick={() => { setDeleteTarget(b); setDelPw(""); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1.5px solid #fca5a5", background: "#fee2e2", color: "#991b1b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Delete this duplicate</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", background: "var(--bg2)" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: INV_COLS, gap: 8, background: "var(--bg3)", color: "var(--text3)", fontSize: 9.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.7, padding: "10px 12px", alignItems: "center" }}>
          <input type="checkbox" checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
            onChange={toggleAll}
            style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--navy)" }} />
          <span>Invoice</span>
          <span>Guest</span>
          <span>Rooms</span>
          <span>Stay</span>
          <span style={{ textAlign: "right" }}>Total</span>
          <span style={{ textAlign: "right" }}>Balance</span>
          <span style={{ textAlign: "center" }}>Actions</span>
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

          const rooms = allRoomNumbers(bk);
          const share = shareOf(bk);
          return (
            <div key={bk.id}
              onClick={() => setDetail(bk)}
              style={{ display: "grid", gridTemplateColumns: INV_COLS, gap: 8, padding: "11px 12px", borderTop: "1px solid var(--border)", fontSize: 12.5, alignItems: "center", cursor: "pointer", background: checked ? "var(--bg3)" : "", transition: "background .1s" }}
              onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "var(--bg4)"; }}
              onMouseLeave={e => { if (!checked) e.currentTarget.style.background = ""; }}>

              <div onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={checked} onChange={() => toggleOne(bk.id)}
                  style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--navy)" }} />
              </div>

              {/* Invoice no + status */}
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--text3)", fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>GA-{String(bk.id).padStart(4, "0")}</div>
                <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 600, padding: "1px 8px", borderRadius: 20, background: sBg, color: sColor, whiteSpace: "nowrap" }}>
                  {bk.status || "reserved"}
                </span>
              </div>

              {/* Guest */}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bk.guest || "—"}</div>
                <div style={{ color: "var(--text3)", fontSize: 10.5 }}>{bk.phone || ""}</div>
              </div>

              {/* Rooms — every room, not just the first */}
              <div style={{ minWidth: 0, fontWeight: 600 }}>{rooms.join(", ") || "—"}</div>

              {/* Stay */}
              <div style={{ minWidth: 0, fontSize: 11.5, color: "var(--text2)" }}>
                {fmtDate(bk.checkin)} → {fmtDate(bk.checkout)}
                <div style={{ color: "var(--text3)", fontSize: 10 }}>{bk.nights || "—"} night{bk.nights === 1 ? "" : "s"}</div>
              </div>

              <div style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                {fmtMoney(share.partial ? share.billed : total)}
                {share.partial && (
                  <div style={{ fontSize: 9.5, color: "var(--text3)", fontWeight: 400 }}>
                    this month · of {fmtMoney(total)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", fontWeight: 600, color: balance > 0 ? "#b5322a" : "#2f7d4f", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(balance)}</div>

              {/* Actions — View / ID open freely, Edit + Delete ask for the admin password */}
              <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                <button title="View the customer invoice" onClick={() => setViewTarget(bk)} style={invBtn()}>
                  <i className="ti ti-eye" style={{ fontSize: 12 }} /> View
                </button>
                <button title="View guest ID documents" onClick={() => setIdTarget(bk)} style={invBtn()}>
                  <i className="ti ti-id" style={{ fontSize: 12 }} /> ID
                </button>
                <button title="Edit invoice (admin password)" onClick={() => { setDetail(bk); setEditIntent(bk.id); }} style={invBtn()}>
                  <i className="ti ti-lock" style={{ fontSize: 11 }} /> Edit
                </button>
                <button title="Delete invoice (admin password)" onClick={() => { setDeleteTarget(bk); setDelPw(""); }} style={invBtn(true)}>
                  <i className="ti ti-lock" style={{ fontSize: 11 }} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail modal — full invoice view (and edit, which asks for the password) */}
      {detail && (
        <InvoiceDetail bk={detail} autoEdit={editIntent === detail.id}
          onClose={() => { setDetail(null); setEditIntent(null); }} />
      )}

      {/* Customer invoice view */}
      {viewTarget && <InvoiceViewModal bk={viewTarget} rooms={rooms} onClose={() => setViewTarget(null)} />}

      {/* Guest ID documents view */}
      {idTarget && <GuestIdView bk={idTarget} onClose={() => setIdTarget(null)} />}

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
