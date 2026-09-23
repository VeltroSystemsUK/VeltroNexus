import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signUnsubscribeToken } from "@shared/listUnsubscribe";

vi.mock("../../services/mailDesk", () => ({
  applyOptOut: vi.fn(),
}));

import { applyOptOut } from "../../services/mailDesk";
import { processMailUnsubscribe } from "../../services/mailUnsubscribe";

const mockedOptOut = applyOptOut as unknown as ReturnType<typeof vi.fn>;

describe("processMailUnsubscribe", () => {
  const prevSecret = process.env.SESSION_SECRET;

  beforeEach(() => {
    mockedOptOut.mockReset();
    mockedOptOut.mockResolvedValue({ emails: ["ops@northpeak.co.uk"], dealsDeleted: 1 });
    process.env.SESSION_SECRET = "test-unsubscribe-secret";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
  });

  it("applies org opt-out for a valid token", async () => {
    const token = signUnsubscribeToken("ops@northpeak.co.uk", "test-unsubscribe-secret");
    expect(await processMailUnsubscribe(token)).toBe("ok");
    expect(mockedOptOut).toHaveBeenCalledWith("ops@northpeak.co.uk");
  });

  it("does not suppress on a tampered token", async () => {
    expect(await processMailUnsubscribe("not-a-token")).toBe("invalid");
    expect(mockedOptOut).not.toHaveBeenCalled();
  });
});
