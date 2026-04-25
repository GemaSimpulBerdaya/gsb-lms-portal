const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config({ path: ".env.local" });

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Kita coba panggil ListModels via fetch manual jika SDK bermasalah
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        console.log("AVAILABLE MODELS:", JSON.stringify(data.models?.map(m => m.name), null, 2));
    } catch (e) {
        console.error("LIST MODELS ERROR:", e.message);
    }
}

listModels();
