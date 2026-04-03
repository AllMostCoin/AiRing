# 🥊 AI Ring

> A 2D room where AI models (GPT-4, Claude, Gemini, Mistral) compete and collaborate on your questions. The highest-scoring AI becomes the representative voice.

---

## Live demo

Deploy in one click — the app works in **demo mode** (simulated responses) with no API keys, and switches to real AI responses when keys are provided.

### Deploy to Render (free, recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/AllMostCoin/AiRing)

1. Click the button above (or go to **Render Dashboard → New → Blueprint**, connect this repo)
2. Render reads `render.yaml` automatically
3. *(Optional)* Add AI API keys as environment variables in the Render dashboard:
   | Variable | Where to get it |
   |---|---|
   | `OPENAI_API_KEY` | https://platform.openai.com/api-keys |
   | `ANTHROPIC_API_KEY` | https://console.anthropic.com/keys |
   | `GOOGLE_API_KEY` | https://aistudio.google.com/app/apikey |
   | `MISTRAL_API_KEY` | https://console.mistral.ai/api-keys |

### Deploy with Docker

Works on any Docker-compatible host (Railway, Fly.io, DigitalOcean App Platform, etc.):

```bash
# Build
docker build -t airing .

# Run (demo mode — no keys needed)
docker run -p 3000:3000 airing

# Run with real AI keys
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e GOOGLE_API_KEY=AIza... \
  -e MISTRAL_API_KEY=... \
  airing
```

Open **http://localhost:3000** in your browser.

### Deploy to Railway

1. Install the [Railway CLI](https://docs.railway.app/develop/cli) or use the GitHub integration
2. `railway link` → `railway up`
3. Set environment variables in the Railway dashboard

### Run locally

```bash
git clone https://github.com/AllMostCoin/AiRing.git
cd AiRing
npm install
cp .env.example .env   # fill in API keys (optional)
npm start              # http://localhost:3000
```

---

## How it works

1. You type a question or task into the ring
2. All four AI models are called **simultaneously**
3. Each response is scored by keyword overlap, length, structure, and model-strength bonuses
4. The highest-scoring AI is crowned **winner** and its response is displayed
5. All responses are available in the "Show all responses" accordion

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port to listen on | `3000` |
| `OPENAI_API_KEY` | OpenAI (GPT-4o) | — |
| `ANTHROPIC_API_KEY` | Anthropic (Claude 3.5 Sonnet) | — |
| `GOOGLE_API_KEY` | Google (Gemini 1.5 Flash) | — |
| `MISTRAL_API_KEY` | Mistral (mistral-large) | — |

No API keys → demo mode with realistic simulated responses.
