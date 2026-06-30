import { useState, useMemo, useRef, useEffect } from "react";
import { useHall, EV_TYPES, checkHallAdminPass } from "../HallContext";
import useIsMobile from "../useIsMobile";
import { sendSmsForInvoice } from "./HallAdmin";
import { sendWhatsAppAlert, buildHallWaMessage } from "../../utils/whatsapp";
import { sendNtfyAlert } from "../../utils/ntfy";
import { logEvent } from "../../utils/auditLog";
import {
  persistHallInvoiceBundle,
  deleteHallInvoiceFromSupabase,
} from "../lib/hallSupabase";

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  maroon: "#7B1212",
  gold: "#c9a84c",
  bg: "#F4F3F0",
  white: "#fff",
  border: "#e5e3de",
  text: "#1a1a1a",
  dim: "#666",
  green: "#1a7a40",
  red: "#c0392b",
  purple: "#6030b0",
};

// ── Smart AM/PM converter ─────────────────────────────────────────────────────
// Accepts plain number ("7"), colon format ("7:30"), or compact ("730").
// mode: "day"          → 6–11=AM, 12/1–5=PM
// mode: "night-start"  → all PM except 12=AM (midnight)
// mode: "night-end"    → all AM except 12=PM
// mode: "holud-start"  → same as night-start
// mode: "holud-end"    → same as night-end
function smartTime(rawVal, mode) {
  if (!rawVal) return rawVal;
  const cleaned = String(rawVal).replace(/[^\d:]/g, "");
  let hour, min = "00";
  if (cleaned.includes(":")) {
    const parts = cleaned.split(":");
    hour = parseInt(parts[0]);
    min = parts[1]?.padEnd(2, "0").slice(0, 2) || "00";
  } else if (cleaned.length <= 2) {
    hour = parseInt(cleaned);
  } else {
    hour = parseInt(cleaned.slice(0, -2));
    min = cleaned.slice(-2);
  }
  if (isNaN(hour) || hour < 1 || hour > 12) return rawVal;
  let ampm = "AM";
  if (mode === "day") {
    ampm = (hour >= 6 && hour <= 11) ? "AM" : "PM";
  } else if (mode === "night-start" || mode === "holud-start") {
    ampm = hour === 12 ? "AM" : "PM";
  } else if (mode === "night-end" || mode === "holud-end") {
    ampm = hour === 12 ? "PM" : "AM";
  }
  return `${hour}:${min} ${ampm}`;
}

const SOURCES = [
  "Facebook",
  "Facebook Ad",
  "YouTube",
  "TikTok",
  "Instagram",
  "WhatsApp",
  "Google Search",
  "Friend / Family Referral",
  "Previous Client",
  "Highway Signage",
  "Walk-in",
  "Event Organiser",
  "Other",
];
const PAY_METHODS = ["Cash", "bKash", "Nagad", "Bank Transfer"];
const SVC_ICONS = {
  "Hall Rental": {
    icon: "🏛️",
    bg: "linear-gradient(135deg,#7B1212,#a01818)",
    color: "#fff",
  },
  "Stage Decoration": {
    icon: "🎪",
    bg: "linear-gradient(135deg,#6030b0,#8040d0)",
    color: "#fff",
  },
  "Lighting Decoration": {
    icon: "💡",
    bg: "linear-gradient(135deg,#1a7a40,#22a050)",
    color: "#fff",
  },
};

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtDateWithDay(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  const day = d.toLocaleDateString("en-GB", { weekday: "long" });
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `${day}, ${date}`;
}

function calcSub(services) {
  return services.reduce((s, r) => {
    if (r.included === false) return s;
    return s + parseFloat(r.qty || 1) * parseFloat(r.rate || 0);
  }, 0);
}

function calcExtras(inv) {
  const wWaiters =
    (parseFloat(inv.wWaiters) || 0) * (parseFloat(inv.wWaiterPrice) || 0);
  const hWaiters =
    (parseFloat(inv.hWaiters) || 0) * (parseFloat(inv.hWaiterPrice) || 0);
  const wRental = parseFloat(inv.wRental) || 0;
  const hRental = parseFloat(inv.hRental) || 0;
  return {
    wWaiters,
    hWaiters,
    wRental,
    hRental,
    total: wWaiters + hWaiters + wRental + hRental,
  };
}

function calcGrand(inv) {
  const svcSub = calcSub(inv.services || []);
  const extras = calcExtras(inv);
  const hallSub = svcSub + extras.wRental + extras.hRental;
  const disc = parseFloat(inv.discount) || 0;
  const grand = Math.max(0, hallSub - disc); // hall revenue only — waiter cost tracked separately
  const waiterTotal = extras.wWaiters + extras.hWaiters;
  return { svcSub, extras, hallSub, disc, grand, waiterTotal };
}

