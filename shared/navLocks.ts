/** Paths a touring partner (sales_admin) can see but not open. */
export const PREVIEW_LOCKED_PATHS = [
  "/workforce",
  "/email-templates",
  "/email-campaigns",
  "/editorial",
  "/media",
  "/craft",
  "/invoicing",
  "/income",
  "/forecasts",
  "/expenses",
  "/cashflow",
  "/ai-studio",
  "/admin",
  "/teams",
  "/leads",
  "/search",
  "/gmail",
  "/whatsapp",
] as const;

export function isNavLocked(role: string | null | undefined, path: string): boolean {
  if (role !== "sales_admin") return false;
  const pathname = path.split("?")[0] || "/";
  return PREVIEW_LOCKED_PATHS.some(
    (locked) => pathname === locked || pathname.startsWith(`${locked}/`)
  );
}
