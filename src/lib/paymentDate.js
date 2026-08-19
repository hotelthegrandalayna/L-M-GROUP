// When money is added to a booking, which day does it count on?
//
// Two different actions, and they must not be confused:
//
//   COLLECTING money — a guest hands over cash now. It counts TODAY. That is
//   what the cash box holds at the end of the day.
//
//   CHANGING an invoice — the manager under-recorded a stay and it is corrected
//   later. That money belongs to the INVOICE'S OWN DAY, not to the day someone
//   noticed. Otherwise correcting a 17 August invoice on the 19th makes the 19th
//   look like a good day and leaves the 17th short.
//
// Admin → Invoices has followed this rule since 2026-08-09; this puts the same
// rule everywhere, so it holds whichever screen the change is made from.
export function paymentTs({ isEdit, stayDate, now = new Date() }) {
  const day = String(stayDate || "").slice(0, 10);
  if (isEdit && /^\d{4}-\d{2}-\d{2}$/.test(day)) return `${day}T12:00:00.000Z`;
  return now.toISOString();
}
