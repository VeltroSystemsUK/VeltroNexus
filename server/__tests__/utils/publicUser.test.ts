import { describe, expect, it } from "vitest";
import { toPublicUser } from "../../utils/publicUser";

describe("toPublicUser", () => {
  it("strips password and token fields from a user record", () => {
    const publicUser = toPublicUser({
      id: "u1",
      email: "broker@example.com",
      role: "broker",
      password: "scrypt.hash.salt",
      googleAccessToken: "ya29.secret",
      googleRefreshToken: "1//secret",
      webhookApiKeyHash: "abc123",
    });
    expect(publicUser).toEqual({
      id: "u1",
      email: "broker@example.com",
      role: "broker",
    });
    expect(publicUser).not.toHaveProperty("password");
    expect(publicUser).not.toHaveProperty("googleAccessToken");
    expect(publicUser).not.toHaveProperty("googleRefreshToken");
    expect(publicUser).not.toHaveProperty("webhookApiKeyHash");
  });

  it("returns nullish values unchanged", () => {
    expect(toPublicUser(null)).toBeNull();
    expect(toPublicUser(undefined)).toBeUndefined();
  });
});
