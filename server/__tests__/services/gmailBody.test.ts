import { describe, expect, it } from "vitest";
import { appendGmailSignature, decodeGmailBase64, extractGmailBody, listGmailAttachments, parseFromHeader } from "@shared/gmail";

function b64url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

describe("decodeGmailBase64", () => {
  it("decodes utf-8 html, not latin-1 garbage", () => {
    expect(decodeGmailBase64(b64url("café £500"))).toBe("café £500");
  });
});

describe("extractGmailBody", () => {
  it("walks nested multipart/alternative", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [
            { mimeType: "text/plain", body: { data: b64url("plain version") } },
            { mimeType: "text/html", body: { data: b64url("<p>Hello <b>world</b></p>") } },
          ],
        },
      ],
    };
    const body = extractGmailBody(payload);
    expect(body.html).toBe("<p>Hello <b>world</b></p>");
    expect(body.text).toBe("plain version");
  });
});

describe("listGmailAttachments", () => {
  it("finds named parts with attachment ids", () => {
    const files = listGmailAttachments({
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "text/html", body: { data: "xx" } },
        {
          filename: "pack.pdf",
          mimeType: "application/pdf",
          body: { attachmentId: "att1", size: 1200 },
        },
      ],
    });
    expect(files).toEqual([{ filename: "pack.pdf", mimeType: "application/pdf", size: 1200, attachmentId: "att1" }]);
  });
});

describe("appendGmailSignature", () => {
  it("appends the live Gmail signature once", () => {
    const html = appendGmailSignature("<p>Hello</p>", "<p>Shaun</p>");
    expect(html).toContain("gmail_signature");
    expect(html).toContain("<p>Hello</p>");
    expect(appendGmailSignature(html, "<p>Shaun</p>")).toBe(html);
  });
});

describe("parseFromHeader", () => {
  it("splits display name from address", () => {
    expect(parseFromHeader('"James Hale · Business Consultant" <enquiries@stratafinance.co.uk>')).toEqual({
      name: "James Hale · Business Consultant",
      email: "enquiries@stratafinance.co.uk",
      display: "James Hale · Business Consultant",
    });
  });
});
