import dotenv from "dotenv";
import { storage } from "../storage";
import { hashPassword } from "../auth";
import crypto from "crypto";

dotenv.config({ path: ".env.local" });

async function main() {
  const email = process.env.BROKER_HANDOFF_EMAIL;
  const name = process.env.BROKER_HANDOFF_NAME || "External Broker";
  if (!email) {
    console.error("Set BROKER_HANDOFF_EMAIL (and optionally BROKER_HANDOFF_NAME / BROKER_HANDOFF_FIRM) in .env.local first.");
    process.exit(1);
  }

  const existing = await storage.getUserByEmail(email);
  if (existing) {
    console.log(`Account already exists for ${email} (role: ${existing.role}).`);
    return;
  }

  const password = crypto.randomBytes(9).toString("base64url");
  const [firstName, ...rest] = name.split(" ");

  await storage.createUser({
    email,
    password: await hashPassword(password),
    firstName,
    lastName: rest.join(" ") || null,
    role: "external_broker",
  } as any);

  console.log(`Created external broker account for ${email}`);
  console.log(`Temporary password: ${password}`);
  console.log("Share this with them securely (not over this email thread) and have them log in at /broker-portal.");
}

main();
