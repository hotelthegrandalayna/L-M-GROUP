// The guard that keeps the dev sign-in bypass off the live site. If any of these
// fail, the bypass could reach app.hotelthegrandalayna.com — fix the code.
import { describe, it, expect } from "vitest";
import { devSession } from "./devSession";

describe("the bypass never exists outside a developer's own machine", () => {
  it("is off in a production build, even on localhost", () => {
    expect(devSession(false, "localhost")).toBeNull();
  });

  it("is off on the live domain, even if a dev build were served there", () => {
    expect(devSession(true, "app.hotelthegrandalayna.com")).toBeNull();
    expect(devSession(true, "hotelthegrandalayna.com")).toBeNull();
  });

  it("is off for anything that merely looks local", () => {
    expect(devSession(true, "localhost.attacker.com")).toBeNull();
    expect(devSession(true, "notlocalhost")).toBeNull();
    expect(devSession(true, "192.168.1.5")).toBeNull();
    expect(devSession(true, "")).toBeNull();
    expect(devSession(true, undefined)).toBeNull();
  });

  it("needs the dev flag to be exactly true, not merely truthy", () => {
    expect(devSession("yes", "localhost")).toBeNull();
    expect(devSession(1, "localhost")).toBeNull();
    expect(devSession(undefined, "localhost")).toBeNull();
  });

  it("is on only for a dev build on a local host", () => {
    expect(devSession(true, "localhost")).toEqual({ user: "dev (read-only)", role: "admin" });
    expect(devSession(true, "127.0.0.1")).toEqual({ user: "dev (read-only)", role: "admin" });
  });

  it("names itself read-only, so nobody mistakes it for a real login", () => {
    expect(devSession(true, "localhost").user).toContain("read-only");
  });
});
