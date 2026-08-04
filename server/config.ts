// Startup env checks: catch misconfiguration at boot instead of a deep 500 later.
const RECOMMENDED = ["COMPANIES_HOUSE_API_KEY", "GOOGLE_PLACES_API_KEY"];

export function validateEnv() {
  const missing = RECOMMENDED.filter((key) => !process.env[key]);
  if (missing.length) {
    console.warn(
      `[startup] Missing env vars (features will error when used): ${missing.join(", ")}`
    );
  }
}
