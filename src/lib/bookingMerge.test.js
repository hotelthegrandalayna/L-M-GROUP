// The bug these tests exist to stop: two devices showing different revenue for
// the same booking because each kept its own payment history.
import { describe, it, expect } from "vitest";
import { mergeBooking, mergePaymentHistory, unsyncedPayments, paymentKey } from "./bookingMerge";

const pay = (ts, amount, note = "Advance paid") => ({ ts, amount, method: "Cash", note, type: "room" });

const cloud = {
  id: 118, supabaseBookingId: 118, guest: "Tayeb", room: "101",
  checkin: "2026-08-13", checkout: "2026-08-16",
  invoiceTotal: 8000, amount: 8000, discAmt: 5000,
  paymentHistory: [pay("2026-08-13T11:52:00Z", 4000), pay("2026-08-14T13:38:00Z", 2000, "Extend stay +1 night")],
};

describe("payment history is the cloud's job", () => {
  it("takes the cloud list when the device is merely stale", () => {
    const local = { ...cloud, invoiceTotal: 4000, paymentHistory: [pay("2026-08-13T11:52:00Z", 4000)] };
    const { booking, needsPush } = mergeBooking(cloud, local);
    expect(booking.paymentHistory).toHaveLength(2);
    expect(booking.invoiceTotal).toBe(8000);      // never the stale local total
    expect(needsPush).toBe(false);
  });

  it("does not resurrect a payment an admin deleted in the cloud", () => {
    const local = { ...cloud, paymentHistory: [...cloud.paymentHistory, pay("2026-08-13T09:00:00Z", 9999, "Deleted by admin")] };
    const { booking } = mergeBooking(cloud, local);
    expect(booking.paymentHistory.some(p => p.amount === 9999)).toBe(false);
  });

  it("keeps a payment taken on this device that the cloud has not got yet", () => {
    const local = { ...cloud, paymentHistory: [...cloud.paymentHistory, pay("2026-08-15T10:00:00Z", 1500, "Rest payment")] };
    const { booking, needsPush } = mergeBooking(cloud, local);
    expect(booking.paymentHistory).toHaveLength(3);
    expect(needsPush).toBe(true);
  });

  it("gives every device the same answer from the same cloud row", () => {
    const deviceA = { ...cloud, invoiceTotal: 4000, paymentHistory: [pay("2026-08-13T11:52:00Z", 4000)] };
    const deviceB = { ...cloud, paymentHistory: [...cloud.paymentHistory, pay("2026-06-01T10:00:00Z", 500, "old leftover")] };
    const a = mergeBooking(cloud, deviceA).booking;
    const b = mergeBooking(cloud, deviceB).booking;
    const total = bk => bk.paymentHistory.reduce((s, p) => s + p.amount, 0);
    expect(total(a)).toBe(total(b));
    expect(a.invoiceTotal).toBe(b.invoiceTotal);
  });

  it("orders merged payments by time", () => {
    const merged = mergePaymentHistory(cloud.paymentHistory, [pay("2026-08-15T10:00:00Z", 1500)]);
    expect(merged.map(p => p.ts)).toEqual([...merged.map(p => p.ts)].sort());
  });

  it("treats identical entries as one payment", () => {
    expect(paymentKey(pay("2026-08-13T11:52:00Z", 4000))).toBe(paymentKey(pay("2026-08-13T11:52:00Z", 4000)));
    expect(unsyncedPayments(cloud.paymentHistory, [pay("2026-08-13T11:52:00Z", 4000)])).toHaveLength(0);
  });

  it("copes with a booking that has no payments at all", () => {
    const { booking } = mergeBooking({ ...cloud, paymentHistory: [] }, { ...cloud, paymentHistory: undefined });
    expect(booking.paymentHistory).toEqual([]);
  });
});

describe("fields the cloud cannot store", () => {
  it("keeps local-only invoice extras and companions", () => {
    const local = { ...cloud, invoiceExtras: [{ label: "Laundry", amount: 300 }], spouseName: "Mrs Tayeb" };
    const { booking } = mergeBooking(cloud, local, { guestType: "couple", spouseName: "", groupMembers: [] });
    expect(booking.invoiceExtras).toHaveLength(1);
    expect(booking.spouseName).toBe("Mrs Tayeb");
    expect(booking.guestType).toBe("couple");
  });

  it("still refuses to take money fields from local", () => {
    const local = { ...cloud, invoiceTotal: 99999, amount: 99999, invoiceExtras: [{ label: "x", amount: 1 }] };
    const { booking } = mergeBooking(cloud, local);
    expect(booking.invoiceTotal).toBe(8000);
    expect(booking.amount).toBe(8000);
  });
});
