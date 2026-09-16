import { describe, expect, it } from "vitest";
import {
  DEFAULT_HELLO_ORIGIN,
  helloPublicOrigin,
  helloRedirectUrl,
  isHelloAllowedPath,
  isHelloHost,
  isLeadsHost,
} from "@shared/helloHost";

describe("isHelloHost", () => {
  it("accepts the public host and hello.localhost", () => {
    expect(isHelloHost("hello.stratanexus.co.uk")).toBe(true);
    expect(isHelloHost("hello.stratanexus.co.uk:443")).toBe(true);
    expect(isHelloHost("hello.localhost")).toBe(true);
    expect(isHelloHost("leads.stratanexus.co.uk")).toBe(false);
    expect(isHelloHost("learn.stratanexus.co.uk")).toBe(false);
    expect(isHelloHost("localhost:5000")).toBe(false);
  });
});

describe("isLeadsHost", () => {
  it("is only the Nexus desk host", () => {
    expect(isLeadsHost("leads.stratanexus.co.uk")).toBe(true);
    expect(isLeadsHost("leads.stratanexus.co.uk:443")).toBe(true);
    expect(isLeadsHost("hello.stratanexus.co.uk")).toBe(false);
    expect(isLeadsHost("localhost:5000")).toBe(false);
  });
});

describe("helloPublicOrigin", () => {
  it("defaults to https://hello.stratanexus.co.uk", () => {
    expect(DEFAULT_HELLO_ORIGIN).toBe("https://hello.stratanexus.co.uk");
    expect(helloPublicOrigin()).toBe("https://hello.stratanexus.co.uk");
  });
});

describe("isHelloAllowedPath", () => {
  it("allows Direct Outreach pages and their APIs only", () => {
    expect(isHelloAllowedPath("/briefing/tok")).toBe(true);
    expect(isHelloAllowedPath("/veltro")).toBe(true);
    expect(isHelloAllowedPath("/api/briefing/tok/dwell.gif")).toBe(true);
    expect(isHelloAllowedPath("/api/briefing/tok/slide")).toBe(true);
    expect(isHelloAllowedPath("/api/veltro/interest")).toBe(true);
    expect(isHelloAllowedPath("/brand/logo/strata-logo-light.svg")).toBe(true);
    expect(isHelloAllowedPath("/")).toBe(false);
    expect(isHelloAllowedPath("/pipeline")).toBe(false);
    expect(isHelloAllowedPath("/auth")).toBe(false);
    expect(isHelloAllowedPath("/api/openers")).toBe(false);
  });
});

describe("helloRedirectUrl", () => {
  it("moves leads briefing and Veltro onto hello, and leaves localhost alone", () => {
    expect(helloRedirectUrl("leads.stratanexus.co.uk", "/briefing/tok", "")).toBe(
      "https://hello.stratanexus.co.uk/briefing/tok"
    );
    expect(helloRedirectUrl("leads.stratanexus.co.uk", "/veltro", "?b=tok")).toBe(
      "https://hello.stratanexus.co.uk/veltro?b=tok"
    );
    expect(helloRedirectUrl("localhost:5000", "/briefing/tok", "")).toBeNull();
    expect(helloRedirectUrl("hello.stratanexus.co.uk", "/briefing/tok", "")).toBeNull();
  });

  it("does not bounce leads onto itself when hello public origin is leads", () => {
    const prev = process.env.HELLO_PUBLIC_URL;
    process.env.HELLO_PUBLIC_URL = "https://leads.stratanexus.co.uk";
    expect(helloRedirectUrl("leads.stratanexus.co.uk", "/briefing/tok", "")).toBeNull();
    if (prev == null) delete process.env.HELLO_PUBLIC_URL;
    else process.env.HELLO_PUBLIC_URL = prev;
  });
});
