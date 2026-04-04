# AiRing
Ring where AI fight the question

## Gemini API Setup

1. Copy the example environment file and add your API key:
   ```bash
   cp .env.example .env
   # Edit .env and set GOOGLE_AI_API_KEY
   ```
   Get a free API key at <https://aistudio.google.com/app/apikey>.

2. Install dependencies:
   ```bash
   npm install
   ```

3. Ask a question:
   ```bash
   node index.js "Who invented the telephone?"
   # or
   npm start "Who invented the telephone?"
   ```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GOOGLE_AI_API_KEY` | Google AI (Gemini) API key | *(required)* |
| `GOOGLE_AI_MODEL` | Gemini model name | `gemini-1.5-pro` |

