require("dotenv").config();
const { createGeminiModel, askGemini } = require("./src/gemini");

async function main() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  const model = process.env.GOOGLE_AI_MODEL || "gemini-1.5-pro";

  if (!apiKey || apiKey === "your_google_ai_api_key_here") {
    console.error(
      "Error: GOOGLE_AI_API_KEY is not set.\n" +
        "Copy .env.example to .env and add your API key from https://aistudio.google.com/app/apikey"
    );
    process.exit(1);
  }

  const question = process.argv[2] || "What is the meaning of life?";
  console.log(`Model: ${model}`);
  console.log(`Question: ${question}\n`);

  const gemini = createGeminiModel(apiKey, model);
  const answer = await askGemini(gemini, question);
  console.log(`Answer:\n${answer}`);
}

main().catch((err) => {
  console.error("Gemini API error:", err.message || err);
  process.exit(1);
});
