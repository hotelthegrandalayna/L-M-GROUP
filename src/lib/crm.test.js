// Guards the guest CRM. The bug that started this: a guest with a confirmed
// booking and money owing was labelled "Inactive", because the old rule counted
// only checked-out stays. He was the most important contact of that week.
import { describe, it, expect } from "vitest";
import {
  buildGuests, guestStage, guestFacts, crmMetrics, stageBreakdown,
  actionQueue, logContact, sourceBreakdown, bookingDue, STAGE_ORDER,
} from "./crm";

const TODAY = "2026-08-15";

const bk = (o = {}) => ({
  id: o.id || 1, guest: o.guest || "Guest", phone: o.phone || "01700000001",
  checkin: o.checkin || "2026-08-01", checkout: o.checkout || "2026-08-02",
  nights: o.nights ?? 1, room: o.room || "101",
  invoiceTotal: o.total ?? 2000, advance: o.advance ?? (o.total ?? 2000),
  status: o.status || "checked-out", source: o.source || "", ...o,
});
const guestsOf = (arr, profiles) => Object.values(buildGuests(arr, profiles));

describe("the bug: a guest who has booked but not yet arrived", () => {
  // Real case — MD Mohin, arriving 21 Aug, ৳4,400 outstanding, no completed stay.
  const mohin = bk({ id: 9, guest: "MD Mohin", phone: "01700790125",
    checkin: "2026-08-21", checkout: "2026-08-22", status: "confirmed",
    total: 5400, advance: 1000 });
  const g = guestsOf([mohin])[0];

  it("is UPCOMING, not lapsed or inactive", () => {
    expect(guestStage(g, TODAY)).toBe("upcoming");
  });
  it("knows how many days until they arrive", () => {
    expect(guestFacts(g, TODAY).arriving).toBe(6);
  });
  it("carries the outstanding balance", () => {
    expect(bookingDue(mohin)).toBe(4400);
    expect(g.due).toBe(4400);
  });
  it("is the FIRST thing in today's actions", () => {
    const { actions } = actionQueue([g], TODAY);
    expect(actions[0].kind).toBe("arrival-due");
    expect(actions[0].priority).toBe(1);
    expect(actions[0].reason).toContain("4,400");
    expect(actions[0].message).toContain("21");
  });
});

describe("stages actually split the guest book", () => {
  const champ  = guestsOf([bk({ id:1, phone:"011", checkout:"2026-08-01" }),
                           bk({ id:2, phone:"011", checkout:"2026-07-01" }),
                           bk({ id:3, phone:"011", checkout:"2026-06-01" })])[0];
  const twice  = guestsOf([bk({ id:1, phone:"012", checkout:"2026-08-01" }),
                           bk({ id:2, phone:"012", checkout:"2026-07-01" })])[0];
  const fresh  = guestsOf([bk({ id:1, phone:"013", checkout:"2026-08-10" })])[0];
  const cool   = guestsOf([bk({ id:1, phone:"014", checkout:"2026-07-01" })])[0];
  const lapsed = guestsOf([bk({ id:1, phone:"015", checkout:"2026-01-01" })])[0];

  it("names three stays a champion", () => expect(guestStage(champ, TODAY)).toBe("champion"));
  it("names two stays returning", () => expect(guestStage(twice, TODAY)).toBe("returning"));
  it("splits one-stay guests by how long ago", () => {
    expect(guestStage(fresh, TODAY)).toBe("fresh");     // 5 days
    expect(guestStage(cool, TODAY)).toBe("cooling");    // 45 days
    expect(guestStage(lapsed, TODAY)).toBe("lapsed");   // 226 days
  });
  it("makes a big spender a champion on one stay", () => {
    const rich = guestsOf([bk({ id:1, phone:"016", total:25000, checkout:"2026-08-10" })])[0];
    expect(guestStage(rich, TODAY)).toBe("champion");
  });
  it("counts a stay the guest is in the middle of", () => {
    // Real case: a three-time guest worth 10,800, still in-house, was showing as
    // a first-timer because two of his stays had not been checked out yet.
    const inHouse = guestsOf([
      bk({ id:1, phone:"017", checkout:"2026-08-01", status:"checked-out" }),
      bk({ id:2, phone:"017", checkin:"2026-08-14", status:"checked-in" }),
      bk({ id:3, phone:"017", checkin:"2026-08-14", status:"checked-in", room:"106" }),
    ])[0];
    expect(guestFacts(inHouse, TODAY).completed).toBe(3);
    expect(guestFacts(inHouse, TODAY).checkedOut).toBe(1);
    expect(guestStage(inHouse, TODAY)).toBe("champion");
  });
  it("covers every guest — no one falls outside the stages", () => {
    const all = [champ, twice, fresh, cool, lapsed];
    all.forEach(g => expect(STAGE_ORDER).toContain(guestStage(g, TODAY)));
    expect(stageBreakdown(all, TODAY).reduce((s, r) => s + r.count, 0)).toBe(5);
  });
});

describe("the headline numbers", () => {
  const guests = guestsOf([
    bk({ id:1, phone:"021", total:10000, checkout:"2026-08-01" }),
    bk({ id:2, phone:"021", total:800,  checkout:"2026-07-01" }),
    bk({ id:3, phone:"022", total:1000, checkout:"2026-08-02" }),
    bk({ id:4, phone:"023", total:200,  checkout:"2026-08-03" }),
  ]);

  it("counts the repeat rate against guests who have actually stayed", () => {
    const m = crmMetrics(guests, TODAY);
    expect(m.guests).toBe(3);
    expect(m.repeat).toBe(1);
    expect(m.repeatRate).toBe(33);
  });
  it("measures how much rides on the biggest guests", () => {
    const m = crmMetrics(guests, TODAY);
    expect(m.revenue).toBe(12000);
    expect(m.topN).toBe(1);
    expect(m.topShare).toBe(90);      // 10,800 of 12,000
  });
  it("does not divide by zero on an empty guest book", () => {
    const m = crmMetrics([], TODAY);
    expect(m.repeatRate).toBe(0);
    expect(m.topShare).toBe(0);
  });
});

