

const REQUIRED_VARS = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_PRICE_BROKER_MONTHLY",
    "STRIPE_PRICE_BROKER_ANNUAL",
    "STRIPE_PRICE_TEAM_MONTHLY",
    "STRIPE_PRICE_TEAM_ANNUAL",
];

console.log("Checking Stripe Environment Variables...");

let missing: string[] = [];
let hasAcctError = false;

REQUIRED_VARS.forEach((key) => {
    const value = process.env[key];
    if (!value) {
        console.log(`❌ Missing: ${key}`);
        missing.push(key);
    } else {
        // Check for common paste errors
        if (key === "STRIPE_SECRET_KEY" && value.startsWith("acct_")) {
            console.log(`❌ Invalid Format: ${key} starts with 'acct_', expected 'sk_live_' or 'sk_test_'`);
            hasAcctError = true;
        } else {
            console.log(`✅ Present: ${key}`);
        }
    }
});

if (missing.length > 0 || hasAcctError) {
    console.log("\n⚠️  Configuration Issues Found!");
    process.exit(1);
} else {
    console.log("\n✅ All Stripe variables appear to be set.");
}
