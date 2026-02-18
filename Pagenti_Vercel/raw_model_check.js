const apiKey = "AIzaSyDnPAiz51lOkhhxbBsVtDk91bblHXPvtOw";
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

async function checkModels() {
    try {
        const response = await fetch(url);
        const data = await response.json();

        console.log("Status:", response.status);
        if (data.models) {
            console.log("Model Count:", data.models.length);
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No 'models' field in response:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

checkModels();
