import { describe, expect, it } from "vitest";
import { buildHealthcheckMail, illustratedMonthly, parseHealthcheckMail } from "../../services/healthcheckMail";

describe("healthcheck mail", () => {
  it("rejects a missing email and a zero balance", () => {
    expect(parseHealthcheckMail({ email: "nope", balance: 100, monthly: 1 }).ok).toBe(false);
    expect(parseHealthcheckMail({ email: "a@b.co", balance: 0, monthly: 1 }).ok).toBe(false);
  });

  it("builds the lower illustration and escapes the company name", () => {
    const parsed = parseHealthcheckMail({
      email: "Alex@Example.co",
      company: "Acme <Ltd>",
      balance: 85000,
      monthly: 4200,
      lenders: ["Iwoca", "Capify"],
      brokerNote: "Went direct.",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.email).toBe("alex@example.co");
    const mail = buildHealthcheckMail(parsed.value);
    const next = Math.round(illustratedMonthly(85000));
    expect(mail.subject).toBe("Your illustration — Acme <Ltd>");
    expect(mail.html).toContain("Acme &lt;Ltd&gt;");
    expect(mail.html).not.toContain("<Ltd>");
    expect(mail.text).toContain("£4,200");
    expect(mail.text).toContain("£85,000");
    expect(mail.text).toContain("lower");
    expect(mail.text).toContain(`£${next.toLocaleString("en-GB")}`);
    expect(mail.text).toContain("Iwoca and Capify");
    expect(mail.text).toContain("Went direct.");
  });

  it("says when the illustration is not lower", () => {
    const mail = buildHealthcheckMail({
      email: "a@b.co",
      company: "",
      balance: 10000,
      monthly: 50,
      lenders: [],
      brokerNote: "",
    });
    expect(mail.subject).toBe("Your illustration");
    expect(mail.text).toContain("your monthly stack");
    expect(mail.text).toContain("not lower");
  });
});
