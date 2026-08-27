import { verify, createPublicKey } from "crypto";

export function verifyTelnyxSignature(input: {
  publicKeyPem: string;
  timestamp: string;
  signatureB64: string;
  rawBody: string;
}): boolean {
  if (!input.publicKeyPem || !input.timestamp || !input.signatureB64) return false;
  try {
    const key = createPublicKey(input.publicKeyPem);
    return verify(
      null,
      Buffer.from(`${input.timestamp}|${input.rawBody}`),
      key,
      Buffer.from(input.signatureB64, "base64")
    );
  } catch {
    return false;
  }
}
