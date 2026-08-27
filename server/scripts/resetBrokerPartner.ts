import dotenv from "dotenv";
import { storage } from "../storage";
import { hashPassword } from "../auth";

dotenv.config({ path: ".env.local" });

async function main() {
  const email = process.env.BROKER_HANDOFF_EMAIL;
  const password = process.argv[2] || "SterlingTest26!";
  if (!email) {
    console.error("Set BROKER_HANDOFF_EMAIL in .env.local first.");
    process.exit(1);
  }

  const user = await storage.getUserByEmail(email);
  if (!user) {
    console.error(`No account found for ${email}. Run createBrokerPartner.ts first.`);
    process.exit(1);
  }

  await storage.updateUser(user.id, { password: await hashPassword(password) });
  console.log(`Reset password for ${email} (role: ${user.role}, id: ${user.id}).`);
  console.log(`Temporary password: ${password}`);
  process.exit(0);
}

main();