describe("today's actions are ordered by what they are worth", () => {
  const arriving  = guestsOf([bk({ id:1, phone:"031", guest:"Owes", checkin:"2026-08-18", checkout:"2026-08-19", status:"confirmed", total:5000, advance:1000 })])[0];
  const leftToday = guestsOf([bk({ id:2, phone:"032", guest:"Left", checkout:"2026-08-15", total:3000 })])[0];
  const quietBig  = guestsOf([bk({ id:3, phone:"033", guest:"Big",  checkout:"2026-08-08", total:9000 })])[0];
  const quietSmall= guestsOf([bk({ id:4, phone:"034", guest:"Small",checkout:"2026-08-08", total:900 })])[0];

  const { actions } = actionQueue([quietSmall, quietBig, leftToday, arriving], TODAY, 10);

  it("puts money owed on an arrival first, then the review", () => {
    expect(actions[0].kind).toBe("arrival-due");
    expect(actions[1].kind).toBe("review");
  });
  it("contacts the bigger guest first at the same priority", () => {
    const invites = actions.filter(a => a.kind === "invite-back");
    expect(invites[0].guest.name).toBe("Big");
    expect(invites[1].guest.name).toBe("Small");
  });
  it("gives every action a message with the guest's name in it", () => {
    actions.forEach(a => {
      expect(a.message.length).toBeGreaterThan(20);
      expect(a.message).toContain(a.guest.name.split(" ")[0]);
    });
  });
  it("never lists the same guest twice", () => {
    const keys = actions.map(a => a.guest.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("hands back the overflow instead of dropping it", () => {
    const { actions: few, remaining } = actionQueue([quietSmall, quietBig, leftToday, arriving], TODAY, 2);
    expect(few).toHaveLength(2);
    expect(remaining.length).toBeGreaterThan(0);
  });
});

describe("nobody gets messaged twice", () => {
  const g = guestsOf([bk({ id:1, phone:"041", guest:"Once", checkout:"2026-08-08", total:5000 })])[0];

  it("drops off the list once contacted", () => {
    expect(actionQueue([g], TODAY).actions).toHaveLength(1);
    g.savedProfile = logContact(g.savedProfile, "invite-back", "2026-08-14");
    expect(actionQueue([g], TODAY).actions).toHaveLength(0);
  });
  it("comes back after the quiet period", () => {
    const old = { ...g, savedProfile: logContact({}, "invite-back", "2026-07-01") };
    expect(actionQueue([old], TODAY).actions.length).toBeGreaterThan(0);
  });
  it("keeps the log from growing without limit", () => {
    let p = {};
    for (let i = 0; i < 60; i++) p = logContact(p, "invite-back", "2026-08-01");
    expect(p.contactLog).toHaveLength(40);
  });
  it("still chases money from a guest who opted out of marketing", () => {
    const optOut = guestsOf([bk({ id:1, phone:"042", checkin:"2026-08-18", checkout:"2026-08-19",
      status:"confirmed", total:5000, advance:0 })])[0];
    optOut.savedProfile = { marketingOk: false };
    const { actions } = actionQueue([optOut], TODAY);
    expect(actions[0].kind).toBe("arrival-due");
  });
  it("does not market to a guest who opted out", () => {
    const optOut = guestsOf([bk({ id:1, phone:"043", checkout:"2026-08-08", total:5000 })])[0];
    optOut.savedProfile = { marketingOk: false };
    expect(actionQueue([optOut], TODAY).actions).toHaveLength(0);
  });
});

describe("where bookings come from", () => {
  it("reports an empty channel record as empty rather than inventing one", () => {
    const s = sourceBreakdown([bk({ id:1 }), bk({ id:2 })]);
    expect(s.rows).toEqual([]);
    expect(s.recorded).toBe(0);
    expect(s.total).toBe(2);
  });
  it("ranks channels by the money they bring, not the count", () => {
    const s = sourceBreakdown([
      bk({ id:1, source:"Walk-in", total:1000 }),
      bk({ id:2, source:"Walk-in", total:1000 }),
      bk({ id:3, source:"Google",  total:9000 }),
    ]);
    expect(s.rows[0].source).toBe("Google");
    expect(s.rows[0].value).toBe(9000);
    expect(s.recorded).toBe(3);
  });
});

describe("companions", () => {
  it("records the stay but leaves the money with whoever paid", () => {
    const guests = buildGuests([bk({ id:1, phone:"051", guest:"Payer", total:4000,
      spouseName:"Spouse", spousePhone:"01700000052" })]);
    expect(guests["051"].totalSpent).toBe(4000);
    expect(guests["01700000052"].totalSpent).toBe(0);
    expect(guests["01700000052"].stays).toHaveLength(1);
  });
});

describe("housekeeping", () => {
  it("ignores cancelled bookings and rows with no phone", () => {
    const guests = guestsOf([bk({ id:1, status:"cancelled" }), bk({ id:2, phone:"" })]);
    expect(guests).toHaveLength(0);
  });
  it("survives junk without throwing", () => {
    expect(Object.keys(buildGuests(null, null))).toHaveLength(0);
    expect(crmMetrics(null || [], TODAY).guests).toBe(0);
    expect(actionQueue([], TODAY).actions).toEqual([]);
  });
});
