const KEY = "ga_pricing_rules";

export function loadPricingRules() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export function savePricingRules(rules) {
  localStorage.setItem(KEY, JSON.stringify(rules));
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
