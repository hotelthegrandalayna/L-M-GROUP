# Hotel The Grand Alayna — engineering rules

**These are owner-confirmed business invariants. Do not "improve", simplify, or
re-derive them. Breaking one costs the owner real money and has happened before.**

---

## 1. Money rules (highest risk area)

### One source of truth
All monthly money comes from `src/lib/hotelMoney.js` (`monthMoney`, `bookingMonthlyParts`,
`useMonthBookings`). **Never compute monthly revenue anywhere else.** Four screens
consume it and must always agree to the taka:
Desk P&L · Expenses & Cash · Admin › Finance · Admin › Invoices.

### Attribution: MONEY FOLLOWS THE NIGHT STAYED
A stay is split **night by night**; each night's share belongs to that night's month.
A guest checking in **31 Jul** and leaving **2 Aug** puts the 31-Jul night in July and
the 1-Aug night in August. Recorded extensions keep their exact amount and land in
their extra-night month.

Rejected alternatives — **do not reintroduce**:
- *Cash basis / payment-date* — owner counts a July stay paid in August as July revenue.
- *Whole stay to check-in month* — hides the Aug-1 night of a 31-Jul arrival.

### Never drop money
Every taka in a booking's `paymentHistory` must appear in **exactly one** month —
never zero, never twice. Payments beyond the room invoice (services, extras, top-ups)
count in the month received. If you change the allocation loop, keep this invariant.

### Completeness
Past months must be computed from the **complete month** loaded from the cloud
(`useMonthBookings`), never the rolling ~30-day live window, or totals drift as old
bookings age out of memory.

---

## 2. Multi-room bookings

**A booking can cover several rooms in TWO different shapes. Any code that touches
rooms/money must handle BOTH, or bugs reappear in only one of them:**

| Shape | Where it comes from |
|---|---|
| `b.isMultiRoomBooking` + `b.multiRooms[]` | legacy multi-room card form |
| `b.room` (primary) + `b.extraRooms[]` | the "Add more rooms for this guest" chip selector |

Helpers that already handle both — **use these, don't hand-roll**:
- `allRoomNumbers(b)` / `roomLabel(b)` — `src/components/Invoice.jsx`
- `roomShares(b)` — `src/components/Desk.jsx` (equal per-room money breakdown)
- `bookingCoversRoom(b, n)` / `roomBookingWindow(b, n)` — `src/utils/helpers.js`

### Every room is equal — there is no "primary room" in any display
Invoices, room popups and labels must show all rooms the same way.

### Invoice line-item arithmetic (this exact bug shipped twice)
List each room at its **GROSS** amount, then that room's own `Discount — Rm N` line
directly beneath it. The global discount row then carries **only the primary room's
share** (`disc − sum(extraRooms.discAmt)`).

**Never** print an extra room at its already-net `amount` while also subtracting the
full `discAmt` — that double-counts the extras' discounts and makes the sub-total
disagree with the total (real case: booking 102 showed sub-total 4,900 vs total 6,800).

Invariant: `sum(room gross) − total discount === accommodation sub-total === total`.

---

## 3. Sync / data integrity

- **A save must create exactly one cloud row.** Never re-`POST` a booking that already
  has `supabaseBookingId`; update it. A fresh save gets a grace period before any
  retry considers it failed — this race previously created duplicate bookings every
  8 seconds (ids 101,102,103…), which tripled revenue and flooded the room map.
- **Deletes use tombstones.** `gaRecordDeleted(kind, id)` writes a cloud tombstone
  (`app_config.hotel_deleted_ids`); `gaSyncDeletedFromCloud()` runs first in every
  sync so a delete sticks on every device and can't resurrect.
- **Local-only fields must be preserved in the sync merge** (`AppContext.jsx`), e.g.
  `extensions`, `invoiceExtras`, `paymentHistory`, `guestType`. They have no Supabase
  column and are lost on every sync if not explicitly restored.
- Dates: never use `toISOString().slice(0,10)` for local dates — it shifts the day
  across timezones. Use a local formatter (`y-m-d` from `getFullYear/Month/Date`).

---

## 4. Working agreement

- **Deploy only when the owner says "deploy".** Never push otherwise.
- Never touch the separate website repo (`Alyna_web`) from this app repo.
- Cross-device state must sync via Supabase `app_config` — never localStorage only;
  the owner monitors from Denmark on different machines.
- Money/revenue changes are display-level maths wherever possible. Do not rewrite
  stored booking records to fix a reporting problem.