function isUuidLike(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function newInvObj(num) {
  const today = new Date().toISOString().split("T")[0];
  return {
    id: "",
    num,
    invDate: today,
    client: "",
    phone: "",
    phone2: "",
    phone3: "",
    email: "",
    //address: "",
    addrArea: "",
    addrCity: "",
    addrDistrict: "",
    voterIdData: "",
    voterIdName: "",
    evType: "Wedding",
    evDate: today,
    // Wedding fields
    wTod: "",
    wDur: "Full Day",
    wStart: "",
    wEnd: "",
    wGuests: "",
    wSide: "",
    wBride: "",
    wBrideRel: "",
    wGroom: "",
    wGroomRel: "",
    wCouplePhone: "",
    wRelation: "",
    wVenue: "",
    wTables: "",
    wWaiters: "",
    wWaiterPrice: "",
    wRental: "",
    // Holud fields
    hDate: "",
    hSlot: "",
    hStart: "",
    hEnd: "",
    hGuests: "",
    hTables: "",
    hSide: "",
    hBride: "",
    hBrideRel: "",
    hGroom: "",
    hGroomRel: "",
    hRelation: "",
    hVenue: "",
    hWaiters: "",
    hWaiterPrice: "",
    hRental: "",
    // Generic
    genTitle: "",
    genNote: "",
    // Services
    services: [
      { desc: "Hall Rental", rate: 0, qty: 1, fixed: true },
      {
        desc: "Stage Decoration",
        rate: 0,
        qty: 1,
        fixed: true,
        included: null,
      },
      {
        desc: "Lighting Decoration",
        rate: 0,
        qty: 1,
        fixed: true,
        included: null,
      },
    ],
    discount: 0,
    stageImgData: "",
    stageImgName: "",
    adv: 0,
    advMethod: "Cash",
    bankName: "",
    bankRef: "",
    balance: 0,
    payStatus: "Unpaid",
    hearAbout: "",
    note: "",
    grand: 0,
    waiterCostPaid: 0,
    waiterPaid: 0,
    isLead: false,
    confirmed: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function HallInvoice() {
  const { invoices, setInvoices, leads = [], setLeads, notify, invoiceJumpSignal, curUser } =
    useHall();
  const isMobile = useIsMobile();
  const [view, setView] = useState("form");

  // Unpaid/partial balances from past events (confirmed, event date was yesterday or earlier)
  const yesterday = (() => {
    const d = new Date(); d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();
  const unpaidPastEvents = invoices.filter(inv => {
    if (inv.isLead || !inv.confirmed) return false;
    if (inv.payStatus === "Paid") return false;
    const eventDate = inv.evDate || inv.hDate || "";
    return eventDate && eventDate <= yesterday;
  });
  const [editInv, setEditInv] = useState(() => null); // will init in effect
  const [detailInv, setDetailInv] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const [deleteModal, setDeleteModal] = useState(null);
  const [delPass, setDelPass] = useState("");
  const [formKey, setFormKey] = useState(0);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Real ACH-000xx numbers are only assigned at Confirm & Print time (see confirmAndPrint
  // in InvDetail), so drafts/leads that get abandoned never burn a slot in the sequence —
  // confirmed invoices always stay perfectly back-to-back with no gaps.
  function nextAchNum() {
    const achNums = invoices
      .filter((i) => /^ACH-\d+$/.test(i.num || ""))
      .map((i) => parseInt(i.num.replace(/\D/g, "")) || 0);
    if (!achNums.length) return "ACH-00001";
    return "ACH-" + String(Math.max(...achNums) + 1).padStart(5, "0");
  }
  function draftNum() {
    return "DRAFT-" + String(Date.now()).slice(-6);
  }

  // Initialise a blank form on first render
  const currentForm = editInv || newInvObj(draftNum());

  const jumpSignalRef = useRef(invoiceJumpSignal);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (invoiceJumpSignal !== jumpSignalRef.current) {
      jumpSignalRef.current = invoiceJumpSignal;
      // Only jump to a fresh create-form when coming from history/detail —
      // if the manager is already mid-typing in the form, clicking "Invoice"
      // in the navbar (e.g. on the way back from Calendar/CRM) must NOT wipe their work.
      if (viewRef.current !== "form") openNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceJumpSignal]);

  function openNew() {
    setEditInv(newInvObj(draftNum()));
    setView("form");
    setFormKey((k) => k + 1);
  }
  function openEdit(inv) {
    setEditInv({
      ...newInvObj(inv.num),
      ...inv,
      services: inv.services?.length
        ? inv.services.map((s) => ({
            ...s,
            // Default unresolved togglable services to "not included" so Save buttons aren't blocked
            ...(["Stage Decoration", "Lighting Decoration"].includes(s.desc) && s.included === null
              ? { included: false }
              : {}),
          }))
        : newInvObj(inv.num).services,
    });
    setView("form");
    setFormKey((k) => k + 1);
  }
  function openDetail(inv) {
    setDetailInv(inv);
    setView("detail");
  }
  function backToForm() {
    setEditInv(null);
    setDetailInv(null);
    setView("form");
  }
  function openHistory() {
    setView("list");
  }
  function requestClear() {
    setClearConfirm(true);
  }
  function confirmClear() {
    setClearConfirm(false);
    backToForm();
    setFormKey((k) => k + 1);
  }

  function computeAndSave(inv, isLead, andView) {
    // Apply smart AM/PM to any time fields that the user typed as plain numbers
    const nightMode = (inv.wTod || "") === "night";
    const today = new Date().toISOString().split("T")[0];
    inv = {
      ...inv,
      // Refresh invoice date to today when converting a lead to a full invoice
      invDate: isLead ? (inv.invDate || today) : today,
      hStart: smartTime(inv.hStart, "holud-start") || inv.hStart,
      hEnd:   smartTime(inv.hEnd,   "holud-end")   || inv.hEnd,
      wStart: smartTime(inv.wStart, nightMode ? "night-start" : "day") || inv.wStart,
      wEnd:   smartTime(inv.wEnd,   nightMode ? "night-end"   : "day") || inv.wEnd,
    };
    const { disc, grand, waiterTotal } = calcGrand(inv);
    const bal = Math.max(0, grand - (parseFloat(inv.adv) || 0));
    const payStatus =
      grand === 0
        ? "Unpaid"
        : bal === 0
          ? "Paid"
          : (parseFloat(inv.adv) || 0) > 0
            ? "Partial"
            : "Unpaid";
    const waiterPaid = parseFloat(inv.waiterCostPaid ?? inv.waiterPaid) || 0;
    const waiterBalance = Math.max(0, waiterTotal - waiterPaid);
    const waiterPayStatus =
      waiterTotal === 0
        ? "Unpaid"
        : waiterBalance === 0
          ? "Paid"
          : waiterPaid > 0
            ? "Partial"
            : "Unpaid";
    const final = {
      ...inv,
      grand,
      balance: bal,
      payStatus,
      discount: disc,
      waiterTotal,
      waiterPaid,
      waiterCostPaid: waiterPaid,
      waiterBalance,
      waiterPayStatus,
      isLead: isLead || false,
    };
    const isExistingRecord = invoices.some((i) => i.id === inv.id);
    const id = isUuidLike(inv.id) ? inv.id : crypto.randomUUID();

    let savedRecord;
    if (isExistingRecord) {
      savedRecord = { ...final, id };
      setInvoices((prev) =>
        prev.map((i) => (i.id === inv.id ? savedRecord : i)),
      );
      notify("Invoice updated", "success");
      logEvent(
        "hall",
        "invoice_updated",
        {
          num: savedRecord.num,
          client: savedRecord.client,
          amount: savedRecord.grand,
        },
        curUser,
      );
      // If this was a lead and is now being saved as a full invoice, mark CRM lead as Confirmed
      const wasLead = invoices.find(i => i.id === inv.id)?.isLead;
      if (wasLead && !isLead) {
        setLeads(prev => prev.map(l =>
          l.invoiceId === id ? { ...l, stage: "Confirmed", updatedAt: new Date().toISOString() } : l
        ));
      }
    } else {
      savedRecord = { ...final, id };
      setInvoices((prev) => [...prev, savedRecord]);
      notify("Invoice saved", "success");
      logEvent(
        "hall",
        "invoice_created",
        {
          num: savedRecord.num,
          client: savedRecord.client,
          amount: savedRecord.grand,
          note: isLead ? "draft/lead" : "",
        },
        curUser,
      );
      // Guest SMS and owner WhatsApp alert are sent only once the invoice is
      // confirmed (see confirmAndPrint below) — never on an unreviewed draft,
      // so the guest is never texted a preliminary number that might change.

      // Auto-create a CRM lead when saving as lead (if one doesn't exist yet)
      if (isLead) {
        const alreadyInCRM = leads.some(l => l.invoiceId === id);
        if (!alreadyInCRM) {
          const followDate = new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0];
          const crmNums = leads.map(l => parseInt(l.num?.replace(/\D/g,"")) || 0);
          const nextNum = "CRM-" + String((crmNums.length ? Math.max(...crmNums) : 0) + 1).padStart(3,"0");
          const crmLead = {
            id: String(Date.now()),
            num: nextNum,
            invoiceId: id,
            invoiceNum: savedRecord.num,
            name: savedRecord.client || "",
            phone: savedRecord.phone || "",
            evType: savedRecord.evType || "",
            evDate: savedRecord.evDate || "",
            guests: savedRecord.wGuests || savedRecord.hGuests || "",
            source: "Invoice Draft",
            stage: "New Enquiry",
            followDate,
            assigned: curUser || "admin",
            notes: `Saved as draft from invoice ${savedRecord.num}. Follow up to confirm booking.`,
            createdAt: new Date().toISOString(),
          };
          setLeads(prev => [...prev, crmLead]);
        }
      }
    }

    void persistHallInvoiceBundle(savedRecord)
      .then((result) => {
        if (result?.skipped) return;
        if (result?.invoice && result.invoice.id !== savedRecord.id) {
          setInvoices((prev) =>
            prev.map((i) => (i.id === savedRecord.id ? result.invoice : i)),
          );
          if (andView) setDetailInv(result.invoice);
        }
      })
      .catch((err) => {
        console.error("Failed to sync hall invoice to Supabase:", err);
        notify(
          `Saved locally, but Supabase sync failed: ${err?.message || "unknown error"}`,
          "error",
        );
      });

    if (andView) {
      setDetailInv(savedRecord);
      setView("detail");
      setEditInv(null);
      return;
    }
    // Keep editing the same now-saved record (rather than resetting to a blank form) —
    // a saved draft must stay loaded until the manager explicitly clears or confirms it.
    setEditInv(savedRecord);
    setFormKey((k) => k + 1);
    setView("form");
  }

  function startDelete(inv) {
    setDeleteModal(inv);
    setDelPass("");
  }
  function confirmDelete() {
    if (!checkHallAdminPass(delPass)) {
      notify("Incorrect password", "error");
      return;
    }
    setInvoices((prev) => prev.filter((i) => i.id !== deleteModal.id));
    void deleteHallInvoiceFromSupabase(deleteModal.id).catch((err) => {
      console.error("Failed to delete hall invoice from Supabase:", err);
    });
    notify("Invoice deleted", "success");
    logEvent(
      "hall",
      "invoice_deleted",
      {
        num: deleteModal.num,
        client: deleteModal.client,
        amount: deleteModal.grand,
      },
      curUser,
    );
    setDeleteModal(null);
    if (view === "detail") backToForm();
  }

  const filtered = useMemo(() => {
    let list = [...invoices].sort((a, b) =>
      (b.id || "") > (a.id || "") ? 1 : -1,
    );
    if (search)
      list = list.filter(
        (i) =>
          i.client?.toLowerCase().includes(search.toLowerCase()) ||
          i.phone?.includes(search) ||
          i.num?.includes(search),
      );
    if (filterType) list = list.filter((i) => i.evType === filterType);
    if (filterStatus) list = list.filter((i) => i.payStatus === filterStatus);
    // Drafts/leads with no event date set yet always stay visible, regardless of the month filter —
    // a saved-but-incomplete invoice must never disappear from history until cleared or deleted.
    if (filterMonth)
      list = list.filter((i) => !i.evDate || i.evDate.startsWith(filterMonth));
    return list;
  }, [invoices, search, filterType, filterStatus, filterMonth]);

  if (view === "form")
    return (
      <>
        {/* ── Unpaid Past Events Alert ── */}
        {unpaidPastEvents.length > 0 && (
          <div style={{
            background:"#c0392b", borderRadius:12, padding:"14px 18px",
            margin: isMobile ? "10px 8px" : "10px 28px 0",
            border:"3px solid #922b21",
            boxShadow:"0 4px 20px rgba(192,57,43,.4)",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:22 }}>🚨</span>
              <div>
                <div style={{ color:"#fff", fontWeight:800, fontSize:15 }}>
                  PAYMENT OVERDUE — {unpaidPastEvents.length} event{unpaidPastEvents.length>1?"s":""} with unpaid balance!
                </div>
                <div style={{ color:"rgba(255,255,255,.85)", fontSize:12, marginTop:2 }}>
                  The following events have already happened but full payment has not been collected.
                </div>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {unpaidPastEvents.map(inv => {
                const bal = inv.balance ?? Math.max(0, (inv.grand||0) - (parseFloat(inv.adv)||0));
                return (
                  <div key={inv.id} style={{
                    background:"rgba(0,0,0,.25)", borderRadius:8,
                    padding:"10px 14px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
                  }}>
                    <div style={{ flex:1, minWidth:180 }}>
                      <div style={{ color:"#fff", fontWeight:700, fontSize:13 }}>
                        {inv.client} — {inv.evType}
                      </div>
                      <div style={{ color:"rgba(255,255,255,.75)", fontSize:11, marginTop:2 }}>
                        📅 Event: {inv.evDate || inv.hDate} &nbsp;·&nbsp; Invoice: {inv.num}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ color:"#ffd700", fontWeight:900, fontSize:16 }}>
                        ৳{bal.toLocaleString()} due
                      </div>
                      <div style={{ color:"rgba(255,255,255,.65)", fontSize:10 }}>
                        {inv.payStatus === "Partial" ? "Partially paid" : "Not paid"}
                      </div>
                    </div>
                    <button
                      onClick={() => { setDetailInv(inv); setView("detail"); }}
                      style={{
                        background:"#fff", color:"#c0392b", border:"none",
                        borderRadius:8, padding:"8px 14px", fontWeight:800,
                        fontSize:12, cursor:"pointer", fontFamily:"inherit", flexShrink:0,
                      }}>
                      View Invoice →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <InvForm
          key={formKey}
          inv={currentForm}
          onSave={(d, lead) => computeAndSave(d, lead, false)}
          onSavePreview={(d, lead) => computeAndSave(d, lead, true)}
          onCancel={requestClear}
          onViewHistory={openHistory}
          notify={notify}
          isMobile={isMobile}
          invoices={invoices}
          invoiceCount={invoices.length}
        />
        {clearConfirm && (
          <div
            className="modal-overlay open"
            onClick={(e) =>
              e.target === e.currentTarget && setClearConfirm(false)
            }
          >
            <div className="modal-box" style={{ maxWidth: 380 }}>
              <div className="modal-header">
                <div className="modal-title">🗑 Clear Invoice Form</div>
                <button
                  className="modal-close"
                  onClick={() => setClearConfirm(false)}
                >
                  ✕
                </button>
              </div>
              <p style={{ fontSize: 13, color: "#555", margin: "4px 0 16px" }}>
                This will erase everything you've entered in this form. This
                cannot be undone. Are you sure?
              </p>
              <div className="modal-actions">
                <button className="btn" onClick={() => setClearConfirm(false)}>
                  Cancel
                </button>
                <button
                  className="btn primary"
                  onClick={confirmClear}
                  style={{ background: C.red, borderColor: C.red }}
                >
                  Yes, Clear It
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  if (view === "detail")
    return (
      <InvDetail
        inv={detailInv}
        setDetailInv={setDetailInv}
        onEdit={() => openEdit(detailInv)}
        onBack={() => setView("list")}
        onDelete={() => startDelete(detailInv)}
        deleteModal={deleteModal}
        delPass={delPass}
        setDelPass={setDelPass}
        confirmDelete={confirmDelete}
        setDeleteModal={setDeleteModal}
        notify={notify}
        setInvoices={setInvoices}
        invoices={invoices}
        leads={leads}
        setLeads={setLeads}
        getNextNum={nextAchNum}
        curUser={curUser}
        isMobile={isMobile}
      />
    );

  // ── Invoice History (list) ─────────────────────────────────────────────────
  const totBilled = invoices.reduce((s, i) => s + (i.grand || 0), 0);
  const totCollect = invoices.reduce((s, i) => s + (parseFloat(i.adv) || 0), 0);
  const totOut = invoices.reduce(
    (s, i) => s + Math.max(0, (i.grand || 0) - (parseFloat(i.adv) || 0)),
    0,
  );

  return (
    <div
      className="hall-page"
      style={{
        padding: isMobile ? "10px 8px" : "22px 32px",
        maxWidth: 1300,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        className="hall-btn-row"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <button
            onClick={backToForm}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: C.maroon,
              fontSize: 13,
              fontWeight: 700,
              padding: 0,
              marginBottom: 4,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ‹ Back to Create Invoice
          </button>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              fontFamily: "'Playfair Display',serif",
              color: C.maroon,
            }}
          >
            Invoice History
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>
            {invoices.length} total invoices
          </div>
        </div>
        <button onClick={openNew} style={btnStyle("primary")}>
          ＋ New Invoice
        </button>
      </div>

      {/* Stats */}
      <div
        className="hall-stat-grid"
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)",
          gap: 10,
          marginBottom: 18,
        }}
      >
        {[
          ["Total Invoices", invoices.length, "📄", C.maroon],
          ["Total Billed", "৳" + totBilled.toLocaleString(), "💰", C.gold],
          ["Collected", "৳" + totCollect.toLocaleString(), "✅", C.green],
          ["Outstanding", "৳" + totOut.toLocaleString(), "⏳", C.red],
        ].map(([l, v, ic, c]) => (
          <div key={l} style={card({ padding: "14px", textAlign: "center" })}>
            <div style={{ fontSize: 20 }}>{ic}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: C.dim }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="hall-filter-bar"
        style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search by name, phone, invoice #..."
          style={{ flex: 1, minWidth: 160, ...inputStyle() }}
        />
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          title="Filter by event month"
          style={inputStyle({ maxWidth: 170 })}
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={inputStyle({ maxWidth: 160 })}
        >
          <option value="">All Types</option>
          {EV_TYPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.i} {t.v}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={inputStyle({ maxWidth: 140 })}
        >
          <option value="">All Status</option>
          {["Unpaid", "Partial", "Paid", "Cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {(search || filterMonth || filterType || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterMonth("");
              setFilterType("");
              setFilterStatus("");
            }}
            style={{
              padding: "0 12px",
              borderRadius: 8,
              border: "1.5px solid #e5e3de",
              background: "#fff5f5",
              color: "#900",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ✕ Clear
          </button>
        )}
      </div>
      {filtered.length < invoices.length && (
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>
          Showing {filtered.length} of {invoices.length} invoices
        </div>
      )}

      {/* Table */}
      <div style={card({ padding: 0 })}>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: C.dim }}>
            No invoices found
          </div>
        )}
        {filtered.map((inv, i) => {
          const et = EV_TYPES.find((t) => t.v === inv.evType);
          const bal = Math.max(
            0,
            (inv.grand || 0) - (parseFloat(inv.adv) || 0),
          );
          const sc = {
            Paid: C.green,
            Partial: C.gold,
            Unpaid: C.red,
            Cancelled: C.dim,
          };
          return (
            <div
              key={inv.id}
              onClick={() => openDetail(inv)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid " + C.border,
                background: i % 2 ? "#faf9f7" : "",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: et?.bg || "#eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  flexShrink: 0,
                  border: "1.5px solid " + (et?.border || "#ccc"),
                }}
              >
                {et?.i}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>
                  {inv.client}
                  <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>
                    {" "}
                    #{inv.num}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  {inv.evType} · {fmtDate(inv.evDate)}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>
                  ৳{(inv.grand || 0).toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: sc[inv.payStatus] || C.dim,
                  }}
                >
                  {inv.payStatus}
                </div>
              </div>
              {(inv.isLead || !inv.confirmed) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(inv);
                  }}
                  style={btnStyle("sm")}
                >
                  ✏️
                </button>
              )}
            </div>
          );
        })}
      </div>

      {deleteModal && (
        <DeleteModal
          modal={deleteModal}
          delPass={delPass}
          setDelPass={setDelPass}
          onConfirm={confirmDelete}
          onClose={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}

// ─── Invoice Form ─────────────────────────────────────────────────────────────
const TOGGLABLE_SVCS = ["Stage Decoration", "Lighting Decoration"];

function TimeInput({ fieldKey, mode, placeholder, d, set }) {
  return (
    <input
      value={d[fieldKey] || ""}
      onChange={(e) => set(fieldKey, e.target.value)}
      onBlur={(e) => {
        const v = smartTime(e.target.value, mode);
        if (v !== e.target.value) set(fieldKey, v);
      }}
      placeholder={placeholder}
      style={inputStyle()}
    />
  );
}

function InvForm({
  inv,
  onSave,
  onSavePreview,
  onCancel,
  onViewHistory,
  notify,
  invoiceCount,
  isMobile,
  invoices,
}) {
  const [d, setD] = useState(() => ({ ...inv }));
  const imgRef = useRef();
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [reasonDraft, setReasonDraft] = useState({});
  const [pendingNo, setPendingNo] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (k, v) => {
    setD((p) => ({ ...p, [k]: v }));
    if (fieldErrors[k]) setFieldErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  function validate(d, isLead) {
    if (isLead) {
      if (!d.client?.trim()) {
        setFieldErrors({ client: true });
        notify?.("Client name is required", "error");
        setTimeout(() => document.getElementById("field-client")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        return false;
      }
      return true;
    }

    const errors = {};

    if (!d.client?.trim())     errors.client   = "Client name is required";
    if (!d.phone?.trim())      errors.phone    = "Phone number is required";
    if (!d.evDate && !d.hDate) errors.evDate   = "Event date is required";
    if (!d.addrArea?.trim() && !d.addrCity?.trim() && !d.addrDistrict?.trim())
                               errors.addrArea = "At least one address field is required";

    const isWeddingType = ["Wedding","Wedding + Holud"].includes(d.evType);
    const isHoludType   = ["Holud","Wedding + Holud"].includes(d.evType);

    if (isWeddingType && !d.wRental) errors.wRental = "Wedding Hall Rental amount is required";
    if (isHoludType   && !d.hRental) errors.hRental = "Holud Hall Rental amount is required";

    if (isWeddingType || isHoludType) {
      if (!d.wBride?.trim() && !d.hBride?.trim()) errors.wBride = "Bride's name is required";
      if (!d.wGroom?.trim() && !d.hGroom?.trim()) errors.wGroom = "Groom's name is required";
    }

    if (evDateConflict && !conflictConfirmed.ev) errors.conflictEv = "Confirm the date conflict";
    if (hDateConflict  && !conflictConfirmed.h)  errors.conflictH  = "Confirm the Holud date conflict";

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const missing = Object.values(errors);
      notify?.(`Please fix ${missing.length} issue${missing.length > 1 ? "s" : ""}: ${missing[0]}${missing.length > 1 ? ` (+${missing.length - 1} more)` : ""}`, "error");
      // Scroll to first error field
      const firstKey = Object.keys(errors)[0];
      setTimeout(() => {
        const el = document.getElementById("field-" + firstKey);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return false;
    }

    setFieldErrors({});
    return true;
  }


  const fixedSvcsAll = d.services.filter((s) => s.fixed);
  const customSvcs = d.services.filter((s) => !s.fixed);

  function setFixedRate(desc, rate) {
    setD((p) => ({
      ...p,
      services: p.services.map((s) =>
        s.desc === desc ? { ...s, rate: parseFloat(rate) || 0 } : s,
      ),
    }));
  }
  function setFixedIncluded(desc, included) {
    setD((p) => ({
      ...p,
      services: p.services.map((s) =>
        s.desc === desc ? { ...s, included } : s,
      ),
    }));
  }
  function setFixedReason(desc, reason) {
    setD((p) => ({
      ...p,
      services: p.services.map((s) =>
        s.desc === desc ? { ...s, declineReason: reason } : s,
      ),
    }));
  }
  function confirmNo(desc) {
    const reason = (reasonDraft[desc] || "").trim();
    if (!reason) return;
    setFixedIncluded(desc, false);
    setFixedReason(desc, reason);
    setPendingNo(null);
    setReasonDraft((r) => ({ ...r, [desc]: "" }));
  }
  function cancelNo(desc) {
    setPendingNo(null);
    setReasonDraft((r) => ({ ...r, [desc]: "" }));
  }
  function clickNo(desc) {
    // If already No, allow toggling reason panel open again
    setPendingNo(desc);
    const existing =
      d.services.find((s) => s.desc === desc)?.declineReason || "";
    setReasonDraft((r) => ({ ...r, [desc]: existing }));
    // Temporarily reset to null so save stays blocked until reason confirmed
    setFixedIncluded(desc, null);
  }
  function addCustom() {
    setD((p) => ({
      ...p,
      services: [...p.services, { desc: "", rate: 0, qty: 1 }],
    }));
  }
  function removeCustom(idx) {
    setD((p) => {
      let ci = -1;
      return {
        ...p,
        services: p.services.filter((s) => {
          if (s.fixed) return true;
          ci++;
          return ci !== idx;
        }),
      };
    });
  }
  function setCustom(idx, k, v) {
    setD((p) => {
      let ci = -1;
      return {
        ...p,
        services: p.services.map((s) => {
          if (s.fixed) return s;
          ci++;
          return ci === idx ? { ...s, [k]: v } : s;
        }),
      };
    });
  }

  const svcSub = calcSub(d.services);
  const extras = calcExtras(d);
  const wWaiterTotal = extras.wWaiters;
  const hWaiterTotal = extras.hWaiters;
  const waiterTotal = wWaiterTotal + hWaiterTotal;
  const discount = parseFloat(d.discount) || 0;
  const hallTotal = Math.max(
    0,
    svcSub + extras.wRental + extras.hRental - discount,
  );
  const grand = hallTotal; // hall revenue only — waiter cost tracked separately below
  const totalPayable = hallTotal + waiterTotal; // what the guest pays in total, informational
  const adv = parseFloat(d.adv) || 0;
  const balance = Math.max(0, grand - adv);
  const payStatus =
    grand === 0
      ? "Unpaid"
      : balance === 0
        ? "Paid"
        : adv > 0
          ? "Partial"
          : "Unpaid";
  const psStyle = PS_STYLE[payStatus];

  const waiterPaid = parseFloat(d.waiterCostPaid ?? d.waiterPaid) || 0;
  const waiterBalance = Math.max(0, waiterTotal - waiterPaid);
  const waiterPayStatus =
    waiterTotal === 0
      ? "Unpaid"
      : waiterBalance === 0
        ? "Paid"
        : waiterPaid > 0
          ? "Partial"
          : "Unpaid";
  const waiterPsStyle = PS_STYLE[waiterPayStatus];

  const et = EV_TYPES.find((t) => t.v === d.evType);
  const isWedding = et?.g === "wedding" || et?.v === "Wedding + Holud";
  const isHolud = et?.v === "Holud" || et?.v === "Wedding + Holud";
  const isWH = et?.v === "Wedding + Holud";
  const isGeneric = et?.g === "generic";

  const fixedSvcs =
    isWedding || isHolud
      ? fixedSvcsAll.filter((s) => s.desc !== "Hall Rental")
      : fixedSvcsAll;

  const todayStr = new Date().toISOString().slice(0, 10);

  function findBookingConflict(dateStr) {
    if (!dateStr) return null;
    return (
      (invoices || []).find(
        (i) =>
          i.id &&
          i.id !== d.id &&
          !i.isLead &&
          ((i.evDate && i.evDate === dateStr) ||
            (i.hDate && i.hDate === dateStr)),
      ) || null
    );
  }
  const evDateConflict = findBookingConflict(d.evDate);
  const hDateConflict = findBookingConflict(d.hDate);

  function handleImg(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("stageImgData", ev.target.result);
    reader.readAsDataURL(file);
    set("stageImgName", file.name);
  }
  function clearImg() {
    set("stageImgData", "");
    set("stageImgName", "");
    if (imgRef.current) imgRef.current.value = "";
  }

  const voterIdRef = useRef(null);
  function handleVoterId(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => set("voterIdData", ev.target.result);
    reader.readAsDataURL(file);
    set("voterIdName", file.name);
  }
  function clearVoterId() {
    set("voterIdData", "");
    set("voterIdName", "");
    if (voterIdRef.current) voterIdRef.current.value = "";
  }

  const RELIGIONS = [
    "—",
    "Islam",
    "Hinduism",
    "Christianity",
    "Buddhism",
    "Other",
  ];
  const RELATIONS = [
    {
      label: "Bride's Side",
      opts: [
        "Bride Herself",
        "Bride's Father",
        "Bride's Mother",
        "Bride's Brother",
        "Bride's Sister",
        "Bride's Uncle",
        "Bride's Guardian",
      ],
    },
    {
      label: "Groom's Side",
      opts: [
        "Groom Himself",
        "Groom's Father",
        "Groom's Mother",
        "Groom's Brother",
        "Groom's Sister",
        "Groom's Uncle",
        "Groom's Guardian",
      ],
    },
    { label: "Other", opts: ["Friend of Family", "Event Organiser", "Other"] },
  ];

  const [conflictConfirmed, setConflictConfirmed] = useState({ ev: false, h: false });

  function ConflictWarning({ conflict, field }) {
    if (!conflict) return null;
    const confirmed = conflictConfirmed[field];
    return (
      <div style={{
        background: confirmed ? "#f0fff4" : "#fff0f0",
        border: `2px solid ${confirmed ? "#2e8b57" : "#c0392b"}`,
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <span style={{ fontSize: 24, lineHeight: 1 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: "#7B1212", marginBottom: 4 }}>
              DATE ALREADY BOOKED!
            </div>
            <div style={{ fontSize: 12, color: "#5a0000", lineHeight: 1.6 }}>
              <strong>Invoice #{conflict.num}</strong> — {conflict.client} ({conflict.evType}) is already booked on this date.
              <br />Double-booking may cause serious issues. Please verify before proceeding.
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConflictConfirmed(prev => ({ ...prev, [field]: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: "#2e8b57", cursor: "pointer" }}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: confirmed ? "#1a5c30" : "#7B1212" }}>
                {confirmed ? "✅ Confirmed — I acknowledge this double-booking" : "I understand and confirm this booking despite the conflict"}
              </span>
            </label>
          </div>
        </div>
      </div>
    );
  }

  function renderWeddingCard() {
    return (
      <div
        key="wedding-card"
        style={{ ...card(), borderLeft: "4px solid " + C.maroon }}
      >
        <div style={{ marginBottom: 14 }}>
          <span style={sectionBadge()}>
            {et?.i || "💒"} WEDDING EVENT DETAILS
          </span>
        </div>

        <SubSection label="👥 EVENT DETAILS">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: 12,
            }}
          >
            <Field label="Guests *">
              <input
                type="number"
                value={d.wGuests || ""}
                onChange={(e) => set("wGuests", e.target.value)}
                placeholder="e.g. 300"
                style={inputStyle()}
              />
            </Field>
          </div>
        </SubSection>

        <SubSection label="🪑 TABLES & WAITERS">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
              gap: 12,
            }}
          >
            <Field label="Tables">
              <input
                type="number"
                value={d.wTables || ""}
                onChange={(e) => set("wTables", e.target.value)}
                placeholder="0"
                style={inputStyle()}
              />
            </Field>
            <Field label="Waiters">
              <input
                type="number"
                value={d.wWaiters || ""}
                onChange={(e) => set("wWaiters", e.target.value)}
                placeholder="0"
                style={inputStyle()}
              />
            </Field>
            <Field label="Price / Waiter (৳)">
              <input
                type="text"
                inputMode="numeric"
                value={d.wWaiterPrice || ""}
                onChange={(e) => set("wWaiterPrice", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                style={inputStyle()}
              />
            </Field>
            <Field label="Waiters Total (auto)">
              <input
                readOnly
                value={
                  wWaiterTotal > 0 ? "৳" + wWaiterTotal.toLocaleString() : ""
                }
                placeholder="0"
                style={inputStyle({ background: "#f8f8f8" })}
              />
            </Field>
          </div>
        </SubSection>

        <SubSection label="🏛️ WEDDING / HALL RENTAL">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: "#fffaf0",
              border: `2px solid ${C.gold}`,
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#8a6200",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
              }}
            >
              Wedding / Hall Rental (৳) *
            </label>
            <input
              id="field-wRental"
              type="number"
              min="0"
              value={d.wRental || ""}
              onChange={(e) => set("wRental", e.target.value)}
              placeholder="0"
              style={{
                width: 160,
                padding: "8px 12px",
                border: `2px solid ${fieldErrors.wRental ? "#c0392b" : C.gold}`,
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 800,
                textAlign: "right",
                fontFamily: "inherit",
                outline: "none",
                background: "#fff",
                color: C.maroon,
                boxShadow: "0 2px 8px rgba(201,168,76,.2)",
              }}
            />
          </div>
        </SubSection>
      </div>
    );
  }

  function renderHoludCard() {
    return (
      <div
        key="holud-card"
        style={{ ...card(), borderLeft: "4px solid #d4a800" }}
      >
        <div style={{ marginBottom: 14 }}>
          <span style={{ ...sectionBadge(), background: "#8a6200" }}>
            🌼 {isWH ? "HOLUD PROGRAMME DETAILS" : "HOLUD EVENT DETAILS"}
          </span>
        </div>
        {isWH && (
          <p style={{ fontSize: 12, color: "#c97f00", marginBottom: 12 }}>
            Holud is a separate ceremony — its charge is listed separately in
            the bill.
          </p>
        )}

        <SubSection label="👥 EVENT DETAILS">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: 12,
            }}
          >
            <Field label="Guests *">
              <input
                type="number"
                value={d.hGuests || ""}
                onChange={(e) => set("hGuests", e.target.value)}
                placeholder="e.g. 150"
                style={inputStyle()}
              />
            </Field>
            <Field label="Tables">
              <input
                type="number"
                value={d.hTables || ""}
                onChange={(e) => set("hTables", e.target.value)}
                placeholder="0"
                style={inputStyle()}
              />
            </Field>
          </div>
        </SubSection>

        <SubSection label="🪑 WAITERS">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
              gap: 12,
            }}
          >
            <Field label="Waiters">
              <input
                type="number"
                value={d.hWaiters || ""}
                onChange={(e) => set("hWaiters", e.target.value)}
                placeholder="0"
                style={inputStyle()}
              />
            </Field>
            <Field label="Price / Waiter (৳)">
              <input
                type="text"
                inputMode="numeric"
                value={d.hWaiterPrice || ""}
                onChange={(e) => set("hWaiterPrice", e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="0"
                style={inputStyle()}
              />
            </Field>
            <Field label="Waiters Total (auto)">
              <input
                readOnly
                value={
                  hWaiterTotal > 0 ? "৳" + hWaiterTotal.toLocaleString() : ""
                }
                placeholder="0"
                style={inputStyle({ background: "#f8f8f8" })}
              />
            </Field>
          </div>
        </SubSection>

        <SubSection label="🏛️ HOLUD / HALL RENTAL">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              background: "#fffaf0",
              border: `2px solid ${C.gold}`,
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <label
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#8a6200",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
              }}
            >
              Holud / Hall Rental (৳) *
            </label>
            <input
              id="field-hRental"
              type="number"
              min="0"
              value={d.hRental || ""}
              onChange={(e) => set("hRental", e.target.value)}
              placeholder="0"
              style={{
                width: 160,
                padding: "8px 12px",
                border: `2px solid ${fieldErrors.hRental ? "#c0392b" : C.gold}`,
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 800,
                textAlign: "right",
                fontFamily: "inherit",
                outline: "none",
                background: "#fff",
                color: "#8a6200",
                boxShadow: "0 2px 8px rgba(201,168,76,.2)",
              }}
            />
          </div>
        </SubSection>
      </div>
    );
  }

  return (
    <div
      className="hall-page"
      style={{
        padding: isMobile ? "10px 8px" : "22px 32px",
        maxWidth: 1200,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        className="hall-btn-row"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "'Playfair Display',serif",
              color: C.maroon,
              margin: 0,
            }}
          >
            {d.id ? "Edit Invoice" : "Create Invoice"}
          </h2>
          <p style={{ fontSize: 12, color: C.dim, margin: "4px 0 0" }}>
            Serial-locked, fully traceable invoices.
          </p>
        </div>
        {onViewHistory && (
          <button onClick={onViewHistory} style={btnStyle()}>
            📋 Invoice History
          </button>
        )}
      </div>

      {/* ── INVOICE DETAILS ── */}
      <Section label="INVOICE DETAILS">
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
        >
          <Field label="Invoice Number">
            <input
              readOnly
              value={d.num}
              style={inputStyle({
                background: "#fffdf0",
                borderColor: "#d4a800",
                color: C.maroon,
                fontWeight: 700,
              })}
            />
          </Field>
          <Field label="Invoice Date">
            <input
              readOnly
              value={fmtDate(d.invDate)}
              style={inputStyle({
                background: "#fffdf0",
                borderColor: "#d4a800",
              })}
            />
          </Field>
        </div>
      </Section>

      {/* ── EVENT TYPE ── */}
      <Section label="EVENT TYPE">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(85px,1fr))",
            gap: 10,
          }}
        >
          {EV_TYPES.map((t) => {
            const sel = d.evType === t.v;
            return (
              <button
                key={t.v}
                onClick={() => set("evType", t.v)}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "20px 8px 14px",
                  borderRadius: 14,
                  gap: 7,
                  cursor: "pointer",
                  border: `2px solid ${sel ? t.accent : "#e5e3de"}`,
                  background: sel
                    ? `linear-gradient(160deg, ${t.bg} 0%, ${t.accent}18 100%)`
                    : "#fff",
                  boxShadow: sel
                    ? `0 0 0 3px ${t.accent}30, 0 6px 18px ${t.accent}25`
                    : "0 1px 3px rgba(0,0,0,.06)",
                  transform: sel ? "translateY(-3px) scale(1.03)" : "none",
                  transition: "all .22s cubic-bezier(.34,1.56,.64,1)",
                  overflow: "hidden",
                }}
              >
                {sel && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: t.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#fff",
                      fontWeight: 900,
                    }}
                  >
                    ✓
                  </span>
                )}
                <span
                  style={{
                    fontSize: 28,
                    filter: sel ? "none" : "grayscale(.3)",
                    transition: ".2s",
                  }}
                >
                  {t.i}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                    color: sel ? t.accent : "#aaa",
                    transition: ".2s",
                  }}
                >
                  {t.v}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── DATE & TIME (quick pick — shown right after event type) ── */}
      {d.evType && (
        <Section label="📅 DATE & TIME">
          {isWH ? (
            /* Wedding + Holud — two rows side by side */
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              {/* Holud */}
              <div style={{ background:"#fffbe8", border:"1.5px solid #d4a800", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#8a6200", marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>🌼 Holud Date & Time</div>
                <ConflictWarning conflict={hDateConflict} field="h" />
                <Field label="Holud Date *">
                  <input type="date" min={todayStr} value={d.hDate || ""}
                    onChange={e => set("hDate", e.target.value)}
                    style={inputStyle(hDateConflict ? { borderColor:"#f0b429" } : {})} />
                </Field>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
                  <Field label="Start Time 🌙">
                    <TimeInput fieldKey="hStart" mode="holud-start" placeholder="e.g. 7 → 7:00 PM" d={d} set={set} />
                  </Field>
                  <Field label="End Time">
                    <TimeInput fieldKey="hEnd" mode="holud-end" placeholder="e.g. 3 → 3:00 AM" d={d} set={set} />
                  </Field>
                </div>
              </div>
              {/* Wedding */}
              <div style={{ background:"#fff0f0", border:"1.5px solid #e07070", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#7B1212", marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>💒 Wedding Date & Time</div>
                <ConflictWarning conflict={evDateConflict} field="ev" />
                <Field label="Wedding Date *">
                  <input type="date" min={todayStr} value={d.evDate || ""}
                    onChange={e => set("evDate", e.target.value)}
                    style={inputStyle(fieldErrors.evDate ? { borderColor:"#c0392b", background:"#fff5f5" } : evDateConflict ? { borderColor:"#f0b429" } : {})} />
                  {fieldErrors.evDate && <div style={{ color:"#c0392b", fontSize:11, marginTop:4, fontWeight:700 }}>⚠ {fieldErrors.evDate}</div>}
                </Field>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginTop:10 }}>
                  <Field label="Time of Day">
                    <select value={d.wTod || ""} onChange={e => set("wTod", e.target.value)} style={inputStyle()}>
                      <option value="">—</option>
                      <option value="day">☀️ Day</option>
                      <option value="night">🌙 Night</option>
                    </select>
                  </Field>
                  <Field label="Start Time">
                    <TimeInput fieldKey="wStart" d={d} set={set}
                      mode={d.wTod === "night" ? "night-start" : "day"}
                      placeholder={d.wTod === "night" ? "e.g. 7 → 7:00 PM" : "e.g. 10 → 10:00 AM"} />
                  </Field>
                  <Field label="End Time">
                    <TimeInput fieldKey="wEnd" d={d} set={set}
                      mode={d.wTod === "night" ? "night-end" : "day"}
                      placeholder={d.wTod === "night" ? "e.g. 3 → 3:00 AM" : "e.g. 4 → 4:00 PM"} />
                  </Field>
                </div>
              </div>
            </div>
          ) : isHolud ? (
            /* Holud only — single row */
            <div style={{ background:"#fffbe8", border:"1.5px solid #d4a800", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:"#8a6200", marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>🌼 Holud Date & Time</div>
              <ConflictWarning conflict={hDateConflict} field="h" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                <Field label="Holud Date *">
                  <input type="date" min={todayStr} value={d.hDate || ""}
                    onChange={e => set("hDate", e.target.value)}
                    style={inputStyle(hDateConflict ? { borderColor:"#f0b429" } : {})} />
                </Field>
                <Field label="Start Time 🌙">
                  <TimeInput fieldKey="hStart" mode="holud-start" placeholder="e.g. 7 → 7:00 PM" d={d} set={set} />
                </Field>
                <Field label="End Time">
                  <TimeInput fieldKey="hEnd" mode="holud-end" placeholder="e.g. 3 → 3:00 AM" d={d} set={set} />
                </Field>
              </div>
            </div>
          ) : isWedding ? (
            /* Wedding / Reception / Engagement — single row */
            <div style={{ background:"#fff0f0", border:"1.5px solid #e07070", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:"#7B1212", marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>💒 Event Date & Time</div>
              <ConflictWarning conflict={evDateConflict} field="ev" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                <Field label="Event Date *">
                  <input type="date" min={todayStr} value={d.evDate || ""}
                    onChange={e => set("evDate", e.target.value)}
                    style={inputStyle(fieldErrors.evDate ? { borderColor:"#c0392b", background:"#fff5f5" } : evDateConflict ? { borderColor:"#f0b429" } : {})} />
                  {fieldErrors.evDate && <div style={{ color:"#c0392b", fontSize:11, marginTop:4, fontWeight:700 }}>⚠ {fieldErrors.evDate}</div>}
                </Field>
                <Field label="Time of Day">
                  <select value={d.wTod || ""} onChange={e => set("wTod", e.target.value)} style={inputStyle()}>
                    <option value="">—</option>
                    <option value="day">☀️ Day</option>
                    <option value="night">🌙 Night</option>
                  </select>
                </Field>
                <Field label="Start Time">
                  <TimeInput fieldKey="wStart" d={d} set={set}
                    mode={d.wTod === "night" ? "night-start" : "day"}
                    placeholder={d.wTod === "night" ? "e.g. 7 → 7:00 PM" : "e.g. 10 → 10:00 AM"} />
                </Field>
                <Field label="End Time">
                  <TimeInput fieldKey="wEnd" d={d} set={set}
                    mode={d.wTod === "night" ? "night-end" : "day"}
                    placeholder={d.wTod === "night" ? "e.g. 3 → 3:00 AM" : "e.g. 4 → 4:00 PM"} />
                </Field>
              </div>
            </div>
          ) : (
            /* Generic events — Birthday, Corporate, Others */
            <div style={{ background:"#f0fff4", border:"1.5px solid #30a060", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:11, fontWeight:800, color:"#1a7040", marginBottom:10, letterSpacing:1, textTransform:"uppercase" }}>🎉 Event Date & Time</div>
              <ConflictWarning conflict={evDateConflict} field="ev" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12 }}>
                <Field label="Event Date *">
                  <input type="date" min={todayStr} value={d.evDate || ""}
                    onChange={e => set("evDate", e.target.value)}
                    style={inputStyle(fieldErrors.evDate ? { borderColor:"#c0392b", background:"#fff5f5" } : evDateConflict ? { borderColor:"#f0b429" } : {})} />
                  {fieldErrors.evDate && <div style={{ color:"#c0392b", fontSize:11, marginTop:4, fontWeight:700 }}>⚠ {fieldErrors.evDate}</div>}
                </Field>
                <Field label="Time of Day">
                  <select value={d.wTod || ""} onChange={e => set("wTod", e.target.value)} style={inputStyle()}>
                    <option value="">—</option>
                    <option value="day">☀️ Day</option>
                    <option value="night">🌙 Night</option>
                  </select>
                </Field>
                <Field label="Start Time">
                  <TimeInput fieldKey="wStart" d={d} set={set}
                    mode={d.wTod === "night" ? "night-start" : "day"}
                    placeholder={d.wTod === "night" ? "e.g. 7 → 7:00 PM" : "e.g. 10 → 10:00 AM"} />
                </Field>
                <Field label="End Time">
                  <TimeInput fieldKey="wEnd" d={d} set={set}
                    mode={d.wTod === "night" ? "night-end" : "day"}
                    placeholder={d.wTod === "night" ? "e.g. 3 → 3:00 AM" : "e.g. 4 → 4:00 PM"} />
                </Field>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── CLIENT INFORMATION ── */}
      <Section label="CLIENT INFORMATION">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
          }}
        >
          <Field label="Client Name *">
            <input
              id="field-client"
              value={d.client}
              onChange={(e) => set("client", e.target.value)}
              placeholder="Client Name *"
              style={{ ...inputStyle(), ...(fieldErrors.client ? { borderColor: "#c0392b", background: "#fff5f5" } : {}) }}
            />
            {fieldErrors.client && <div style={{ color: "#c0392b", fontSize: 11, marginTop: 4, fontWeight: 700 }}>⚠ {fieldErrors.client}</div>}
          </Field>
          <Field label="Phone *">
            <input
              id="field-phone"
              value={d.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
              style={{ ...inputStyle(), ...(fieldErrors.phone ? { borderColor: "#c0392b", background: "#fff5f5" } : {}) }}
            />
            {fieldErrors.phone && <div style={{ color: "#c0392b", fontSize: 11, marginTop: 4, fontWeight: 700 }}>⚠ {fieldErrors.phone}</div>}
          </Field>
          <Field label="Phone 2">
            <input
              value={d.phone2 || ""}
              onChange={(e) => set("phone2", e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
              style={inputStyle()}
            />
          </Field>
          <Field label="Email">
            <input
              value={d.email || ""}
              onChange={(e) => set("email", e.target.value)}
              placeholder="email@example.com"
              style={inputStyle()}
            />
          </Field>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            gap: 12,
            marginTop: 12,
          }}
        >
          <Field label="Area / Road">
            <input
              id="field-addrArea"
              value={d.addrArea || ""}
              onChange={(e) => set("addrArea", e.target.value)}
              placeholder="e.g. Agrabad, Hajari Road"
              style={{ ...inputStyle(), ...(fieldErrors.addrArea ? { borderColor: "#c0392b", background: "#fff5f5" } : {}) }}
            />
            {fieldErrors.addrArea && <div style={{ color: "#c0392b", fontSize: 11, marginTop: 4, fontWeight: 700 }}>⚠ {fieldErrors.addrArea}</div>}
          </Field>
          <Field label="City / Upazila">
            <input
              value={d.addrCity || ""}
              onChange={(e) => set("addrCity", e.target.value)}
              placeholder="e.g. Sitakunda"
              style={{ ...inputStyle(), ...(fieldErrors.addrArea ? { borderColor: "#c0392b", background: "#fff5f5" } : {}) }}
            />
          </Field>
          <Field label="District">
            <input
              value={d.addrDistrict || ""}
              onChange={(e) => set("addrDistrict", e.target.value)}
              placeholder="e.g. Chattogram"
              style={{ ...inputStyle(), ...(fieldErrors.addrArea ? { borderColor: "#c0392b", background: "#fff5f5" } : {}) }}
            />
          </Field>
        </div>

        {/* Voter ID Upload */}
        <div style={{ marginTop: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>
            🪪 Voter ID Card (optional)
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", background: C.gold, color: "#fff", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
              📷 Upload Image
              <input ref={voterIdRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleVoterId} />
            </label>
            <span style={{ fontSize: 12, color: "#666" }}>{d.voterIdName || "No image chosen"}</span>
            {d.voterIdData && (
              <button onClick={clearVoterId} style={{ fontSize: 11, color: "#c0392b", background: "none", border: "1px solid #c0392b", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>✕ Remove</button>
            )}
          </div>
          {d.voterIdData && (
            <div style={{ marginTop: 10 }}>
              <img src={d.voterIdData} alt="Voter ID" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 8, border: "2px solid " + C.border, objectFit: "contain" }} />
            </div>
          )}
        </div>
      </Section>

      {/* ── COUPLE DETAILS (shared across Wedding/Holud) ── */}
      {(isWedding || isHolud) && (
        <Section label="👰🤵 COUPLE DETAILS">
          <div style={{ marginBottom: 12 }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: C.text,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                display: "block",
                marginBottom: 8,
              }}
            >
              Client is from *
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["👰 Bride's Side", "🤵 Groom's Side", "🤝 Both Sides"].map(
                (opt) => {
                  const val = opt.replace(/^[^\s]+\s/, "");
                  return (
                    <button
                      key={val}
                      onClick={() => set("wSide", val)}
                      style={{
                        padding: "8px 18px",
                        borderRadius: 8,
                        border: "1.5px solid",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 700,
                        borderColor: d.wSide === val ? C.maroon : C.border,
                        background: d.wSide === val ? C.maroon : C.white,
                        color: d.wSide === val ? "#fff" : C.text,
                      }}
                    >
                      {opt}
                    </button>
                  );
                },
              )}
            </div>
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <Field label="Bride's Name *">
              <input
                id="field-wBride"
                value={d.wBride || ""}
                onChange={(e) => set("wBride", e.target.value)}
                style={{ ...inputStyle(), ...(fieldErrors.wBride ? { borderColor: "#c0392b", background: "#fff5f5" } : {}) }}
              />
              {fieldErrors.wBride && <div style={{ color: "#c0392b", fontSize: 11, marginTop: 4, fontWeight: 700 }}>⚠ {fieldErrors.wBride}</div>}
            </Field>
            <Field label="Bride's Religion">
              <select
                value={d.wBrideRel || ""}
                onChange={(e) => set("wBrideRel", e.target.value)}
                style={inputStyle()}
              >
                {RELIGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Groom's Name *">
              <input
                id="field-wGroom"
                value={d.wGroom || ""}
                onChange={(e) => set("wGroom", e.target.value)}
                style={{ ...inputStyle(), ...(fieldErrors.wGroom ? { borderColor: "#c0392b", background: "#fff5f5" } : {}) }}
              />
              {fieldErrors.wGroom && <div style={{ color: "#c0392b", fontSize: 11, marginTop: 4, fontWeight: 700 }}>⚠ {fieldErrors.wGroom}</div>}
            </Field>
            <Field label="Groom's Religion">
              <select
                value={d.wGroomRel || ""}
                onChange={(e) => set("wGroomRel", e.target.value)}
                style={inputStyle()}
              >
                {RELIGIONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                💑 Couple's WhatsApp Number{" "}
                <span style={{ fontSize: 11, color: C.dim, fontWeight: 400 }}>
                  (for anniversary wishes)
                </span>
              </label>
              <input
                value={d.wCouplePhone || ""}
                onChange={(e) => set("wCouplePhone", e.target.value)}
                placeholder="+880 1XXX-XXXXXX"
                style={inputStyle()}
              />
            </div>
            <Field label="Client's Relation *">
              <select
                value={d.wRelation || ""}
                onChange={(e) => set("wRelation", e.target.value)}
                style={inputStyle()}
              >
                <option value="">— Select —</option>
                {RELATIONS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.opts.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
          </div>
        </Section>
      )}

      {/* ── EVENT DETAILS — Holud first when both selected ── */}
      {isWH ? (
        <>
          {renderHoludCard()}
          {renderWeddingCard()}
        </>
      ) : isHolud ? (
        renderHoludCard()
      ) : isWedding ? (
        renderWeddingCard()
      ) : null}

      {/* ── GENERIC EVENT DETAILS ── */}
      {isGeneric && (
        <Section label="📋 EVENT DETAILS">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <Field label="Guests *">
              <input
                type="number"
                value={d.wGuests || ""}
                onChange={(e) => set("wGuests", e.target.value)}
                placeholder="e.g. 200"
                style={inputStyle()}
              />
            </Field>
          </div>
          <Field label="Event Title">
            <input
              value={d.genTitle || ""}
              onChange={(e) => set("genTitle", e.target.value)}
              placeholder="e.g. Birthday Party — 30th"
              style={inputStyle()}
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={d.genNote || ""}
              onChange={(e) => set("genNote", e.target.value)}
              rows={2}
              style={inputStyle()}
            />
          </Field>
        </Section>
      )}

      {/* ── SERVICES & CHARGES ── */}
      <div
        style={{
          borderRadius: 14,
          overflow: "hidden",
          boxShadow:
            "0 4px 24px rgba(123,18,18,.13), 0 1px 4px rgba(0,0,0,.07)",
          marginBottom: 18,
          border: "2px solid " + C.gold,
        }}
      >
        {/* Header bar */}
        <div
          style={{
            background:
              "linear-gradient(135deg,#7B1212 0%,#a52020 60%,#8a1515 100%)",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>💼</span>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#fff",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                Services &amp; Charges
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,.65)",
                  marginTop: 1,
                }}
              >
                Price editable · Description locked for fixed items
              </div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,.6)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Running Total
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: C.gold,
                lineHeight: 1.1,
              }}
            >
              ৳{totalPayable.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Service rows */}
        <div style={{ background: "#fff", padding: "6px 16px" }}>
          {fixedSvcs.map((s) => {
            const meta = SVC_ICONS[s.desc] || {};
            const togglable = s.desc !== "Hall Rental";
            const isExcluded = s.included === false;
            const isUnanswered = togglable && s.included === null;
            const rowBg = isUnanswered
              ? "#fffbf0"
              : isExcluded
                ? "#fff8f8"
                : "#fafdf7";
            const rowBorder = isUnanswered
              ? "#f0b429"
              : isExcluded
                ? "#f5c5c5"
                : "#d4edda";
            const accentClr = isUnanswered
              ? "#f0b429"
              : isExcluded
                ? C.red
                : meta.bg?.includes("7B1212")
                  ? C.maroon
                  : meta.bg?.includes("6030b0")
                    ? "#6030b0"
                    : "#1a7a40";
            const isHallRental = s.desc === "Hall Rental";
            return (
              <div
                key={s.desc}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: isHallRental ? "16px 10px" : "12px 10px",
                  margin: "6px 0",
                  borderRadius: 10,
                  background: isHallRental ? "#fffaf0" : rowBg,
                  border: `${isHallRental ? 3 : 2}px solid ${isHallRental ? C.gold : rowBorder}`,
                  position: "relative",
                  overflow: "hidden",
                  transition: "border-color .2s, background .2s",
                  boxShadow: isHallRental
                    ? "0 3px 12px rgba(201,168,76,.25)"
                    : "none",
                }}
              >
                {/* Left accent stripe */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 5,
                    background: accentClr,
                  }}
                />
                <div
                  style={{
                    paddingLeft: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: meta.bg || "#eee",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      flexShrink: 0,
                      opacity: isExcluded ? 0.4 : 1,
                    }}
                  >
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: isExcluded ? "#aaa" : C.text,
                      }}
                    >
                      {s.desc}
                    </div>
                    <div style={{ fontSize: 11, color: C.dim }}>
                      Fixed service
                    </div>
                    {togglable && (
                      <div style={{ marginTop: 7 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          {isUnanswered && pendingNo !== s.desc ? (
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: "#c17900",
                                background: "#fff3cc",
                                border: "1.5px solid #f0c040",
                                borderRadius: 12,
                                padding: "3px 10px",
                              }}
                            >
                              ⚠ Ask guest →
                            </span>
                          ) : (
                            !isUnanswered && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: C.dim,
                                  fontWeight: 700,
                                }}
                              >
                                Guest confirmed?
                              </span>
                            )
                          )}
                          <button
                            onClick={() => {
                              setPendingNo(null);
                              setFixedIncluded(s.desc, true);
                              setFixedReason(s.desc, "");
                            }}
                            style={{
                              padding: "5px 16px",
                              borderRadius: 7,
                              border: "2px solid",
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 800,
                              transition: ".15s",
                              borderColor:
                                s.included === true
                                  ? "#1a7a40"
                                  : isUnanswered
                                    ? "#e0a800"
                                    : "#ddd",
                              background:
                                s.included === true ? "#1a7a40" : "#fff",
                              color:
                                s.included === true
                                  ? "#fff"
                                  : isUnanswered
                                    ? "#b07800"
                                    : "#aaa",
                            }}
                          >
                            ✓ Yes
                          </button>
                          <button
                            onClick={() => clickNo(s.desc)}
                            style={{
                              padding: "5px 16px",
                              borderRadius: 7,
                              border: "2px solid",
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 800,
                              transition: ".15s",
                              borderColor:
                                s.included === false
                                  ? C.red
                                  : isUnanswered
                                    ? "#e0a800"
                                    : "#ddd",
                              background: s.included === false ? C.red : "#fff",
                              color:
                                s.included === false
                                  ? "#fff"
                                  : isUnanswered
                                    ? "#b07800"
                                    : "#aaa",
                            }}
                          >
                            ✕ No
                          </button>
                          {s.included === false && s.declineReason && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "#888",
                                fontStyle: "italic",
                              }}
                            >
                              Reason saved ✓
                            </span>
                          )}
                        </div>

                        {/* Inline reason panel — slides in when No is clicked */}
                        {pendingNo === s.desc && (
                          <div
                            style={{
                              marginTop: 10,
                              background: "#fff5f5",
                              border: "2px solid #e88",
                              borderRadius: 10,
                              padding: "14px 16px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: C.red,
                                marginBottom: 8,
                              }}
                            >
                              ✕ Why is {s.desc} not included?
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "#888",
                                marginBottom: 10,
                                lineHeight: 1.5,
                              }}
                            >
                              Write the guest's reason so the owner has a
                              record. This is required before saving.
                            </div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                              {(s.desc === "Stage Decoration"
                                ? ["Guest has own decorator","Not needed for this event","Budget constraint","Outdoor venue","Simple ceremony"]
                                : ["Guest has own lighting","Venue has built-in lights","Not needed","Budget constraint","Daytime event"]
                              ).map(preset => (
                                <button key={preset} onClick={() => setReasonDraft(r => ({ ...r, [s.desc]: preset }))}
                                  style={{ padding:"4px 10px", fontSize:11, fontWeight:600, borderRadius:20, border:`1.5px solid ${(reasonDraft[s.desc]||"")===preset?"#c0392b":"#e0b0b0"}`, background:(reasonDraft[s.desc]||"")===preset?"#fdf0f0":"#fff", color:(reasonDraft[s.desc]||"")===preset?"#c0392b":"#666", cursor:"pointer" }}>
                                  {preset}
                                </button>
                              ))}
                            </div>
                            <textarea
                              rows={2}
                              placeholder="Or type a custom reason…"
                              value={reasonDraft[s.desc] || ""}
                              onChange={(e) =>
                                setReasonDraft((r) => ({
                                  ...r,
                                  [s.desc]: e.target.value,
                                }))
                              }
                              style={{
                                width: "100%",
                                padding: "9px 12px",
                                border: `1.5px solid ${(reasonDraft[s.desc] || "").trim() ? "#e88" : "#f0a0a0"}`,
                                borderRadius: 8,
                                fontSize: 12,
                                fontFamily: "inherit",
                                outline: "none",
                                resize: "vertical",
                                boxSizing: "border-box",
                                background: "#fff",
                              }}
                              autoFocus
                            />
                            <div
                              style={{ display: "flex", gap: 8, marginTop: 10 }}
                            >
                              <button
                                onClick={() => cancelNo(s.desc)}
                                style={{
                                  flex: 1,
                                  padding: "8px",
                                  borderRadius: 8,
                                  border: "1.5px solid #ddd",
                                  background: "#f5f5f5",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  color: "#555",
                                }}
                              >
                                ← Go Back
                              </button>
                              <button
                                onClick={() => confirmNo(s.desc)}
                                disabled={!(reasonDraft[s.desc] || "").trim()}
                                style={{
                                  flex: 2,
                                  padding: "8px",
                                  borderRadius: 8,
                                  border: "none",
                                  background: (reasonDraft[s.desc] || "").trim()
                                    ? C.red
                                    : "#f5b5b5",
                                  color: "#fff",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  cursor: (reasonDraft[s.desc] || "").trim()
                                    ? "pointer"
                                    : "not-allowed",
                                }}
                              >
                                Confirm: Not Included
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: isHallRental ? 11 : 10,
                      fontWeight: 800,
                      color: isExcluded ? "#ccc" : C.maroon,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      marginBottom: 5,
                    }}
                  >
                    Amount (৳)
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={s.rate || ""}
                    onChange={(e) => setFixedRate(s.desc, e.target.value)}
                    disabled={isExcluded || isUnanswered}
                    placeholder="0"
                    style={{
                      width: isHallRental ? 180 : 150,
                      padding: isHallRental ? "14px 16px" : "10px 14px",
                      border: `${isHallRental ? 3 : 2}px solid ${isExcluded || isUnanswered ? "#eee" : C.gold}`,
                      borderRadius: 9,
                      fontSize: isHallRental ? 20 : 16,
                      fontWeight: 800,
                      textAlign: "right",
                      fontFamily: "inherit",
                      outline: "none",
                      boxSizing: "border-box",
                      background:
                        isExcluded || isUnanswered ? "#f8f8f8" : "#fffdf5",
                      color: isExcluded || isUnanswered ? "#ccc" : C.text,
                      boxShadow:
                        isExcluded || isUnanswered
                          ? "none"
                          : "0 2px 8px rgba(201,168,76,.2)",
                    }}
                  />
                </div>
              </div>
            );
          })}

          {customSvcs.map((s, ci) => (
            <div
              key={ci}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 10px",
                margin: "6px 0",
                borderRadius: 10,
                background: "#f9f9ff",
                border: "1.5px solid #d0c8f0",
              }}
            >
              <input
                value={s.desc || ""}
                onChange={(e) => setCustom(ci, "desc", e.target.value)}
                placeholder="Service description"
                style={{
                  ...inputStyle(),
                  flex: 1,
                  border: "1.5px solid #d0c8f0",
                }}
              />
              <div style={{ flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: 9,
                    color: C.dim,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 2,
                  }}
                >
                  Amount (৳)
                </div>
                <input
                  type="number"
                  min="0"
                  value={s.rate || ""}
                  onChange={(e) => setCustom(ci, "rate", e.target.value)}
                  style={{
                    ...inputStyle(),
                    width: 140,
                    textAlign: "right",
                    border: `2px solid ${C.gold}`,
                  }}
                />
              </div>
              <button
                onClick={() => removeCustom(ci)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: C.red,
                  fontSize: 20,
                  padding: "4px",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            onClick={addCustom}
            style={{
              width: "100%",
              margin: "10px 0 4px",
              padding: "12px",
              borderRadius: 8,
              border: "2px dashed #c9a84c",
              background: "transparent",
              color: "#8a6200",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ＋ Add Service / Item
          </button>
        </div>

        {/* Stage image — attached to bottom of card */}
        <div
          style={{
            background: "#f8f4ff",
            borderTop: "1.5px dashed #9370DB",
            padding: "14px 20px",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.purple,
              marginBottom: 8,
            }}
          >
            🖼️ Client's Stage Design / Reference Image{" "}
            <span style={{ fontSize: 11, fontWeight: 500, color: "#999" }}>
              (optional)
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 16px",
                background: C.purple,
                color: "#fff",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              📁 Choose Image
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleImg}
              />
            </label>
            <span style={{ fontSize: 12, color: "#777" }}>
              {d.stageImgName || "No image chosen"}
            </span>
            {d.stageImgData && (
              <button
                onClick={clearImg}
                style={{
                  padding: "5px 10px",
                  background: "transparent",
                  border: "1.5px solid " + C.red,
                  borderRadius: 6,
                  color: C.red,
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                ✕ Remove
              </button>
            )}
          </div>
          {d.stageImgData && (
            <img
              src={d.stageImgData}
              alt="stage"
              style={{
                maxWidth: "100%",
                maxHeight: 200,
                borderRadius: 8,
                border: "2px solid #9370DB",
                marginTop: 10,
              }}
            />
          )}
        </div>
      </div>

      {/* ── BILL SUMMARY ── */}
      <Section label="BILL SUMMARY">
        <div
          style={{
            background: "#fffdf5",
            border: "1px solid #e8d898",
            borderRadius: 10,
            padding: "18px 20px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: C.dim,
              marginBottom: 12,
            }}
          >
            SERVICES & HALL RENTAL (Hall Revenue)
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              marginBottom: 12,
            }}
          >
            <span>Services Subtotal</span>
            <span style={{ fontWeight: 700 }}>৳{svcSub.toLocaleString()}</span>
          </div>
          {isHolud && extras.hRental > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              <span>Holud / Hall Rental</span>
              <span style={{ fontWeight: 700 }}>
                ৳{extras.hRental.toLocaleString()}
              </span>
            </div>
          )}
          {isWedding && extras.wRental > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                marginBottom: 12,
              }}
            >
              <span>{et?.v || "Wedding"} / Hall Rental</span>
              <span style={{ fontWeight: 700 }}>
                ৳{extras.wRental.toLocaleString()}
              </span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 14,
              marginBottom: 14,
            }}
          >
            <span>Discount (৳)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                min="0"
                value={d.discount || ""}
                onChange={(e) =>
                  set("discount", parseFloat(e.target.value) || 0)
                }
                style={{
                  width: 120,
                  padding: "7px 10px",
                  border: "1.5px solid " + C.border,
                  borderRadius: 7,
                  fontSize: 14,
                  textAlign: "right",
                  fontFamily: "inherit",
                  outline: "none",
                }}
              />
              <span style={{ color: C.dim }}>৳</span>
            </div>
          </div>
          <div
            style={{
              borderTop: "1.5px solid #e8d898",
              paddingTop: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 17 }}>
              Hall Charges Total
            </span>
            <span style={{ fontWeight: 800, fontSize: 24, color: C.maroon }}>
              ৳{hallTotal.toLocaleString()}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 14,
            }}
          >
            {(wWaiterTotal > 0 || hWaiterTotal > 0) && (
              <div
                style={{
                  width: 220,
                  padding: "12px 14px",
                  borderRadius: 9,
                  border: "1.5px solid #c9a84c",
                  background: "#fffaf0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      color: "#8a6200",
                    }}
                  >
                    🍽️ Waiter Cost
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: "#fff",
                      background:
                        waiterPayStatus === "Paid"
                          ? "#2e8b57"
                          : waiterPayStatus === "Partial"
                            ? "#c8960a"
                            : "#c9a84c",
                      padding: "2px 7px",
                      borderRadius: 8,
                    }}
                  >
                    {waiterPayStatus === "Paid"
                      ? "PAID"
                      : waiterPayStatus === "Partial"
                        ? "PARTIALLY PAID"
                        : "DUE LATER"}
                  </span>
                </div>
                {isHolud && hWaiterTotal > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginBottom: 4,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      Holud {d.hWaiters || 0}×
                      {(parseFloat(d.hWaiterPrice) || 0).toLocaleString()}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      ৳{hWaiterTotal.toLocaleString()}
                    </span>
                  </div>
                )}
                {isWedding && wWaiterTotal > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                      marginBottom: 4,
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>
                      {et?.v || "Wedding"} {d.wWaiters || 0}×
                      {(parseFloat(d.wWaiterPrice) || 0).toLocaleString()}
                    </span>
                    <span style={{ fontWeight: 600 }}>
                      ৳{wWaiterTotal.toLocaleString()}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    borderTop: "1px dashed #c9a84c",
                    marginTop: 7,
                    paddingTop: 7,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 800, color: "#8a6200" }}
                  >
                    Total
                  </span>
                  <span
                    style={{ fontSize: 15, fontWeight: 800, color: "#8a6200" }}
                  >
                    ৳{(wWaiterTotal + hWaiterTotal).toLocaleString()}
                  </span>
                </div>
                {waiterPaid > 0 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "#2e8b57",
                        fontWeight: 700,
                      }}
                    >
                      Paid
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "#2e8b57",
                        fontWeight: 700,
                      }}
                    >
                      ৳{waiterPaid.toLocaleString()}
                    </span>
                  </div>
                )}
                {waiterBalance > 0 && waiterPaid > 0 && (
                  <div
                    style={{ display: "flex", justifyContent: "space-between" }}
                  >
                    <span style={{ fontSize: 11, color: "#8a6200" }}>
                      Remaining
                    </span>
                    <span style={{ fontSize: 11, color: "#8a6200" }}>
                      ৳{waiterBalance.toLocaleString()}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    fontSize: 9,
                    color: "#aa9560",
                    fontStyle: "italic",
                    marginTop: 5,
                  }}
                >
                  Pass-through — not hall revenue.
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              borderTop: "1px solid #eee",
              marginTop: 14,
              paddingTop: 10,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "#888" }}>
              Total collectible (Hall + Waiter)
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#888" }}>
              ৳{totalPayable.toLocaleString()}
            </span>
          </div>
        </div>
      </Section>

      {/* ── PAYMENT ── */}
      <Section label="💳 PAYMENT — HALL REVENUE">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <Field label="Hall Advance Paid (৳)">
            <input
              type="number"
              min="0"
              value={d.adv || ""}
              onChange={(e) => set("adv", parseFloat(e.target.value) || 0)}
              style={inputStyle()}
            />
          </Field>
          <Field label="Hall Balance Due (৳)">
            <input
              readOnly
              value={"৳ " + balance.toLocaleString()}
              style={inputStyle({
                background: "#fffdf0",
                borderColor: "#d4a800",
                fontWeight: 700,
                color: C.maroon,
              })}
            />
          </Field>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "#444",
              marginBottom: 10,
            }}
          >
            Payment Method
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PAY_METHODS.map((m) => (
              <label
                key={m}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 18px",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: "1.5px solid",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: ".15s",
                  borderColor: d.advMethod === m ? C.maroon : C.border,
                  background: d.advMethod === m ? C.maroon : C.white,
                  color: d.advMethod === m ? "#fff" : C.text,
                }}
              >
                <input
                  type="radio"
                  name="payM"
                  value={m}
                  checked={d.advMethod === m}
                  onChange={() => set("advMethod", m)}
                  style={{ display: "none" }}
                />
                {m === "Cash"
                  ? "💵 "
                  : m === "bKash"
                    ? "📱 "
                    : m === "Nagad"
                      ? "📲 "
                      : "🏦 "}
                {m}
              </label>
            ))}
          </div>
        </div>
        {d.advMethod === "Bank Transfer" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <Field label="Bank Name">
              <input
                value={d.bankName || ""}
                onChange={(e) => set("bankName", e.target.value)}
                style={inputStyle()}
              />
            </Field>
            <Field label="Account / Ref">
              <input
                value={d.bankRef || ""}
                onChange={(e) => set("bankRef", e.target.value)}
                style={inputStyle()}
              />
            </Field>
          </div>
        )}
        <Field label="Hall Payment Status (auto-calculated)">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "11px 20px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 15,
              border: "2px solid " + psStyle.border,
              background: psStyle.bg,
              color: psStyle.color,
            }}
          >
            <span>{psStyle.icon}</span>
            <span>{payStatus}</span>
          </div>
        </Field>
      </Section>

      {waiterTotal > 0 && (
        <Section label="🍽️ PAYMENT — WAITER COST (Separate, Pass-through)">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <Field label="Waiter Cost Paid (৳)">
              <input
                type="number"
                min="0"
                value={d.waiterCostPaid ?? d.waiterPaid ?? ""}
                onChange={(e) => {
                  const value = parseFloat(e.target.value) || 0;
                  set("waiterCostPaid", value);
                  set("waiterPaid", value);
                }}
                style={inputStyle()}
              />
            </Field>
            <Field label="Waiter Cost Balance (৳)">
              <input
                readOnly
                value={"৳ " + waiterBalance.toLocaleString()}
                style={inputStyle({
                  background: "#fafafa",
                  borderColor: "#ccc",
                  fontWeight: 700,
                  color: "#666",
                })}
              />
            </Field>
          </div>
          <Field label="Waiter Payment Status (auto-calculated)">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 20px",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 15,
                border: "2px solid " + waiterPsStyle.border,
                background: waiterPsStyle.bg,
                color: waiterPsStyle.color,
              }}
            >
              <span>{waiterPsStyle.icon}</span>
              <span>{waiterPayStatus}</span>
            </div>
          </Field>
          <div
            style={{
              fontSize: 11,
              color: "#999",
              fontStyle: "italic",
              marginTop: 8,
            }}
          >
            Tracked separately from hall revenue — this money is collected from
            the guest and paid out to waiter staff, usually after the ceremony.
          </div>
        </Section>
      )}

      {/* ── NOTES & TERMS ── */}
      <Section label="📋 NOTES & TERMS">
        <Field label="Additional Notes">
          <textarea
            value={d.note || ""}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Custom notes..."
            rows={3}
            style={inputStyle()}
          />
        </Field>
        <Field label="📣 How did you hear about us?">
          <select
            value={d.hearAbout || ""}
            onChange={(e) => set("hearAbout", e.target.value)}
            style={inputStyle()}
          >
            <option value="">— Select Source —</option>
            {SOURCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── Actions ── */}
      {(() => {
        const issues = [];
        TOGGLABLE_SVCS.forEach((name) => {
          const svc = d.services.find((s) => s.desc === name);
          if (!svc) return;
          if (svc.included === null)
            issues.push({
              name,
              type: "unanswered",
              msg: `Ask the guest about ${name} — click Yes or No.`,
            });
          else if (svc.included === true && !(parseFloat(svc.rate) > 0))
            issues.push({
              name,
              type: "amount",
              msg: `${name}: enter the amount (৳) since guest said Yes.`,
            });
          else if (svc.included === false && !(svc.declineReason || "").trim())
            issues.push({
              name,
              type: "reason",
              msg: `${name}: write the reason guest declined.`,
            });
        });
        const blocked = issues.length > 0 || pendingNo !== null;
        return (
          <div style={{ paddingBottom: 32 }}>
            {blocked && (
              <div
                style={{
                  background: "#fff8e1",
                  border: "2px solid #f0b429",
                  borderRadius: 10,
                  padding: "12px 16px",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: issues.length ? 8 : 0,
                  }}
                >
                  <span style={{ fontSize: 18 }}>🔔</span>
                  <div
                    style={{ fontWeight: 800, fontSize: 13, color: "#7a4f00" }}
                  >
                    Complete the following before saving:
                  </div>
                </div>
                {issues.map((iss, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "5px 0",
                      borderTop: i === 0 ? "1px solid #f0d080" : "none",
                    }}
                  >
                    <span style={{ fontSize: 13, marginTop: 1 }}>
                      {iss.type === "unanswered"
                        ? "⚠️"
                        : iss.type === "amount"
                          ? "💰"
                          : "📝"}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#6b4200",
                        lineHeight: 1.5,
                      }}
                    >
                      {iss.msg}
                    </span>
                  </div>
                ))}
                {pendingNo && !issues.find((i) => i.type === "reason") && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "5px 0",
                      borderTop: "1px solid #f0d080",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>📝</span>
                    <span style={{ fontSize: 12, color: "#6b4200" }}>
                      Finish writing the reason for <strong>{pendingNo}</strong>{" "}
                      and click "Confirm: Not Included".
                    </span>
                  </div>
                )}
              </div>
            )}
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}
            >
              <button type="button" onClick={onCancel} style={btnStyle()}>
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  if (blocked) {
                    setSaveBlocked(true);
                    notify?.(
                      "Complete the service questions before saving",
                      "error",
                    );
                    setTimeout(() => setSaveBlocked(false), 600);
                  } else if (validate(d, true)) onSave(d, true);
                }}
                style={{
                  ...btnStyle(),
                  border: `2px solid ${blocked ? "#ccc" : C.purple}`,
                  color: blocked ? "#bbb" : C.purple,
                  background: C.white,
                  cursor: blocked ? "not-allowed" : "pointer",
                }}
              >
                🤝 Save as Lead
              </button>
              <button
                type="button"
                onClick={() => {
                  if (blocked) {
                    setSaveBlocked(true);
                    notify?.(
                      "Complete the service questions before saving",
                      "error",
                    );
                    setTimeout(() => setSaveBlocked(false), 600);
                  } else if (validate(d, false)) onSavePreview(d, false);
                }}
                style={{
                  padding: "10px 28px",
                  borderRadius: 9,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 14,
                  fontFamily: "inherit",
                  cursor: blocked ? "not-allowed" : "pointer",
                  background: blocked ? "#ccc" : C.maroon,
                  color: "#fff",
                  transition: ".15s",
                  transform: saveBlocked ? "scale(.97)" : "scale(1)",
                }}
              >
                💾 Save &amp; Preview
              </button>
            </div>
          </div>
        );
      })()}

      {/* Floating save button — stays on screen while scrolling, so an incomplete
          invoice can be saved as a draft at any point and resumed later. */}
      <button
        type="button"
        onClick={() => validate(d, true) && onSave(d, true)}
        title="Save your progress now — come back and finish this invoice later from Invoice History."
        style={{
          position: "fixed",
          bottom: isMobile ? 14 : 24,
          right: isMobile ? 14 : 24,
          zIndex: 150,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: isMobile ? "11px 16px" : "13px 22px",
          borderRadius: 30,
          border: "none",
          background: "linear-gradient(135deg,#c9a84c,#e8c96c)",
          color: "#1a1a2e",
          fontWeight: 800,
          fontSize: isMobile ? 12 : 13,
          fontFamily: "inherit",
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(201,168,76,.45)",
          maxWidth: isMobile ? "calc(100vw - 28px)" : "none",
        }}
      >
        💾{isMobile ? " Save Draft" : " Save & Continue Later"}
      </button>
    </div>
  );
}

