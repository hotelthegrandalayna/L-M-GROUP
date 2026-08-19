// The category filter for Expenses & Cash, in both the hotel and the hall.
//
// It replaces a single-choice dropdown: the owner asked to look at Salaries and
// Electricity together instead of one at a time. Each chip carries that
// category's total for the month on screen, so the choice is informed before it
// is made. Nothing selected means every category — see src/lib/catFilter.js.
//
// Purely presentational: it owns no state, so the two tabs keep their own filter
// and cannot fight each other.
import { catScopeLabel } from "../lib/catFilter";

const money = (n, sym) => sym + Math.round(n || 0).toLocaleString("en-US");

export default function CategoryChips({
  groups,            // [{ name, options: [{ v, l }] }]
  selected = [],
  onToggle,
  onSelectAll,
  onClear,
  totals = {},       // { [category]: amount } — shown on the chip
  accent = "#1e3a5f",
  currency = "৳",
  label = "Categories",
}) {
  const all = groups.flatMap((g) => g.options.map((o) => o.v));
  const scope = catScopeLabel(selected, all.length);
  const isOn = (v) => selected.includes(v);

  const linkBtn = {
    font: "inherit", fontSize: 11, fontWeight: 700, color: accent,
    background: "none", border: "none", padding: "3px 6px",
    borderRadius: 6, cursor: "pointer",
  };

  return (
    <div style={{
      border: "1.5px solid var(--border, #d5dce6)", borderRadius: 10,
      padding: "10px 12px 11px", background: "var(--bg2, #fafcfe)",
      display: "flex", flexDirection: "column", gap: 9, marginBottom: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: .9,
          textTransform: "uppercase", color: "var(--text3, #8697ad)",
        }}>
          {label} — showing {scope}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          <button type="button" style={linkBtn} onClick={onSelectAll}>Select all</button>
          <button type="button" style={linkBtn} onClick={onClear}>Clear</button>
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.name} style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <span style={{
            width: "100%", fontSize: 10, fontWeight: 700, letterSpacing: .7,
            textTransform: "uppercase", color: "var(--text3, #8697ad)", marginBottom: 1,
          }}>
            {g.name}
          </span>
          {g.options.map((o) => {
            const on = isOn(o.v);
            const spent = totals[o.v] || 0;
            return (
              <button
                key={o.v}
                type="button"
                aria-pressed={on}
                onClick={() => onToggle && onToggle(o.v)}
                title={spent ? `${o.v} — ${money(spent, currency)} this month` : `${o.v} — nothing this month`}
                style={{
                  font: "inherit", fontSize: 12, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                  border: `1.5px solid ${on ? accent : "var(--border, #d5dce6)"}`,
                  background: on ? accent : "var(--bg, #fff)",
                  color: on ? "#fff" : "var(--text, #0f1a2b)",
                  opacity: !on && !spent ? .55 : 1,
                }}
              >
                {on && <span style={{ fontSize: 10 }}>✓</span>}
                {o.l}
                {spent > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 500, opacity: .7, fontVariantNumeric: "tabular-nums" }}>
                    {money(spent, currency)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
