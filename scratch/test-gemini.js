const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

async function test() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("ERROR: GEMINI_API_KEY tidak ditemukan di .env.local");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Sapa saya dengan 'Halo GSB'");
        const response = await result.response;
        console.log("SUCCESS:", response.text());
    } catch (e) {
        console.error("GEMINI API ERROR:", e.message);
    }
}

test();
