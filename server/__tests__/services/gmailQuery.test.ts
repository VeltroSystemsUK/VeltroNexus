import { describe, expect, it } from "vitest";
import { gmailHeader, gmailListQuery } from "@shared/gmail";

describe("gmailListQuery", () => {
  it("maps folders to Gmail search", () => {
    expect(gmailListQuery("inbox")).toBe("in:inbox");
    expect(gmailListQuery("sent", "invoice")).toBe("in:sent invoice");
    expect(gmailListQuery("Label_12")).toBe("label:Label_12");
  });
});

describe("gmailHeader", () => {
  it("reads a header case-insensitively", () => {
    expect(gmailHeader([{ name: "Subject", value: "Hello" }], "subject")).toBe("Hello");
    expect(gmailHeader([], "From")).toBe("");
  });
});
