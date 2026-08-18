// The reported case: a convention-hall invoice was raised with the wrong event
// date, and once confirmed there was no way to fix it. Correcting the date moves
// the invoice's money from one month to another, so the thing that matters most
// here is that the move is reported before it happens and recorded after.
import { describe, it, expect } from "vitest";
import {
  diffInvoice, invoiceMonth, monthMove, buildAmendment,
  mergeAmendmentMaps, addAmendment, amendmentsFor, allAmendments,
  AMENDMENTS_CONFIG_KEY, TRACKED_FIELDS,
} from "./invoiceAmend";

const inv = (o = {}) => ({
  id: "inv-1", num: "ACH-00012", client: "Rahim", evType: "Wedding",
  evDate: "2026-09-14", invDate: "2026-08-01", grand: 85000, adv: 20000, ...o,
});

describe("the wrong date, corrected", () => {
  const before = inv();
  const after  = inv({ evDate: "2026-08-14" });

  it("reports exactly what changed and nothing else", () => {
    const d = diffInvoice(before, after);
    expect(d).toHaveLength(1);
    expect(d[0].label).toBe("Event date");
    expect(d[0].was).toBe("2026-09-14");
    expect(d[0].now).toBe("2026-08-14");
  });

  it("says which months the money moves between, and how much", () => {
    const m = monthMove(before, after);
    expect(m).toEqual({ from: "2026-09", to: "2026-08", billed: 85000, was: 85000 });
  });

  it("groups by the event date, matching HallContext", () => {
    expect(invoiceMonth(before)).toBe("2026-09");
    // falls back to the invoice date when there is no event date
    expect(invoiceMonth({ invDate: "2026-07-03" })).toBe("2026-07");
    expect(invoiceMonth({})).toBe("");
  });

  it("stays silent when the month does not change", () => {
    expect(monthMove(before, inv({ evDate: "2026-09-20" }))).toBeNull();
    expect(monthMove(before, inv({ client: "Karim" }))).toBeNull();
  });

  it("builds a record carrying the change, the mover and the month move", () => {
    const a = buildAmendment(before, after, "admin", "2026-08-19T14:32:00.000Z");
    expect(a.by).toBe("admin");
    expect(a.ts).toBe("2026-08-19T14:32:00.000Z");
    expect(a.changes).toHaveLength(1);
    expect(a.move.from).toBe("2026-09");
  });

  it("records nothing when nothing actually changed", () => {
    expect(buildAmendment(before, inv(), "admin")).toBeNull();
  });
});

describe("what counts as a change", () => {
  it("notices money and guest-count corrections too", () => {
    const d = diffInvoice(inv(), inv({ grand: 90000, adv: 25000, guests: 300 }));
    expect(d.map(c => c.label).sort()).toEqual(["Advance paid", "Grand total", "Guests"]);
  });

  it("treats blank, missing and empty as the same thing", () => {
    expect(diffInvoice({ note: "" }, { note: undefined })).toEqual([]);
    expect(diffInvoice({ note: null }, {})).toEqual([]);
  });

  it("shows a missing value as a dash rather than blank", () => {
    const d = diffInvoice({ client: "Rahim" }, { client: "" });
    expect(d[0].now).toBe("—");
  });

  it("ignores fields nobody needs to audit", () => {
    expect(diffInvoice(inv(), inv({ stageImgData: "xxx" }))).toEqual([]);
    expect(TRACKED_FIELDS.map(f => f[0])).not.toContain("stageImgData");
  });
});

describe("the record survives, and two devices cannot wipe each other", () => {
  const e1 = { ts: "2026-08-19T10:00:00.000Z", by: "admin", changes: [{ field: "evDate", label: "Event date", was: "a", now: "b" }] };
  const e2 = { ts: "2026-08-20T10:00:00.000Z", by: "admin", changes: [{ field: "grand", label: "Grand total", was: "1", now: "2" }] };

  it("keeps both when two amendments are made from two devices", () => {
    const merged = mergeAmendmentMaps({ "inv-1": [e1] }, { "inv-1": [e2] });
    expect(merged["inv-1"]).toHaveLength(2);
    expect(merged["inv-1"][0].ts < merged["inv-1"][1].ts).toBe(true);
  });

  it("does not duplicate the same amendment seen twice", () => {
    expect(mergeAmendmentMaps({ "inv-1": [e1] }, { "inv-1": [{ ...e1 }] })["inv-1"]).toHaveLength(1);
  });

  it("keeps invoices only one side knows about", () => {
    const m = mergeAmendmentMaps({ a: [e1] }, { b: [e2] });
    expect(Object.keys(m).sort()).toEqual(["a", "b"]);
  });

  it("adds one amendment without touching any other invoice", () => {
    const m = addAmendment({ "inv-2": [e2] }, "inv-1", e1);
    expect(amendmentsFor(m, "inv-1")).toHaveLength(1);
    expect(amendmentsFor(m, "inv-2")).toHaveLength(1);
  });

  it("survives junk", () => {
    expect(mergeAmendmentMaps(null, undefined)).toEqual({});
    expect(mergeAmendmentMaps({ a: "nope" }, {})).toEqual({});
    expect(amendmentsFor(null, "x")).toEqual([]);
    expect(addAmendment({}, "", null)).toEqual({});
  });

  it("names the config key the sync will use", () => {
    expect(AMENDMENTS_CONFIG_KEY).toBe("hall_invoice_amendments");
  });
});

describe("the admin list", () => {
  it("shows every amendment newest first, with its invoice number", () => {
    const map = {
      "inv-1": [{ ts: "2026-08-19T10:00:00.000Z", by: "admin", changes: [] }],
      "inv-2": [{ ts: "2026-08-21T10:00:00.000Z", by: "admin", changes: [] }],
    };
    const rows = allAmendments(map, [inv(), inv({ id: "inv-2", num: "ACH-00013", client: "Karim" })]);
    expect(rows).toHaveLength(2);
    expect(rows[0].num).toBe("ACH-00013");     // newest first
    expect(rows[1].num).toBe("ACH-00012");
    expect(rows[1].client).toBe("Rahim");
  });

  it("still lists an amendment whose invoice has since been deleted", () => {
    const rows = allAmendments({ gone: [{ ts: "2026-08-19T10:00:00.000Z", changes: [] }] }, []);
    expect(rows).toHaveLength(1);
    expect(rows[0].num).toBe("—");
  });

  it("returns nothing for an empty or broken map", () => {
    expect(allAmendments({}, [])).toEqual([]);
    expect(allAmendments(null, [])).toEqual([]);
  });
});
