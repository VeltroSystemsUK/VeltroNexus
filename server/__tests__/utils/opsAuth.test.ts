import { describe, expect, it } from "vitest";
import { GOD_MODE_USER_ID } from "../../utils/godModeAuth";
import { isOpsUser } from "../../utils/opsAuth";

describe("isOpsUser", () => {
  it("allows super_admin and the god-mode user id only", () => {
    expect(isOpsUser({ id: "x", role: "super_admin" })).toBe(true);
    expect(isOpsUser({ id: GOD_MODE_USER_ID, role: "broker" })).toBe(true);
    expect(isOpsUser({ id: "x", role: "broker" })).toBe(false);
    expect(isOpsUser({ id: "x", role: "sales_admin" })).toBe(false);
    expect(isOpsUser(undefined)).toBe(false);
  });
});
