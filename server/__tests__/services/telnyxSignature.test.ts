import { describe, expect, it } from "vitest";
import { generateKeyPairSync, sign } from "crypto";
import { verifyTelnyxSignature } from "../../services/telnyxSignature";

describe("verifyTelnyxSignature", () => {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const timestamp = "1690000000";
  const rawBody = `{"data":{"event_type":"call.hangup"}}`;
  const signatureB64 = sign(null, Buffer.from(`${timestamp}|${rawBody}`), privateKey).toString("base64");

  it("accepts a valid Ed25519 signature", () => {
    expect(
      verifyTelnyxSignature({ publicKeyPem, timestamp, signatureB64, rawBody })
    ).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(
      verifyTelnyxSignature({
        publicKeyPem,
        timestamp,
        signatureB64,
        rawBody: rawBody + "x",
      })
    ).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(
      verifyTelnyxSignature({ publicKeyPem, timestamp: "", signatureB64, rawBody })
    ).toBe(false);
  });
});
