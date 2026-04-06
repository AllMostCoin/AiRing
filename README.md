# 🥊 AI Ring

> A 2D arena where AI models (GPT-4, Claude, Gemini, Mistral, Copilot, Grok, Ollama) compete and collaborate on your questions. The highest-scoring AI becomes the representative voice — styled as a Final Fantasy VII battle scene.

---

## Live demo

🌐 **[https://allMostCoin.github.io/AiRing/](https://allMostCoin.github.io/AiRing/)** — hosted on GitHub Pages, no backend required.

The app works fully in your browser in **demo mode** (simulated responses). It switches to live AI responses when connected to the self-hosted backend with API keys configured. Each character shows a **● LIVE** or **○ DEMO** badge so you know exactly which APIs are active.

| Character | AI Model | API key / config needed |
|---|---|---|
| Cloud (⚔️) | GPT-4.1 | `OPENAI_API_KEY` |
| Barret (🔫) | Claude Sonnet | `ANTHROPIC_API_KEY` |
| Red XIII (🔥) | Gemini 2.5 Flash | `GOOGLE_API_KEY` |
| Cid (✈️) | Mistral Large | `MISTRAL_API_KEY` |
| Tifa (👊) | GitHub Copilot (GitHub Models) | `GITHUB_TOKEN` |
| Vincent (🦇) | Grok 3 mini | `XAI_API_KEY` |
| Yuffie (🌊) | **Ollama** (free, local) | `OLLAMA_MODEL=llama3.2` |

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
   | `GITHUB_TOKEN` | https://github.com/settings/tokens (Models permission) |
   | `XAI_API_KEY` | https://console.x.ai/ |

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
  -e GITHUB_TOKEN=ghp_... \
  -e XAI_API_KEY=xai-... \
  airing
```

Open **http://localhost:3000** in your browser.

### Run locally with Ollama (free, no cloud keys)

[Ollama](https://ollama.com) lets Yuffie run a real local AI model for free:

```bash
# 1. Install Ollama: https://ollama.com
# 2. Pull a model
ollama pull llama3.2

# 3. Clone and start AiRing
git clone https://github.com/AllMostCoin/AiRing.git
cd AiRing
npm install

# 4. Configure Ollama in .env
echo "OLLAMA_MODEL=llama3.2" >> .env
echo "OLLAMA_BASE_URL=http://localhost:11434" >> .env

npm start   # http://localhost:3000
```

Yuffie shows **● LIVE** and sends prompts to your local Ollama instance. No API key or account needed.

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
2. All seven AI models are called **simultaneously**
3. Each response is scored by keyword overlap, length, structure, and model-strength bonuses
4. The highest-scoring AI is crowned **winner** and its response is displayed
5. All responses are available in the "Show all responses" accordion
6. Each character shows **● LIVE** when its API key is configured, or **○ DEMO** otherwise

## Configuration

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP port to listen on | `3000` |
| `OPENAI_API_KEY` | OpenAI (GPT-4.1) | — |
| `ANTHROPIC_API_KEY` | Anthropic (Claude Sonnet) | — |
| `GOOGLE_API_KEY` | Google (Gemini 2.5 Flash) | — |
| `MISTRAL_API_KEY` | Mistral (mistral-large) | — |
| `GITHUB_TOKEN` | GitHub Copilot (GitHub Models) | — |
| `XAI_API_KEY` | xAI (Grok 3 mini) | — |
| `OLLAMA_MODEL` | Ollama model to use (e.g. `llama3.2`) | — |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |

No API keys → demo mode with realistic simulated responses. Add any subset of keys to activate those models as LIVE — the rest remain in demo mode.
