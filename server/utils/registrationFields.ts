export type RegistrationUser = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: "broker";
  subscriptionTier: string;
  prospectLimit: number;
  trialTier: string | null;
  trialEndsAt: Date | null;
};

export function buildRegistrationUser(
  body: Record<string, unknown>,
  hashedPassword: string
): RegistrationUser {
  const trialTier = body.trialTier === "broker" || body.trialTier === "team" ? body.trialTier : null;
  let subscriptionTier = "free";
  let prospectLimit = 10;
  let trialEndsAt: Date | null = null;

  if (trialTier === "broker" || trialTier === "team") {
    trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    subscriptionTier = trialTier;
    prospectLimit = trialTier === "broker" ? 50 : 250;
  }

  return {
    email: String(body.email || "").toLowerCase(),
    password: hashedPassword,
    firstName: typeof body.firstName === "string" ? body.firstName : undefined,
    lastName: typeof body.lastName === "string" ? body.lastName : undefined,
    role: "broker",
    subscriptionTier,
    prospectLimit,
    trialTier,
    trialEndsAt,
  };
}
