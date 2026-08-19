// Correcting an invoice must never land on today's revenue. Editing a 17 August
// invoice on the 19th puts the money on the 17th, where the stay was.
import { describe, it, expect } from "vitest";
import { paymentTs } from "./paymentDate";

const now = new Date("2026-08-19T09:30:00.000Z");

describe("editing an invoice", () => {
  it("dates the money to the invoice, not to today", () => {
    expect(paymentTs({ isEdit: true, stayDate: "2026-08-17", now })).toBe("2026-08-17T12:00:00.000Z");
  });

  it("works across months — a July invoice corrected in August stays in July", () => {
    expect(paymentTs({ isEdit: true, stayDate: "2026-07-31", now }).slice(0, 7)).toBe("2026-07");
  });

  it("uses midday, so no timezone can push it onto the day before or after", () => {
    const ts = paymentTs({ isEdit: true, stayDate: "2026-08-17", now });
    expect(new Date(ts).toISOString().slice(0, 10)).toBe("2026-08-17");
    expect(ts).toContain("T12:00:00");
  });

  it("falls back to now when the booking has no usable date", () => {
    expect(paymentTs({ isEdit: true, stayDate: "", now })).toBe(now.toISOString());
    expect(paymentTs({ isEdit: true, stayDate: null, now })).toBe(now.toISOString());
    expect(paymentTs({ isEdit: true, stayDate: "not-a-date", now })).toBe(now.toISOString());
  });

  it("accepts a full timestamp and keeps only the day", () => {
    expect(paymentTs({ isEdit: true, stayDate: "2026-08-17T22:45:00Z", now })).toBe("2026-08-17T12:00:00.000Z");
  });
});

describe("collecting money — unchanged", () => {
  it("counts today, because that is when the cash arrived", () => {
    expect(paymentTs({ isEdit: false, stayDate: "2026-08-17", now })).toBe(now.toISOString());
  });

  it("counts today even for a new booking with no stay date yet", () => {
    expect(paymentTs({ isEdit: false, stayDate: "", now })).toBe(now.toISOString());
  });
});
