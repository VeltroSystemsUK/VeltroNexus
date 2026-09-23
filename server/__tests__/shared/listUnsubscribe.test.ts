import { describe, expect, it } from "vitest";
import {
  emailFromUnsubscribeToken,
  listUnsubscribeHeaders,
  signUnsubscribeToken,
} from "@shared/listUnsubscribe";

const secret = "test-unsubscribe-secret";
const email = "ops@northpeak.co.uk";

describe("unsubscribe token", () => {
  it("round-trips the recipient email", () => {
    const token = signUnsubscribeToken(email, secret);
    expect(emailFromUnsubscribeToken(token, secret)).toBe(email);
  });

  it("normalises display-name recipients", () => {
    const token = signUnsubscribeToken("James <OPS@NorthPeak.co.uk>", secret);
    expect(emailFromUnsubscribeToken(token, secret)).toBe(email);
  });

  it("rejects a tampered token", () => {
    const token = signUnsubscribeToken(email, secret);
    expect(emailFromUnsubscribeToken(`${token}x`, secret)).toBeNull();
    expect(emailFromUnsubscribeToken(token, "other-secret")).toBeNull();
    expect(emailFromUnsubscribeToken("", secret)).toBeNull();
  });
});

describe("listUnsubscribeHeaders", () => {
  it("emits RFC 8058 https + mailto headers for one-click", () => {
    const headers = listUnsubscribeHeaders({
      baseUrl: "https://leads.stratanexus.co.uk/",
      email,
      from: "enquiries@stratafinance.co.uk",
      secret,
    });
    const token = signUnsubscribeToken(email, secret);
    expect(headers["List-Unsubscribe"]).toBe(
      `<https://leads.stratanexus.co.uk/api/agent-mail/unsubscribe/${token}>, <mailto:enquiries@stratafinance.co.uk?subject=STOP>`
    );
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});
