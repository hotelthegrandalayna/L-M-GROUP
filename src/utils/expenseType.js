// Hotel expense type (business / nonbusiness) — single source of truth.
// The type map is stored in Supabase app_config (key "hotel_exp_types") and
// synced to every device via AppContext. localStorage is only an offline cache.

export const HOTEL_NONBIZ_CATS = [
  "Bank Transfer", "Owner Withdrawal", "Donation", "Lending", "Personal Use", "Other Transfer",
];

export function hotelExpenseType(e, map = {}) {
  const t = map[String(e.id)] || e.expType;
  if (t === "nonbusiness") return "nonbusiness";
  if (t === "business") return "business";
  // No explicit type known — infer from category (non-business categories are unique)
  if (HOTEL_NONBIZ_CATS.includes(e.category)) return "nonbusiness";
  return "business";
}

export function hotelBusinessOnly(expenses, map = {}) {
  return expenses.filter(e => hotelExpenseType(e, map) === "business");
}
