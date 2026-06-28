import { hasSupabase, upsertRows, loadRows } from "../../utils/supabaseSync";

const KEY = "ga_pricing_rules";

export function loadPricingRules() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function savePricingRules(rules) {
  localStorage.setItem(KEY, JSON.stringify(rules));
  if (hasSupabase() && rules.length) {
    const rows = rules.map((r, i) => ({
      id: String(r.id || `${r.evType}_${i}`),
      ev_type: r.evType || "",
      min_guests: parseInt(r.minGuests) || 0,
      max_guests: parseInt(r.maxGuests) || 999999,
      min_price: parseFloat(r.minPrice) || 0,
      max_price: parseFloat(r.maxPrice) || 0,
      notes: r.notes || "",
    }));
    upsertRows("pricing_rules", rows).catch(() => {});
  }
}

export async function syncPricingRulesFromSupabase() {
  if (!hasSupabase()) return;
  try {
    const rows = await loadRows("pricing_rules");
    if (!rows || !rows.length) return;
    const rules = rows.map(r => ({
      id: r.id, evType: r.ev_type,
      minGuests: r.min_guests, maxGuests: r.max_guests,
      minPrice: r.min_price, maxPrice: r.max_price, notes: r.notes,
    }));
    localStorage.setItem(KEY, JSON.stringify(rules));
  } catch {}
}

export function getMatchingRule(rules, evType, guests) {
  if (!evType || !guests) return null;
  const g = parseInt(guests) || 0;
  return rules.find(r =>
    r.evType === evType &&
    g >= (parseInt(r.minGuests) || 0) &&
    g <= (parseInt(r.maxGuests) || 999999)
  ) || null;
}

export function getHistoricalPricing(invoices, evType, guests) {
  if (!evType || !guests) return null;
  const g = parseInt(guests) || 0;
  const margin = Math.max(50, Math.round(g * 0.35));
  const similar = invoices.filter(inv => {
    const invGuests = parseInt(inv.wGuests || inv.hGuests || inv.guests) || 0;
    return inv.evType === evType && inv.grand > 0 && Math.abs(invGuests - g) <= margin;
  });
  if (similar.length < 2) return null;
  const prices = similar.map(inv => inv.grand);
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  return { avg, min: Math.min(...prices), max: Math.max(...prices), count: similar.length };
}