// ─── Invoice Detail / Print View ──────────────────────────────────────────────
function InvDetail({
  inv,
  setDetailInv,
  onEdit,
  onBack,
  onDelete,
  deleteModal,
  delPass,
  setDelPass,
  confirmDelete,
  setDeleteModal,
  notify,
  setInvoices,
  invoices,
  leads = [],
  setLeads,
  getNextNum,
  curUser,
  isMobile,
}) {
  const [payModal, setPayModal] = useState(false);
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payDone, setPayDone] = useState(null); // { newPaid, newBal, status } after payment

  const [waiterPayModal, setWaiterPayModal] = useState(false);
  const [waiterPayAmt, setWaiterPayAmt] = useState("");
  const [waiterPayDone, setWaiterPayDone] = useState(null);

  const [previewOpen, setPreviewOpen] = useState(false);

  const et = EV_TYPES.find((t) => t.v === inv.evType);
  const grand = inv.grand || 0;
  const paid = parseFloat(inv.adv) || 0;
  const bal = Math.max(0, grand - paid);
  const ps = PS_STYLE[inv.payStatus] || PS_STYLE["Unpaid"];

  const waiterTotal = inv.waiterTotal || 0;
  const waiterPaid = parseFloat(inv.waiterCostPaid ?? inv.waiterPaid) || 0;
  const waiterBal = Math.max(0, waiterTotal - waiterPaid);
  const wps = PS_STYLE[inv.waiterPayStatus] || PS_STYLE["Unpaid"];

  function collectPayment() {
    const a = parseFloat(payAmt) || 0;
    if (a <= 0) {
      notify("Enter valid amount", "error");
      return;
    }
    const newPaid = paid + a;
    const newBal = Math.max(0, grand - newPaid);
    const status = newBal === 0 ? "Paid" : "Partial";
    const updated = {
      ...inv,
      adv: newPaid,
      balance: newBal,
      payStatus: status,
      advMethod: payMethod,
    };
    setInvoices((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
    setDetailInv && setDetailInv(updated);
    void persistHallInvoiceBundle(updated).catch((err) => {
      console.error("Failed to sync hall payment to Supabase:", err);
    });
    notify("Hall payment recorded ✅", "success");
    logEvent(
      "hall",
      "hall_payment_collected",
      { num: inv.num, client: inv.client, amount: a, note: `via ${payMethod}` },
      curUser,
    );
    setPayModal(false);
    setPayAmt("");
    setPayDone({ newPaid, newBal, status });
  }

  function collectWaiterPayment() {
    const a = parseFloat(waiterPayAmt) || 0;
    if (a <= 0) {
      notify("Enter valid amount", "error");
      return;
    }
    const newPaid = waiterPaid + a;
    const newBal = Math.max(0, waiterTotal - newPaid);
    const status = newBal === 0 ? "Paid" : "Partial";
    const updated = {
      ...inv,
      waiterPaid: newPaid,
      waiterCostPaid: newPaid,
      waiterBalance: newBal,
      waiterPayStatus: status,
    };
    setInvoices((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
    setDetailInv && setDetailInv(updated);
    void persistHallInvoiceBundle(updated).catch((err) => {
      console.error("Failed to sync waiter payment to Supabase:", err);
    });
    notify("Waiter cost collection recorded ✅", "success");
    logEvent(
      "hall",
      "waiter_payment_collected",
      { num: inv.num, client: inv.client, amount: a },
      curUser,
    );
    setWaiterPayModal(false);
    setWaiterPayAmt("");
    setWaiterPayDone({ newPaid, newBal, status });
  }

  function confirmAndPrint() {
    // Assign the real, sequential ACH-000xx number right now — not before — so
    // confirmed invoices always stay gapless regardless of how many drafts were
    // started and abandoned along the way.
    const oldNum = inv.num;
    const needsRealNum = !/^ACH-\d+$/.test(oldNum || "");
    const newNum = needsRealNum && getNextNum ? getNextNum() : oldNum;
    const updated = { ...inv, confirmed: true, num: newNum };
    setInvoices((prev) => prev.map((i) => (i.id === inv.id ? updated : i)));
    setDetailInv && setDetailInv(updated);
    void persistHallInvoiceBundle(updated).catch((err) => {
      console.error("Failed to sync confirmed invoice to Supabase:", err);
    });
    notify("Invoice confirmed ✅", "success");
    logEvent(
      "hall",
      "invoice_confirmed",
      { num: newNum, client: updated.client, amount: updated.grand },
      curUser,
    );

    // Auto-update the matching CRM lead to Confirmed
    if (setLeads) {
      setLeads(prev => prev.map(l =>
        l.invoiceId === inv.id ? { ...l, stage: "Confirmed", updatedAt: new Date().toISOString() } : l
      ));
    }

    // Guest SMS and the owner's WhatsApp copy are sent only now — at the final,
    // locked, reviewed total — never at the draft stage, so a guest is never
    // texted a number that could still change, and the owner always has an
    // independent record of the real confirmed amount.
    sendSmsForInvoice(updated)
      .then((ok) => {
        if (ok) notify("SMS sent to client ✓", "success");
      })
      .catch(() => {});
    sendWhatsAppAlert(buildHallWaMessage(updated)).catch(() => {});
    sendNtfyAlert(
      `🏛 New Hall Booking — ${updated.client}`,
      `Event: ${updated.evType}\nDate: ${updated.evDate || "—"}\nTotal: ৳${(updated.grand||0).toLocaleString()}\nAdvance: ৳${(parseFloat(updated.adv)||0).toLocaleString()}\nBalance: ৳${Math.max(0,(updated.grand||0)-(parseFloat(updated.adv)||0)).toLocaleString()}\nInvoice: ${updated.num}\nPhone: ${updated.phone||"—"}`
    ).catch(() => {});

    setTimeout(() => {
      const html = buildInvoiceHtml(true, true).split(oldNum).join(newNum);
      const w = window.open("", "_blank");
      w.document.write(html);
      w.document.close();
    }, 50);
  }

  function printInvoice(withTerms = true) {
    const html = buildInvoiceHtml(withTerms, true);
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  function previewInvoice() {
    setPreviewOpen(true);
  }

  function buildInvoiceHtml(withTerms = true, autoPrint = true) {
    const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 90" width="72" height="34">
      <polygon points="8,78 19,78 46,18 35,18" fill="#f2dfc0"/>
      <polygon points="35,18 46,18 71,78 60,78" fill="#f2dfc0"/>
      <rect x="24" y="49" width="30" height="7" fill="#f2dfc0"/>
      <polygon points="36,18 40,3 44,18" fill="#f2dfc0"/>
      <rect x="4" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
      <rect x="56" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
      <circle cx="95" cy="44" r="5" fill="#c9a84c"/>
      <rect x="112" y="18" width="11" height="60" fill="#f2dfc0"/>
      <rect x="149" y="18" width="11" height="60" fill="#f2dfc0"/>
      <rect x="112" y="42" width="48" height="8" fill="#f2dfc0"/>
      <polygon points="113,18 117,3 122,18" fill="#f2dfc0"/>
      <polygon points="150,18 154,3 159,18" fill="#f2dfc0"/>
      <rect x="108" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
      <rect x="145" y="74" width="19" height="5" rx="1" fill="#f2dfc0"/>
    </svg>`;

    const phones = `📞 ${inv.phone}${inv.phone2 ? " &nbsp;|&nbsp; 📞 " + inv.phone2 : ""}${inv.phone3 ? " &nbsp;|&nbsp; 📞 " + inv.phone3 : ""}`;

    const isWedding = et?.g === "wedding" || et?.v === "Wedding + Holud";
    const isHolud = et?.v === "Holud" || et?.v === "Wedding + Holud";

    const extras = calcExtras(inv);

    const itemRow = (label, amt) =>
      `<tr style="border-bottom:1px solid #eee"><td style="padding:8px 13px;font-size:13px;color:#111;font-weight:500">${label}</td><td style="padding:8px 13px;text-align:right;font-size:13px;font-weight:700;color:#111">৳ ${amt.toLocaleString()}</td></tr>`;

    const baseServiceRows = (inv.services || [])
      .filter(
        (s) => !(s.desc === "Hall Rental" && (parseFloat(s.rate) || 0) === 0),
      )
      .map((s) => {
        if (s.included === false) {
          return `<tr style="border-bottom:1px solid #eee"><td style="padding:8px 13px;font-size:13px;color:#aaa;font-style:italic">${s.desc} <span style="font-size:10px;color:#c0392b;font-weight:700">[Not Included]</span>${s.declineReason ? " — " + s.declineReason : ""}</td><td style="padding:8px 13px;text-align:right;font-size:13px;font-weight:700;color:#aaa">—</td></tr>`;
        }
        return `<tr style="border-bottom:1px solid #eee"><td style="padding:8px 13px;font-size:13px;color:#111;font-weight:500">${s.desc}</td><td style="padding:8px 13px;text-align:right;font-size:13px;font-weight:700;color:#111">৳ ${(parseFloat(s.rate) || 0).toLocaleString()}</td></tr>`;
      })
      .join("");

    const wLabel = et?.v || "Wedding";

    // Hall Rental is real hall revenue — keep it in the main charges table. Holud listed before Wedding.
    const rentalRows =
      (isHolud && extras.hRental > 0
        ? itemRow("Holud / Hall Rental", extras.hRental)
        : "") +
      (isWedding && extras.wRental > 0
        ? itemRow(`${wLabel} / Hall Rental`, extras.wRental)
        : "");

    const serviceRows = baseServiceRows + rentalRows;

    // Waiter cost is collected on the guest's behalf for waiter staff — not hall revenue.
    // Kept in its own box, shown separately from the hall charges table, Holud first.
    const waiterLines = [
      isHolud && extras.hWaiters > 0
        ? ["Holud", inv.hWaiters, inv.hWaiterPrice, extras.hWaiters]
        : null,
      isWedding && extras.wWaiters > 0
        ? [wLabel, inv.wWaiters, inv.wWaiterPrice, extras.wWaiters]
        : null,
    ].filter(Boolean);
    const waiterTotal = waiterLines.reduce((s, [, , , amt]) => s + amt, 0);

    const hallSubtotal =
      (inv.services || [])
        .filter((s) => s.included !== false)
        .reduce((s, it) => s + (parseFloat(it.rate) || 0), 0) +
      extras.wRental +
      extras.hRental;
    const disc = parseFloat(inv.discount) || 0;
    const hallTotal = Math.max(0, hallSubtotal - disc);
    const totalPayable = hallTotal + waiterTotal;

    const psColor =
      inv.payStatus === "Paid"
        ? {
            bg: "#d4f5e2",
            color: "#074d22",
            border: "#2e8b57",
            icon: "✅",
            label: "Fully Paid",
          }
        : inv.payStatus === "Partial"
          ? {
              bg: "#fef0b0",
              color: "#5a3800",
              border: "#c8960a",
              icon: "⚠️",
              label: "Partially Paid — Balance Remaining",
            }
          : {
              bg: "#fcd5d5",
              color: "#6b0000",
              border: "#c03030",
              icon: "❌",
              label: "Unpaid",
            };

    const terms = [
      "নির্ধারিত অগ্রিম টাকা প্রদান করার পরই বুকিং নিশ্চিত বলে গণ্য হবে। নির্ধারিত সময়ের মধ্য অগ্রিম টাকা প্রদান না করলে কর্তৃপক্ষ পূর্ব নোটিশ ছাড়াই বুকিং বাতিল করার অধিকার সংরক্ষণ করবে।",
      "গ্রাহক কর্তৃপক্ষ বুকিং বাতিল করলে অগ্রিম টাকা ফেরতযোগ্য নয়। অনুষ্ঠানের তারিখ পরিবর্তন করতে হলে কমপক্ষে ৩ দিন পূর্বে কর্তৃপক্ষকে জানাতে হবে। তারিখ পরিবর্তনের ক্ষেত্রে হল খালি থাকা সাপেক্ষে এবং কর্তৃপক্ষের অনুমোদনক্রমে পরিবর্তন করা যেতে পারে।",
      "অনুষ্ঠান শুরু হওয়ার পূর্বেই সম্পূর্ণ ভাড়া পরিশোধ করতে হবে। অনুষ্ঠানের সময় অতিরিক্ত কোনো সুবিধা বা সময় ব্যবহার করলে তার চার্জ অনুষ্ঠান শেষে তাৎক্ষণিক পরিশোধ করতে হবে।",
      "গ্রাহককে নির্ধারিত সময়ের মধ্যেই অনুষ্ঠান সম্পন্ন করতে হবে। রাতের অনুষ্ঠানের জন্য সময়সীমা সকাল ৮টা পর্যন্ত এবং দিনের অনুষ্ঠানের জন্য বিকাল ৫টা পর্যন্ত প্রযোজ্য। নির্ধারিত সময়ের অতিরিক্ত ব্যবহার করলে অতিরিক্ত চার্জ প্রদান করতে হবে।",
      "নির্ধারিত সময় শেষ হওয়ার পর কর্তৃপক্ষ অনুষ্ঠান বন্ধ করার অধিকার রাখে।",
      "গ্রাহক বা গ্রাহকের অতিথিদের মাধ্যমে হলের আসবাবপত্র, লাইট, সাউন্ড সিস্টেম বা অন্যান্য সম্পদের কোনো ক্ষতি হলে তার সম্পূর্ণ দায়ভার গ্রাহক বহন করবেন।",
      "হলের দেয়ালে পেরেক, আঠা, ক্লিন, আঠা অথবা অন্য কোনো ক্ষতিকর উপকরণ ব্যবহার সম্পূর্ণ নিষিদ্ধ।",
      "নগদ অর্থ, গহনা, মোবাইল ফোন, মানবাহন বা অন্যান্য মূল্যবান সামগ্রী হারানো কিংবা ক্ষতিগ্রস্ত হওয়ার জন্য হল কর্তৃপক্ষ দায়ী থাকবে না।",
      "জুয়া, মাদক, অস্ত্র বহন, রাজনৈতিক সহিংসতা অথবা যেকোনো অবৈধ কার্যক্রম সম্পূর্ণ নিষিদ্ধ। আইনবিরোধী কোনো কার্যক্রম প্রমাণিত হলে কর্তৃপক্ষ তাৎক্ষণিকভাবে অনুষ্ঠান বন্ধ করার অধিকার রাখে।",
      "প্রাকৃতিক দুর্যোগ, বিদ্যুৎ বিভ্রাট অথবা নিয়ন্ত্রণের বাইরে কোনো প্রযুক্তিগত সমস্যার কারণে সৃষ্ট অনুষ্ঠতার জন্য কর্তৃপক্ষ দায়ী থাকবে না।",
      "পার্কিং সম্পূর্ণ গাড়ির মালিকের নিজ দায়িত্বে। গাড়ি হারানো বা ক্ষতিগ্রস্ত হওয়ার জন্য হল কর্তৃপক্ষ কোনো দায় বহন করবে না।",
      "অনুষ্ঠানে আগত অতিথিদের আচরণের সম্পূর্ণ দায়িত্ব গ্রাহকের। কোনো ধরনের বিশৃঙ্খলা, মারামারি বা অসদাচরণ ঘটলে কর্তৃপক্ষ অনুষ্ঠান বন্ধ করার অধিকার রাখে।",
      "নির্ধারিত স্থান ব্যতীত ধূমপান সম্পূর্ণ নিষিদ্ধ।",
      "নিরাপত্তার স্বার্থে হলের নির্ধারিত ধারণক্ষমতার অতিরিক্ত অতিথি প্রবেশ করানো যাবে না। নির্ধারিত সংখ্যার অতিরিক্ত অতিথি উপস্থিত হলে প্রতি অতিরিক্ত অতিথির জন্য নির্ধারিত অতিরিক্ত চার্জ প্রযোজ্য হবে।",
      "উপরের শর্তাবলী না মানলে কর্তৃপক্ষ পূর্ব ঘোষণা ছাড়াই অনুষ্ঠান বন্ধ করতে পারবে এবং অগ্রিম টাকা ফেরতযোগ্য হবে না।",
    ];
    const bnNums = [
      "১",
      "২",
      "৩",
      "৪",
      "৫",
      "৬",
      "৭",
      "৮",
      "৯",
      "১০",
      "১১",
      "১২",
      "১৩",
      "১৪",
      "১৫",
    ];
    const termsRows = terms
      .map(
        (txt, i) =>
          `<tr style="border-bottom:1px solid #f0d8d8">
        <td style="vertical-align:top;padding:6px 8px 6px 4px;width:28px">
          <div style="background:#8B1A1A;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;text-align:center;line-height:22px;flex-shrink:0">${bnNums[i]}</div>
        </td>
        <td style="padding:6px 4px;font-size:10.5px;color:#222;line-height:1.75">${txt}</td>
      </tr>`,
      )
      .join("");

    const clientName = inv.client || inv.clientName || "";
    const invDateFmt = fmtDate(inv.invDate) || "";
    const sigBlock = (label) => {
      const isClient = label === "গ্রাহকের স্বাক্ষর";
      return `
      <div style="padding:18px 20px${isClient ? ";border-right:1.5px solid #8B1A1A" : ""}">
        <div style="font-size:11px;font-weight:700;color:#8B1A1A;text-align:center;margin-bottom:14px;font-family:'Playfair Display',serif">${label}</div>
        <div style="height:44px;border-bottom:1.5px dotted #aaa;margin-bottom:12px"></div>
        ${
          isClient
            ? `
        <div style="display:flex;align-items:baseline;margin-bottom:8px">
          <span style="font-size:10px;color:#555;font-weight:700;min-width:52px;text-transform:uppercase;letter-spacing:.5px">নাম:</span>
          <span style="font-size:13px;font-weight:800;color:#1a1a1a;border-bottom:1px solid #ccc;flex:1;padding-bottom:2px;">${clientName}</span>
        </div>
        <div style="display:flex;align-items:baseline">
          <span style="font-size:10px;color:#555;font-weight:700;min-width:52px;text-transform:uppercase;letter-spacing:.5px">তারিখ:</span>
          <span style="font-size:13px;font-weight:800;color:#1a1a1a;border-bottom:1px solid #ccc;flex:1;padding-bottom:2px;">${invDateFmt}</span>
        </div>
        `
            : `
        <div style="display:flex;align-items:baseline;margin-bottom:8px">
          <span style="font-size:10px;color:#555;font-weight:700;min-width:52px;text-transform:uppercase;letter-spacing:.5px">নাম:</span>
          <div style="flex:1;border-bottom:1px dotted #aaa;height:20px"></div>
        </div>
        <div style="display:flex;align-items:baseline">
          <span style="font-size:10px;color:#555;font-weight:700;min-width:52px;text-transform:uppercase;letter-spacing:.5px">পদবী:</span>
          <div style="flex:1;border-bottom:1px dotted #aaa;height:20px"></div>
        </div>
        `
        }
      </div>`;
    };

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Invoice ${inv.num}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'DM Sans',sans-serif;font-size:13px;color:#1a1a1a;background:#fff;padding:0;}
      .page{width:210mm;min-height:297mm;margin:0 auto;padding:0;background:#fff;}
      @media print{
        body{padding:0;}
        .page{page-break-after:always;}
        .page:last-child{page-break-after:auto;}
        .no-print{display:none!important;}
      }
    </style></head><body>

    <!-- ═══ PAGE 1: INVOICE ═══ -->
    <div class="page" style="padding:0 0 24px;">
      <!-- Header ribbon -->
      <div style="background:linear-gradient(135deg,#5a0a0a,#7B1212);padding:12px 18px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px">
          ${logoSvg}
          <div style="font-family:'Playfair Display',serif;font-size:18px;color:#f2dfc0;font-weight:700;letter-spacing:.5px">Amelia Convention Hall</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'Playfair Display',serif;font-size:28px;color:#c9a84c;font-weight:700;letter-spacing:3px;line-height:1">INVOICE</div>
          <div style="font-size:11px;color:#f2dfc0;margin-top:3px"><span style="color:#c9a84c;font-weight:600">No:</span> <strong style="font-size:13px">${inv.num}</strong> &nbsp; <span style="color:#c9a84c;font-weight:600">Date:</span> <strong>${fmtDate(inv.invDate)}</strong></div>
        </div>
      </div>
      <!-- Contact bar -->
      <div style="background:#f8f0dd;border-left:4px solid #c9a84c;border-bottom:2px solid #e8d0a0;padding:5px 18px;display:flex;flex-wrap:wrap;gap:4px 20px;align-items:center">
        <span style="font-size:10.5px;color:#3d2000;font-weight:600">📞 +880 1838-616405</span>
        <span style="font-size:10.5px;color:#3d2000;font-weight:600">🌐 ameliaconventionhall.com</span>
        <span style="font-size:10.5px;color:#3d2000;font-weight:600">📘 facebook.com/AmeliaConventionHall</span>
        <span style="font-size:10.5px;color:#3d2000;font-weight:700">📍 Hajari Road, Shibpur-9 No. Ward, Sitakund, Chittagong</span>
      </div>
      <div style="height:2px;background:linear-gradient(90deg,#7B1212,#c9a84c,#7B1212);margin-bottom:14px"></div>

      <!-- Bill To + Event -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 18px;margin-bottom:14px">
        <div style="border:1.5px solid #ddd;border-top:3px solid #7B1212;border-radius:6px;padding:12px 14px">
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7B1212;font-weight:800;margin-bottom:10px">📋 Bill To</div>
          <div style="font-size:15px;font-weight:800;color:#111;margin-bottom:5px">${inv.client || "—"}</div>
          <div style="font-size:11px;color:#555;margin-bottom:3px">${phones}</div>
          ${inv.email ? `<div style="font-size:11px;color:#555;margin-bottom:3px">✉ ${inv.email}</div>` : ""}
          ${(inv.addrArea || inv.addrCity || inv.addrDistrict) ? `<div style="font-size:11px;color:#555;margin-bottom:3px">📍 ${[inv.addrArea, inv.addrCity, inv.addrDistrict].filter(Boolean).join(", ")}</div>` : ""}
          ${(inv.wRelation || inv.wBride || inv.wGroom) ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee">
            ${inv.wBride ? `<div style="font-size:11px;color:#222;margin-bottom:3px"><span style="font-weight:700;color:#7B1212">Bride:</span> ${inv.wBride}${inv.wBrideRel ? ` <span style="color:#555;font-size:10px">· ${inv.wBrideRel}</span>` : ""}</div>` : ""}
            ${inv.wGroom ? `<div style="font-size:11px;color:#222;margin-bottom:3px"><span style="font-weight:700;color:#7B1212">Groom:</span> ${inv.wGroom}${inv.wGroomRel ? ` <span style="color:#555;font-size:10px">· ${inv.wGroomRel}</span>` : ""}</div>` : ""}
            ${inv.wCouplePhone ? `<div style="font-size:11px;color:#222;margin-bottom:3px">📞 <span style="font-weight:700;color:#7B1212">Couple's Phone:</span> ${inv.wCouplePhone}</div>` : ""}
            ${inv.wRelation ? `<div style="font-size:11px;color:#222;margin-bottom:2px"><span style="font-weight:700;color:#7B1212">Client's Relation:</span> ${inv.wRelation}</div>` : ""}
          </div>` : ""}
          ${(!inv.wBride && !inv.wGroom && inv.hBride) ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #eee">
            ${inv.hBride ? `<div style="font-size:11px;color:#222;margin-bottom:3px"><span style="font-weight:700;color:#8a6200">Bride:</span> ${inv.hBride}${inv.hBrideRel ? ` <span style="color:#555;font-size:10px">· ${inv.hBrideRel}</span>` : ""}</div>` : ""}
            ${inv.hGroom ? `<div style="font-size:11px;color:#222;margin-bottom:3px"><span style="font-weight:700;color:#8a6200">Groom:</span> ${inv.hGroom}${inv.hGroomRel ? ` <span style="color:#555;font-size:10px">· ${inv.hGroomRel}</span>` : ""}</div>` : ""}
          </div>` : ""}
        </div>
        <div style="border:1.5px solid #ddd;border-top:3px solid #c9a84c;border-radius:6px;padding:12px 14px">
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#9a7000;font-weight:800;margin-bottom:10px">🎉 ${isHolud ? "Event Details" : (inv.evType || "Event")}</div>
          ${isHolud ? `
            <div style="background:#fff8e1;border:1.5px solid #d4a800;border-radius:7px;padding:10px 12px;margin-bottom:10px">
              <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#8a6200;font-weight:800;margin-bottom:7px">🌼 HOLUD CEREMONY</div>
              ${inv.hDate ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:80px">DATE</span><span style="font-size:12px;color:#111;font-weight:600">${fmtDateWithDay(inv.hDate)}</span></div>` : ""}
              ${inv.hStart || inv.hEnd ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:80px">TIME</span><span style="font-size:12px;color:#111;font-weight:600">${inv.hStart || "?"}${inv.hStart || inv.hEnd ? " – " : ""}${inv.hEnd || "?"}</span></div>` : ""}
              ${inv.hGuests || inv.hTables ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:80px">GUESTS</span><span style="font-size:12px;color:#111;font-weight:600">${inv.hGuests ? inv.hGuests + " guests" : ""}${inv.hGuests && inv.hTables ? " · " : ""}${inv.hTables ? inv.hTables + " tables" : ""}</span></div>` : ""}
            </div>
            <div style="background:#fff0f0;border:1.5px solid #e07070;border-radius:7px;padding:10px 12px;margin-bottom:10px">
              <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#7B1212;font-weight:800;margin-bottom:7px">💒 WEDDING CEREMONY</div>
              ${inv.evDate ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:80px">DATE</span><span style="font-size:12px;color:#111;font-weight:600">${fmtDateWithDay(inv.evDate)}</span></div>` : ""}
              ${inv.wStart || inv.wEnd ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:80px">TIME</span><span style="font-size:12px;color:#111;font-weight:600">${inv.wStart || "?"}${inv.wStart || inv.wEnd ? " – " : ""}${inv.wEnd || "?"}</span></div>` : ""}
              ${inv.wGuests || inv.wTables ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:80px">GUESTS</span><span style="font-size:12px;color:#111;font-weight:600">${inv.wGuests ? inv.wGuests + " guests" : ""}${inv.wGuests && inv.wTables ? " · " : ""}${inv.wTables ? inv.wTables + " tables" : ""}</span></div>` : ""}
            </div>
          ` : `
            ${inv.evDate ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:90px">DATE</span><span style="font-size:13px;color:#111;font-weight:600">${fmtDateWithDay(inv.evDate)}</span></div>` : ""}
            ${inv.wGuests || inv.wTables ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:90px">GUESTS</span><span style="font-size:13px;color:#111;font-weight:600">${inv.wGuests ? inv.wGuests + " guests" : ""}${inv.wGuests && inv.wTables ? " · " : ""}${inv.wTables ? inv.wTables + " tables" : ""}</span></div>` : ""}
            ${inv.wStart || inv.wEnd ? `<div style="display:flex;gap:6px;margin-bottom:4px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#7B1212;font-weight:700;min-width:90px">TIME</span><span style="font-size:13px;color:#111;font-weight:600">${inv.wStart || "?"}${inv.wStart || inv.wEnd ? " – " : ""}${inv.wEnd || "?"}</span></div>` : ""}
          `}
        </div>
      </div>

      <!-- Services table -->
      <div style="padding:0 18px;margin-bottom:0">
        <table style="width:100%;border-collapse:collapse;border:1.5px solid #ddd;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#7B1212">
              <th style="padding:9px 13px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#f2dfc0;font-weight:700">Description</th>
              <th style="padding:9px 13px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#f2dfc0;font-weight:700;width:140px">Amount (৳)</th>
            </tr>
          </thead>
          <tbody>${serviceRows}</tbody>
          <tfoot>
            ${disc > 0 ? `<tr style="background:#fff5f5"><td style="padding:6px 13px;font-size:12px;color:#900;font-weight:700">Discount</td><td style="padding:6px 13px;text-align:right;font-size:12px;font-weight:800;color:#900">– ৳ ${disc.toLocaleString()}</td></tr>` : ""}
            <tr style="background:#f5ede0;border-top:2px solid #c9a84c">
              <td style="padding:13px 13px;font-size:16px;font-weight:800;color:#7B1212;letter-spacing:.5px">Hall Rent Total</td>
              <td style="padding:13px 13px;text-align:right;font-size:24px;font-weight:800;color:#7B1212;font-family:'Playfair Display',serif">৳ ${hallTotal.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Hall payment status -->
      <div style="padding:0 18px;margin-top:10px;display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
        <div style="font-size:12px;color:#555">Advance Paid: <strong style="color:#1a5c30">৳ ${paid.toLocaleString()}</strong> &nbsp;·&nbsp; Balance Due: <strong style="color:#7a0000">৳ ${bal.toLocaleString()}</strong></div>
      </div>

      ${
        waiterLines.length
          ? `
      <!-- Small waiter cost box — visible but kept secondary to hall revenue -->
      <div style="padding:0 18px;margin-top:14px;display:flex;justify-content:flex-end">
        <div style="width:250px;border:1.5px solid #c9a84c;border-radius:9px;padding:11px 13px;background:#fffaf0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px">
            <span style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#8a6200">🍽️ Waiter Cost</span>
            <span style="font-size:7.5px;font-weight:700;color:#fff;background:${inv.waiterPayStatus === "Paid" ? "#2e8b57" : inv.waiterPayStatus === "Partial" ? "#c8960a" : "#c9a84c"};padding:2px 7px;border-radius:8px">${inv.waiterPayStatus === "Paid" ? "PAID" : inv.waiterPayStatus === "Partial" ? "PARTIALLY PAID" : "DUE LATER"}</span>
          </div>
          ${waiterLines
            .map(
              ([label, n, price, amt]) =>
                `<div style="display:flex;justify-content:space-between;font-size:11.5px;color:#666;margin-bottom:4px"><span>${label} ${n || 0}×${(parseFloat(price) || 0).toLocaleString()}</span><span style="font-weight:600">৳${amt.toLocaleString()}</span></div>`,
            )
            .join("")}
          <div style="border-top:1px dashed #c9a84c;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between">
            <span style="font-size:11.5px;font-weight:800;color:#8a6200">Total</span>
            <span style="font-size:14px;font-weight:800;color:#8a6200">৳ ${waiterTotal.toLocaleString()}</span>
          </div>
          ${waiterPaid > 0 ? `<div style="display:flex;justify-content:space-between;margin-top:5px"><span style="font-size:10.5px;color:#2e8b57;font-weight:700">Paid</span><span style="font-size:10.5px;color:#2e8b57;font-weight:700">৳ ${waiterPaid.toLocaleString()}</span></div>` : ""}
          ${waiterPaid > 0 && waiterBal > 0 ? `<div style="display:flex;justify-content:space-between"><span style="font-size:10.5px;color:#8a6200">Remaining</span><span style="font-size:10.5px;color:#8a6200">৳ ${waiterBal.toLocaleString()}</span></div>` : ""}
          <div style="font-size:8px;color:#aa9560;font-style:italic;margin-top:5px">Pass-through — not hall revenue. Collected on behalf of waiters.</div>
        </div>
      </div>`
          : ""
      }

      <!-- Total collectible (informational, de-emphasised) -->
      <div style="padding:0 18px;margin-top:14px;border-top:1px solid #eee;padding-top:8px;display:flex;justify-content:space-between">
        <span style="font-size:11px;color:#999">Total collectible (Hall + Waiter)</span>
        <span style="font-size:12px;font-weight:700;color:#999">৳ ${totalPayable.toLocaleString()}</span>
      </div>

      <!-- Pay status badge -->
      <div style="padding:0 18px;margin-top:12px">
        <div style="padding:11px 16px;border-radius:7px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:10px;background:${psColor.bg};color:${psColor.color};border:1.5px solid ${psColor.border}">
          <span style="font-size:18px">${psColor.icon}</span>
          <div>
            <div>${psColor.label}</div>
            <div style="font-size:11px;font-weight:500;margin-top:1px;opacity:.8">Payment via ${inv.advMethod || "Cash"}${inv.bankName ? " — " + inv.bankName : ""}</div>
          </div>
        </div>
      </div>

      ${inv.note ? `<div style="padding:10px 18px;margin-top:10px;font-size:11px;color:#777;font-style:italic">📝 Note: ${inv.note}</div>` : ""}

      <!-- Signature line -->
      <div style="margin:18px 18px 0;padding-top:14px;border-top:1.5px solid #ddd">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px">
          <div style="text-align:center">
            <div style="height:40px;border-bottom:1.5px solid #333;margin-bottom:6px"></div>
            <div style="font-size:11px;font-weight:700;color:#333">Client Signature</div>
            <div style="font-size:10px;color:#555;margin-top:2px">${inv.client || ""}</div>
          </div>
          <div style="text-align:center">
            <div style="height:40px;border-bottom:1.5px solid #333;margin-bottom:6px"></div>
            <div style="font-size:11px;font-weight:700;color:#333">Authorised Signature</div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top:14px;padding:10px 18px 0;border-top:1.5px solid #ddd;text-align:center;font-size:11px;color:#555">
        <strong style="color:#7B1212;font-family:'Playfair Display',serif;font-size:13px">Amelia Convention Hall</strong> &nbsp;•&nbsp;
        +880 1838-616405 &nbsp;•&nbsp; ameliaconventionhall.com &nbsp;•&nbsp; Hajari Road, Shibpur-9 No. Ward, Sitakund, Chittagong
        <div style="margin-top:3px;font-size:10px;color:#aaa"><em>Serial #${inv.num}</em></div>
      </div>
    </div>

    ${
      withTerms
        ? `<!-- ═══ PAGE 2: TERMS & CONDITIONS ═══ -->
    <div class="page" style="padding:24px 18px;">
      <div style="border:2px solid #8B1A1A;border-radius:10px;overflow:hidden;font-family:'DM Sans',sans-serif">
        <div style="background:#8B1A1A;padding:10px 18px;text-align:center">
          <div style="font-size:16px;font-weight:700;color:#fff;letter-spacing:1px;font-family:'Playfair Display',serif">শর্তাবলী</div>
        </div>
        <div style="padding:16px 18px;background:#fff9f9">
          <table style="width:100%;border-collapse:collapse"><tbody>${termsRows}</tbody></table>
          <!-- Signature block -->
          <div style="margin-top:20px;border:1.5px solid #8B1A1A;border-radius:8px;overflow:hidden;max-width:320px">
            ${sigBlock("গ্রাহকের স্বাক্ষর")}
          </div>
          <!-- Acceptance -->
          <div style="margin:16px 0 0;padding:10px 16px;border:2px solid #8B1A1A;border-radius:8px;background:#fff5f5;font-size:11px;color:#3d0000;font-weight:600">
            ✅ আমি উপরের সকল শর্তাবলী পড়েছি এবং সম্পূর্ণ সম্মত আছি। <span style="color:#8B1A1A">(I have read and agreed to all the above Terms &amp; Conditions.)</span>
          </div>
        </div>
      </div>
    </div>`
        : ""
    }

    ${autoPrint ? "<script>window.onload=function(){window.print();}</script>" : ""}
    </body></html>`;

    return html;
  }

  return (
    <div
      className="hall-page"
      style={{
        padding: isMobile ? "10px 8px" : "22px 32px",
        maxWidth: 1200,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        className="hall-btn-row"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <button onClick={onBack} style={btnStyle()}>
          ‹ Back
        </button>
        <div
          className="hall-btn-row"
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          {inv.confirmed && bal > 0 && (
            <button
              onClick={() => setPayModal(true)}
              style={btnStyle("primary", "sm")}
            >
              💳 Collect Hall Payment
            </button>
          )}
          {inv.confirmed && waiterBal > 0 && (
            <button
              onClick={() => setWaiterPayModal(true)}
              style={{
                ...btnStyle("", "sm"),
                borderColor: "#c9a84c",
                color: "#8a6200",
              }}
            >
              🍽️ Collect Waiter Cost
            </button>
          )}
          {(inv.isLead || !inv.confirmed) && (
            <button onClick={onEdit} style={btnStyle("", "sm")}>
              ✏️ Edit
            </button>
          )}
          {!inv.confirmed && !inv.isLead && (
            <button
              onClick={confirmAndPrint}
              style={{
                ...btnStyle("primary", "sm"),
                background: "#1a7a40",
                borderColor: "#1a7a40",
              }}
            >
              ✅ Confirm &amp; Print
            </button>
          )}
          {inv.isLead && (
            <>
              <button
                onClick={() => printInvoice(true)}
                style={btnStyle("", "sm")}
              >
                🖨 Print Booking
              </button>
              <button
                onClick={() => printInvoice(false)}
                style={btnStyle("", "sm")}
              >
                🧾 Reprint Receipt
              </button>
            </>
          )}
          {inv.confirmed && (
            <>
              <button onClick={previewInvoice} style={btnStyle("", "sm")}>
                👁 Preview
              </button>
              <button
                onClick={() => printInvoice(false)}
                style={btnStyle("", "sm")}
              >
                🧾 Reprint
              </button>
            </>
          )}
        </div>
      </div>

      {!inv.confirmed && !inv.isLead && (
        <div
          style={{
            marginBottom: 14,
            padding: "14px 18px",
            borderRadius: 10,
            background: "#fff8e1",
            border: "1.5px solid #f0b429",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>🔎</span>
          <div>
            <div style={{ fontWeight: 800, color: "#7a4a00", fontSize: 14 }}>
              Preview — Not Yet Confirmed
            </div>
            <div style={{ fontSize: 12, color: "#7a4a00", marginTop: 2 }}>
              Review every detail below. If something is wrong, click{" "}
              <strong>Edit</strong> to fix it and come back. Once everything
              looks correct, click <strong>Confirm &amp; Print</strong> to
              finalize this invoice.
            </div>
          </div>
        </div>
      )}

      {/* Post-payment banner */}
      {payDone && (
        <div
          style={{
            marginBottom: 14,
            padding: "14px 18px",
            borderRadius: 10,
            background: "#d4f5e2",
            border: "1.5px solid #2e8b57",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontWeight: 800, color: "#074d22", fontSize: 14 }}>
                Payment Updated Successfully
              </div>
              <div style={{ fontSize: 12, color: "#1a5c30", marginTop: 2 }}>
                Total Paid: <strong>৳{payDone.newPaid.toLocaleString()}</strong>
                {payDone.newBal > 0 ? (
                  <>
                    {" "}
                    &nbsp;·&nbsp; Remaining:{" "}
                    <strong>৳{payDone.newBal.toLocaleString()}</strong>
                  </>
                ) : (
                  <>
                    {" "}
                    &nbsp;·&nbsp; <strong>Fully Paid 🎉</strong>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => printInvoice(false)}
            style={{ ...btnStyle("primary", "sm"), flexShrink: 0 }}
          >
            🧾 Print Final Receipt
          </button>
        </div>
      )}

      {waiterPayDone && (
        <div
          style={{
            marginBottom: 14,
            padding: "14px 18px",
            borderRadius: 10,
            background: "#fafafa",
            border: "1.5px solid #ccc",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🍽️</span>
            <div>
              <div style={{ fontWeight: 800, color: "#444", fontSize: 14 }}>
                Waiter Cost Collection Updated
              </div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                Total Collected:{" "}
                <strong>৳{waiterPayDone.newPaid.toLocaleString()}</strong>
                {waiterPayDone.newBal > 0 ? (
                  <>
                    {" "}
                    &nbsp;·&nbsp; Remaining:{" "}
                    <strong>৳{waiterPayDone.newBal.toLocaleString()}</strong>
                  </>
                ) : (
                  <>
                    {" "}
                    &nbsp;·&nbsp; <strong>Fully Settled ✅</strong>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick status strip */}
      <div style={card({ marginBottom: 14 })}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: "'Playfair Display',serif",
                color: C.maroon,
              }}
            >
              Invoice #{inv.num}
            </div>
            <div style={{ fontSize: 12, color: C.dim }}>
              {inv.client} · {inv.evType} · {fmtDate(inv.evDate)}
            </div>
            {inv.isLead && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  background: "#fef3c7",
                  color: "#92400e",
                  padding: "2px 8px",
                  borderRadius: 20,
                  border: "1px solid #fcd34d",
                }}
              >
                LEAD
              </span>
            )}
          </div>
          <span
            style={{
              padding: "6px 18px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 800,
              background: ps.bg,
              color: ps.color,
              border: "1.5px solid " + ps.border,
            }}
          >
            {ps.icon} {inv.payStatus}
          </span>
        </div>
      </div>

      {/* Full invoice replica — exactly what the customer receives */}
      <div style={card({ padding: 0, marginBottom: 14, overflow: "hidden" })}>
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid " + C.border,
            fontWeight: 800,
            fontSize: 12,
            color: C.maroon,
            background: "#faf8f3",
          }}
        >
          📄 Invoice Preview — exactly as the customer receives it
          {isMobile ? " (pinch to zoom for detail)" : ""}
        </div>
        {isMobile ? (
          <div
            style={{ width: "100%", height: 1400 * 0.42, overflow: "hidden" }}
          >
            <iframe
              title="Invoice preview"
              srcDoc={buildInvoiceHtml(false, false)}
              style={{
                width: 800,
                height: 1400,
                border: "none",
                display: "block",
                transform: "scale(0.42)",
                transformOrigin: "top left",
              }}
            />
          </div>
        ) : (
          <iframe
            title="Invoice preview"
            srcDoc={buildInvoiceHtml(false, false)}
            style={{
              width: "100%",
              height: 1400,
              border: "none",
              display: "block",
            }}
          />
        )}
      </div>

      {/* Voter ID Card */}
      {inv.voterIdData && (
        <div style={card({ marginBottom: 14, padding: 0, overflow: "hidden" })}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid " + C.border, fontWeight: 800, fontSize: 12, color: C.maroon, background: "#faf8f3" }}>
            🪪 Voter ID Card
          </div>
          <div style={{ padding: 16 }}>
            <img src={inv.voterIdData} alt="Voter ID" style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, border: "2px solid " + C.border, objectFit: "contain", display: "block" }} />
            {inv.voterIdName && <div style={{ marginTop: 8, fontSize: 11, color: C.dim }}>{inv.voterIdName}</div>}
          </div>
        </div>
      )}

      {payModal && (
        <div
          className="modal-overlay open"
          onClick={(e) => e.target === e.currentTarget && setPayModal(false)}
        >
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">💳 Collect Payment</div>
              <button
                className="modal-close"
                onClick={() => setPayModal(false)}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
                padding: 10,
                background: "#f8f8f8",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <div>
                Hall Charges Total
                <br />
                <strong>৳{grand.toLocaleString()}</strong>
              </div>
              <div>
                Hall Balance Due
                <br />
                <strong style={{ color: C.red }}>
                  ৳{bal.toLocaleString()}
                </strong>
              </div>
            </div>
            <div className="form-group">
              <label>Amount Received (৳) *</label>
              <input
                type="number"
                min="0"
                max={bal}
                value={payAmt}
                onChange={(e) => setPayAmt(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                {PAY_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setPayModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={collectPayment}>
                ✓ Confirm Hall Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {waiterPayModal && (
        <div
          className="modal-overlay open"
          onClick={(e) =>
            e.target === e.currentTarget && setWaiterPayModal(false)
          }
        >
          <div className="modal-box" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <div className="modal-title">🍽️ Collect Waiter Cost</div>
              <button
                className="modal-close"
                onClick={() => setWaiterPayModal(false)}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 14,
                padding: 10,
                background: "#fafafa",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <div>
                Waiter Cost Total
                <br />
                <strong>৳{waiterTotal.toLocaleString()}</strong>
              </div>
              <div>
                Waiter Balance
                <br />
                <strong style={{ color: "#8a6200" }}>
                  ৳{waiterBal.toLocaleString()}
                </strong>
              </div>
            </div>
            <div className="form-group">
              <label>Amount Received (৳) *</label>
              <input
                type="number"
                min="0"
                max={waiterBal}
                value={waiterPayAmt}
                onChange={(e) => setWaiterPayAmt(e.target.value)}
                autoFocus
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#999",
                fontStyle: "italic",
                marginBottom: 10,
              }}
            >
              This is separate from hall revenue — collected on behalf of waiter
              staff.
            </div>
            <div className="modal-actions">
              <button className="btn" onClick={() => setWaiterPayModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={collectWaiterPayment}>
                ✓ Confirm Waiter Collection
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <DeleteModal
          modal={deleteModal}
          delPass={delPass}
          setDelPass={setDelPass}
          onConfirm={confirmDelete}
          onClose={() => setDeleteModal(null)}
        />
      )}

      {previewOpen && (
        <div
          className="modal-overlay open"
          onClick={(e) => e.target === e.currentTarget && setPreviewOpen(false)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "min(900px,95vw)",
              height: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 18px",
                borderBottom: "1px solid " + C.border,
                background: "#faf8f3",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 14, color: C.maroon }}>
                👁 Invoice Preview
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#888",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto" }}>
              {isMobile ? (
                <iframe
                  title="Invoice preview"
                  srcDoc={buildInvoiceHtml(false, false)}
                  style={{
                    width: 800,
                    height: 1400,
                    border: "none",
                    display: "block",
                    transform: "scale(0.42)",
                    transformOrigin: "top left",
                  }}
                />
              ) : (
                <iframe
                  title="Invoice preview"
                  srcDoc={buildInvoiceHtml(false, false)}
                  style={{
                    width: "100%",
                    height: "100%",
                    border: "none",
                    display: "block",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ modal, delPass, setDelPass, onConfirm, onClose }) {
  return (
    <div
      className="modal-overlay open"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal-box" style={{ maxWidth: 370 }}>
        <div className="modal-header">
          <div className="modal-title">🗑 Delete Invoice</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div style={{ fontSize: 13, marginBottom: 14 }}>
          Delete invoice <strong>#{modal.num}</strong> for{" "}
          <strong>{modal.client}</strong>?
        </div>
        <div className="form-group">
          <label>Admin Password *</label>
          <input
            type="password"
            value={delPass}
            onChange={(e) => setDelPass(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn danger" onClick={onConfirm}>
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pay Status Styles ────────────────────────────────────────────────────────
const PS_STYLE = {
  Paid: { bg: "#d4f5e2", color: "#074d22", border: "#2e8b57", icon: "✅" },
  Partial: { bg: "#fef0b0", color: "#5a3800", border: "#c8960a", icon: "⚠️" },
  Unpaid: { bg: "#fcd5d5", color: "#6b0000", border: "#c03030", icon: "⭕" },
  Cancelled: { bg: "#f5f5f5", color: "#555", border: "#ccc", icon: "❌" },
};

// ─── Style Helpers ────────────────────────────────────────────────────────────
function card(extra = {}) {
  return {
    background: C.white,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,.07)",
    boxShadow: "0 1px 4px rgba(0,0,0,.06)",
    padding: "16px 20px",
    marginBottom: 12,
    ...extra,
  };
}
function inputStyle(extra = {}) {
  return {
    padding: "9px 12px",
    border: "1.5px solid " + C.border,
    borderRadius: 8,
    fontSize: 13,
    fontFamily: "inherit",
    background: "#fafaf9",
    color: C.text,
    outline: "none",
    boxSizing: "border-box",
    width: "100%",
    ...extra,
  };
}
function btnStyle(type = "", size = "") {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontFamily: "inherit",
    cursor: "pointer",
    fontWeight: 700,
    borderRadius: 9,
    transition: ".15s",
  };
  const sz =
    size === "sm"
      ? { padding: "5px 10px", fontSize: 11 }
      : { padding: "8px 16px", fontSize: 12 };
  if (type === "primary")
    return {
      ...base,
      ...sz,
      background: "linear-gradient(135deg,#c9a84c,#e8c96c)",
      border: "1.5px solid #c9a84c",
      color: "#1a1a2e",
    };
  if (type === "danger")
    return {
      ...base,
      ...sz,
      background: "#fee2e2",
      border: "1.5px solid #fca5a5",
      color: "#991b1b",
    };
  return {
    ...base,
    ...sz,
    background: C.white,
    border: "1.5px solid " + C.border,
    color: C.text,
  };
}
function sectionBadge() {
  return {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#fff",
    background: C.maroon,
    padding: "4px 12px",
    borderRadius: 20,
  };
}
function Section({ label, children }) {
  return (
    <div style={card()}>
      <div style={{ marginBottom: 10 }}>
        <span style={sectionBadge()}>{label}</span>
      </div>
      {children}
    </div>
  );
}
function SubSection({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
          padding: "6px 12px",
          background: "#fff5f0",
          borderRadius: 8,
          borderLeft: "3px solid " + C.maroon,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            color: C.maroon,
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        marginBottom: 8,
      }}
    >
      <label
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#444",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
