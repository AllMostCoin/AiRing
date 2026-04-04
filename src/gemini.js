const { GoogleGenerativeAI } = require("@google/generative-ai");

/**
 * Creates and returns a configured Gemini GenerativeModel instance.
 *
 * @param {string} apiKey - Google AI API key
 * @param {string} [model="gemini-1.5-pro"] - Gemini model name
 * @returns {import("@google/generative-ai").GenerativeModel}
 */
function createGeminiModel(apiKey, model = "gemini-1.5-pro") {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

/**
 * Sends a prompt to the Gemini API and returns the text response.
 *
 * @param {import("@google/generative-ai").GenerativeModel} geminiModel
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function askGemini(geminiModel, prompt) {
  const result = await geminiModel.generateContent(prompt);
  return result.response.text();
}

module.exports = { createGeminiModel, askGemini };
