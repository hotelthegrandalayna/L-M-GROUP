// The owner wanted to see Salaries and Electricity together instead of one at a
// time. The trap in a multi-select filter is the empty state: if "nothing ticked"
// meant "match nothing", clearing the filter would blank the screen and look like
// the records had been lost. These tests pin the opposite.
import { describe, it, expect } from "vitest";
import {
  toggleCat, matchesCats, filterByCats, catScopeLabel, totalsByCat,
} from "./catFilter";

const rows = [
  { category: "Salaries",    amount: 22000 },
  { category: "Salaries",    amount: 23000 },
  { category: "Electricity", amount: 8600 },
  { category: "Laundry",     amount: 3900 },
];

describe("picking categories", () => {
  it("adds one that is not there and removes one that is", () => {
    expect(toggleCat([], "Salaries")).toEqual(["Salaries"]);
    expect(toggleCat(["Salaries"], "Electricity")).toEqual(["Salaries", "Electricity"]);
    expect(toggleCat(["Salaries", "Electricity"], "Salaries")).toEqual(["Electricity"]);
  });

  it("keeps the order they were picked in", () => {
    expect(toggleCat(toggleCat(["Laundry"], "Salaries"), "Electricity"))
      .toEqual(["Laundry", "Salaries", "Electricity"]);
  });

  it("survives junk", () => {
    expect(toggleCat(null, "Salaries")).toEqual(["Salaries"]);
    expect(toggleCat(["Salaries"], "")).toEqual(["Salaries"]);
    expect(toggleCat([null, 3, "Salaries"], "Laundry")).toEqual(["Salaries", "Laundry"]);
  });
});

describe("nothing selected means everything", () => {
  it("passes every category when the list is empty", () => {
    expect(matchesCats([], "Salaries")).toBe(true);
    expect(matchesCats([], "")).toBe(true);
    expect(matchesCats(null, "Laundry")).toBe(true);
  });

  it("returns the whole list rather than an empty screen", () => {
    expect(filterByCats(rows, [])).toHaveLength(4);
    expect(filterByCats(rows, null)).toHaveLength(4);
  });

  it("does not mutate or alias the records it was given", () => {
    const out = filterByCats(rows, []);
    out.pop();
    expect(rows).toHaveLength(4);
  });
});

describe("filtering across several categories", () => {
  it("adds up two categories together — the thing that was impossible before", () => {
    const out = filterByCats(rows, ["Salaries", "Electricity"]);
    expect(out).toHaveLength(3);
    expect(out.reduce((s, r) => s + r.amount, 0)).toBe(53600);
  });

  it("still narrows to one", () => {
    expect(filterByCats(rows, ["Laundry"])).toEqual([{ category: "Laundry", amount: 3900 }]);
  });

  it("shows nothing for a category with no records — and says so honestly", () => {
    expect(filterByCats(rows, ["Marketing"])).toEqual([]);
  });

  it("reads the hall's field name too", () => {
    const hallRows = [{ cat: "Cleaning", amount: 500 }, { cat: "Security", amount: 900 }];
    expect(filterByCats(hallRows, ["Security"], (r) => r.cat)).toHaveLength(1);
  });
});

describe("what the filter says it is showing", () => {
  it("names the single category, counts the rest", () => {
    expect(catScopeLabel([], 12)).toBe("all categories");
    expect(catScopeLabel(["Salaries"], 12)).toBe("Salaries");
    expect(catScopeLabel(["Salaries", "Electricity"], 12)).toBe("2 categories");
  });

  it("says all categories when every one is ticked, rather than counting them", () => {
    expect(catScopeLabel(["a", "b", "c"], 3)).toBe("all categories");
  });
});

describe("the amount shown on each chip", () => {
  it("totals each category", () => {
    expect(totalsByCat(rows)).toEqual({ Salaries: 45000, Electricity: 8600, Laundry: 3900 });
  });

  it("treats a missing or unreadable amount as zero rather than NaN", () => {
    expect(totalsByCat([{ category: "Salaries" }, { category: "Salaries", amount: "x" }]))
      .toEqual({ Salaries: 0 });
  });

  it("reads amounts as numbers when they arrive as strings", () => {
    expect(totalsByCat([{ category: "Tax", amount: "1200" }])).toEqual({ Tax: 1200 });
  });
});
