// Income that never had a booking or an invoice behind it.
//
// Every other revenue row in the hotel is created automatically — by a booking
// taking payment, or by an invoice. Money that arrived without either had no way
// in at all, and the booking form cannot be back-dated past yesterday, so a past
// month could not be corrected.
//
// This is NOT a fake invoice: inventing a booking to carry the money would
// distort occupancy, guest records and room statistics. A manual revenue row is
// already a first-class idea in the money engine — monthMoney counts rows with no
// bookingId in their own month, as billed AND collected, with nothing outstanding
// (see lib/hotelMoney.js). Only the screen was missing.
//
// Admin only, because it puts money into a month that is already closed.
//
// NOTE: module scope, deliberately. A component declared inside another is a new
// type on every render, and the inputs lose focus after each keystroke.
import { useState } from "react";
import { money, newLocalId, todayStr } from "../utils/helpers";
import { deleteRow } from "../utils/supabaseSync";

const monthLabel = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleString("en-GB", { month: "long", year: "numeric" });
};

/** A sensible date inside the month being viewed: today if it is that month, else its last day. */
export function defaultDate(month) {
  const today = todayStr();
  if (!month || today.startsWith(month)) return today;
  const [y, mo] = month.split("-").map(Number);
  // Day 0 of the next month is the last day of this one. Built as a string rather
  // than via toISOString(), which converts to UTC and lands a day early for anyone
  // east of Greenwich — in Bangladesh it turned 30 June into 29 June.
  const lastDay = new Date(y, mo, 0).getDate();
  return `${y}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

/** Rows nobody's booking produced — the only ones this screen may touch. */
export function manualRowsIn(revenues, month) {
  return (revenues || []).filter(
    (r) => !r.bookingId && !r.fromBooking && (r.date || "").startsWith(month || ""),
  );
}

export default function ManualIncome({ month, revenues, updateRevenues, curUser, isAdmin, card, capLbl, num }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => defaultDate(month));
  const [source, setSource] = useState("Revenue Adjustment");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!isAdmin) return null;

  const rows = manualRowsIn(revenues, month);
  const rowsTotal = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const amt = parseFloat(amount) || 0;
  const landsIn = (date || "").slice(0, 7);

  const inp = (extra = {}) => ({
    width: "100%", padding: "9px 11px", borderRadius: 8, fontFamily: "inherit",
    fontSize: 14, fontWeight: 600, border: "1.5px solid var(--border)",
    background: "var(--bg)", color: "var(--text)", boxSizing: "border-box", ...extra,
  });
  const lbl = {
    display: "block", fontSize: 10, fontWeight: 800, letterSpacing: .8,
    textTransform: "uppercase", color: "var(--text3)", marginBottom: 5,
  };

  function reset() {
    setAmount(""); setNote(""); setSource("Revenue Adjustment");
    setDate(defaultDate(month)); setErr(""); setConfirming(false);
  }

  function ask() {
    if (!(amt > 0))  { setErr("Enter an amount above zero."); return; }
    if (!date)       { setErr("Pick the date the money was received."); return; }
    if (!source.trim()) { setErr("Say where the money came from."); return; }
    setErr("");
    setConfirming(true);
  }

  function save() {
    updateRevenues((prev) => [...prev, {
      id: newLocalId(),
      source: source.trim(),
      amount: amt,
      date,
      note: note.trim(),
      by: curUser || "admin",
      // No bookingId: that is exactly what makes monthMoney count it by its own
      // date rather than by a stay. Do not add one.
    }]);
    reset();
    setOpen(false);
  }

  function remove(row) {
    updateRevenues((prev) => prev.filter((r) => String(r.id) !== String(row.id)));
    // The upsert above only writes rows that still exist, so the deleted one has
    // to be removed from the cloud explicitly or it returns on the next sync.
    deleteRow("revenues", row.id).catch(() => {});
  }

  return (
    <div style={{ ...card, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={capLbl}>Income without an invoice</span>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>
          {rows.length
            ? <>{rows.length} entr{rows.length > 1 ? "ies" : "y"} in {monthLabel(month)} · <strong style={{ color: "var(--text)", ...num }}>{money(rowsTotal)}</strong></>
            : <>nothing recorded in {monthLabel(month)}</>}
        </span>
        <button
          // Opening the form re-reads the month being viewed. Without this the
          // date keeps whatever it was when the panel first rendered, so
          // switching to June and adding income silently dated it to today.
          onClick={() => {
            setOpen(o => {
              if (!o) setDate(defaultDate(month));
              return !o;
            });
            setErr(""); setConfirming(false);
          }}
          style={{
            marginLeft: "auto", padding: "7px 13px", borderRadius: 8, cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: 800,
            border: "1.5px solid var(--navy)", background: open ? "var(--navy)" : "var(--bg)",
            color: open ? "#fff" : "var(--navy)",
          }}
        >
          {open ? "Close" : "+ Add income"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11 }}>
            <div>
              <label style={lbl}>Amount (৳)</label>
              <input type="number" min="0" value={amount} placeholder="0"
                onWheel={e => e.target.blur()}
                onChange={e => { setAmount(e.target.value); setConfirming(false); }}
                style={inp({ fontSize: 16, fontWeight: 800 })} />
            </div>
            <div>
              <label style={lbl}>Date received</label>
              <input type="date" value={date}
                onChange={e => { setDate(e.target.value); setConfirming(false); }}
                style={inp()} />
            </div>
            <div>
              <label style={lbl}>Source</label>
              <input value={source} placeholder="Revenue Adjustment"
                onChange={e => { setSource(e.target.value); setConfirming(false); }}
                style={inp()} />
            </div>
          </div>

          <div style={{ marginTop: 11 }}>
            <label style={lbl}>Note</label>
            <input value={note} placeholder="What was this money for?"
              onChange={e => setNote(e.target.value)}
              style={inp({ fontWeight: 500 })} />
          </div>

          {err && (
            <div style={{ marginTop: 9, fontSize: 12, fontWeight: 700, color: "var(--red, #c0392b)" }}>{err}</div>
          )}

          {/* The month is what actually matters here, so it is stated rather than
              left for the owner to work out from the date. */}
          {amt > 0 && landsIn && (
            <div style={{
              marginTop: 11, padding: "10px 12px", borderRadius: 9,
              background: "var(--bg2)", border: "1px solid var(--border)",
              fontSize: 12.5, color: "var(--text2)", lineHeight: 1.6,
            }}>
              Adds <strong style={{ color: "var(--text)", ...num }}>{money(amt)}</strong> to{" "}
              <strong style={{ color: "var(--text)" }}>{monthLabel(landsIn)}</strong> — counted as
              money received, so it adds nothing to outstanding.
              {landsIn !== month && (
                <div style={{ marginTop: 5, fontWeight: 700, color: "var(--red, #c0392b)" }}>
                  Note: you are viewing {monthLabel(month)}, so it will not appear on this screen
                  until you switch to {monthLabel(landsIn)}.
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button onClick={() => { reset(); setOpen(false); }}
              style={{ padding: "9px 15px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, border: "1.5px solid var(--border)",
                background: "var(--bg)", color: "var(--text2)" }}>
              Cancel
            </button>
            {confirming ? (
              <button onClick={save}
                style={{ padding: "9px 15px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 800, border: "none", background: "var(--navy)", color: "#fff" }}>
                ✓ Confirm — add {money(amt)} to {monthLabel(landsIn)}
              </button>
            ) : (
              <button onClick={ask}
                style={{ padding: "9px 15px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 13, fontWeight: 800, border: "none", background: "var(--navy)", color: "#fff" }}>
                Add income
              </button>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
          {rows.map((r) => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
              borderBottom: "1px solid var(--border)", fontSize: 12.5, flexWrap: "wrap",
            }}>
              <span style={{ fontWeight: 700 }}>{r.source || "Income"}</span>
              <span style={{ color: "var(--text3)" }}>{r.date}</span>
              {r.note && <span style={{ color: "var(--text3)" }}>· {r.note}</span>}
              <span style={{ marginLeft: "auto", fontWeight: 800, ...num }}>{money(r.amount)}</span>
              {r.by && <span style={{ color: "var(--text3)", fontSize: 11 }}>by {r.by}</span>}
              <button onClick={() => remove(r)} title="Remove this entry"
                style={{ padding: "3px 8px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                  fontSize: 11, fontWeight: 700, border: "1.5px solid var(--border)",
                  background: "var(--bg)", color: "var(--red, #c0392b)" }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
