import { describe, expect, it } from "vitest";
import { buildRegistrationUser } from "../../utils/registrationFields";

describe("buildRegistrationUser", () => {
  it("ignores privilege fields from the request body", () => {
    const user = buildRegistrationUser(
      {
        email: "New.User@Example.com",
        password: "ignored-plaintext",
        firstName: "Ada",
        lastName: "Lovelace",
        role: "super_admin",
        hasUnderwritingAccess: 1,
        googleAccessToken: "planted",
        webhookApiKeyHash: "planted",
        subscriptionTier: "lender",
        prospectLimit: 999999,
        trialTier: "broker",
      },
      "hashed.password"
    );

    expect(user.email).toBe("new.user@example.com");
    expect(user.password).toBe("hashed.password");
    expect(user.firstName).toBe("Ada");
    expect(user.lastName).toBe("Lovelace");
    expect(user.role).toBe("broker");
    expect(user.subscriptionTier).toBe("broker");
    expect(user.prospectLimit).toBe(50);
    expect(user.trialTier).toBe("broker");
    expect(user).not.toHaveProperty("hasUnderwritingAccess");
    expect(user).not.toHaveProperty("googleAccessToken");
    expect(user).not.toHaveProperty("webhookApiKeyHash");
  });
});
