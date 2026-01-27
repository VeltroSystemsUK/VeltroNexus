
// Test script to verify local login via fetch
// Run with: npx tsx scripts/test_login.ts

async function testLogin() {
    console.log("Starting login test...");
    try {
        const payload = {
            username: "admin@veltro.com",
            password: "admin123"
        };
        console.log("Sending payload:", payload);

        const response = await fetch("http://localhost:5000/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        console.log("Response Status:", response.status);
        console.log("Response Headers:", Object.fromEntries(response.headers.entries()));

        try {
            const text = await response.text();
            console.log("Response Body (Text):", text);
        } catch (e) {
            console.log("Response Body parsing failed:", e);
        }

    } catch (error) {
        console.error("Fetch failed:", error);
    }
}

testLogin();
