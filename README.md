# IPipe — YouTube AI Analyzer

> **Your YouTube, piped through AI.**

IPipe is a Chrome extension that analyzes any YouTube video using multi-AI intelligence. Generate structured notes, fact-check claims with up to three AI models simultaneously, and translate content into 10 Indian regional languages — all from a sidebar panel right on the YouTube page.

![Version](https://img.shields.io/badge/version-2.1.0-6c63ff?style=flat-square)
![Manifest](https://img.shields.io/badge/Manifest-V3-10b981?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Chrome](https://img.shields.io/badge/Chrome-Extension-orange?style=flat-square)

---

## What Does IPipe Mean?

**I** = You (first person, the viewer) — just like **You**Tube
**Pipe** = Tube — as in **Tube** → Pipe

IPipe = a pipeline that takes YouTube content and pipes it through AI — for you.

---

## Features

### 📓 Smart Notes — 3 Formats
Gemini watches the video and generates structured notes in your preferred format:
- **Study Notes** — Core concepts, key facts, insights, Q&A, and full summary
- **Cornell Notes** — Cue questions + detailed notes + bottom summary
- **Flashcards** — 20–30 Q&A pairs for active recall and exam prep

### 🔍 Multi-AI Fact Check
Verify every claim in a video with up to three AI perspectives simultaneously:
- **Gemini** (required) — watches the video directly, gives authenticity score 1–10
- **GPT-4o with Web Search** (optional) — cross-validates with real-time internet
- **Claude** (optional) — deep reasoning-based analysis

Each AI returns per-claim verdicts: ✅ True · ❌ False · ⚠️ Misleading · ❓ Unverified

### 📝 Smart Summaries — 6 Section Types
Mix and match sections for a custom summary:
- 📋 Summary · 🔑 Key Points · 🚀 Action Plan · 💡 Takeaways · ⏱️ Timestamps · 💬 Quotes

### ⚙️ Custom Prompts
Write any instruction and let Gemini follow it on the video:
- Built-in templates: Study Notes, Quiz (10 MCQs), Tweet Thread, Email Summary
- Save your own reusable prompt templates

### 🌐 Indian Language Translation
Translate any result to 10 Indian languages via Sarvam AI:
Hindi · Bengali · Tamil · Telugu · Kannada · Malayalam · Gujarati · Marathi · Punjabi · Odia

### 📥 Export Options
- Download as **PDF** (print-ready, formatted)
- Download as **Word** (.doc)
- One-click **Copy to Clipboard**

---

## Screenshots

> *(Add screenshots here once published — show panel on YouTube page, fact-check results, notes output)*

---

## Installation

### From Chrome Web Store *(coming soon)*
Click **Add to Chrome** on the Chrome Web Store listing.

### Manual / Developer Install

1. **Download** or clone this repository:
   ```
   git clone https://github.com/YOUR_USERNAME/ipipe.git
   ```

2. **Open Chrome** and navigate to `chrome://extensions/`

3. **Enable Developer Mode** — toggle in the top-right corner

4. Click **"Load unpacked"** and select the `I-Pipe` folder

5. The IPipe icon appears in your Chrome toolbar

---

## API Key Setup

### Required — Google Gemini (Free)
Gemini is the primary AI that watches YouTube videos directly.

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in and click **"Create API Key"**
3. Copy the key (starts with `AIza...`)
4. Open IPipe popup → **Setup tab** → paste under **Google Gemini API Key** → Save

> Free tier: 15 requests/minute, 1 million tokens/day. More than enough for regular use.

### Optional — OpenAI / ChatGPT (Cross Fact-Check)
Adds GPT-4o with web search to fact-checking, so it can verify claims against live internet data.

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new key (starts with `sk-...`)
3. Paste under **OpenAI / ChatGPT API Key** in IPipe → Save

### Optional — Anthropic / Claude (Cross Fact-Check)
Adds Claude's deep reasoning to fact-checking.

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Create a new key (starts with `sk-ant-...`)
3. Paste under **Anthropic / Claude API Key** in IPipe → Save

### Optional — Sarvam AI (Indian Language Translation)
Required only if you want to translate results to Indian languages.

1. Sign up at [sarvam.ai](https://www.sarvam.ai/)
2. Get your API subscription key from the dashboard
3. Paste under **Sarvam AI API Key** in IPipe → Save

---

## How to Use

1. Go to any YouTube video
2. The **IPipe panel** appears on the right sidebar
3. Pick a tab: **Fact Check · Notes · Summarize · Custom**
4. Click the action button
5. Wait 20–90 seconds (Gemini analyzes the full video)
6. Download, copy, or translate the result

---

## Settings

### Default Summary Sections
Choose which sections appear pre-selected when you open Summarize.

### Custom Instructions
Persistent instructions appended to every Gemini prompt. Examples:
- `Focus on scientific accuracy and flag pseudoscience`
- `Use simple language — assume the reader is a student`
- `Highlight any logical fallacies or rhetorical tricks`

### Custom Prompt Templates
Save reusable prompts in the format `Template Name | Prompt text`:
```
Study Notes | Create detailed study notes with definitions and examples
Blog Post | Turn this into a blog post with an engaging introduction
Debate Prep | List arguments for and against the main points
```

---

## Why Is It Slow?

Gemini doesn't use a pre-extracted transcript — it **watches the video directly** using multimodal AI. This is more accurate (it can see visuals, hear tone, catch on-screen text), but takes 30–90 seconds per request depending on video length and API load.

The loading message tells you it's running. There's no way to make it faster without sacrificing accuracy — but results are worth the wait.

---

## Project Structure

```
I-Pipe/
├── manifest.json              # Chrome Extension config (Manifest V3)
├── background/
│   └── background.js          # Service worker: all API calls
├── content/
│   ├── content.js             # YouTube page injection + UI logic
│   └── content.css            # Injected panel styles
├── popup/
│   ├── popup.html             # Extension popup: API key setup
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── icons/
│   ├── icon.svg               # Source SVG logo (convert to PNG)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## Privacy & Security

- **Zero data collection** — IPipe never phones home or tracks you
- **Local key storage** — API keys are stored only in Chrome's local extension storage, on your device
- **Direct API calls** — your keys go directly to Google / OpenAI / Anthropic / Sarvam servers, nowhere else
- **Open source** — the entire codebase is auditable

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Panel doesn't appear | Refresh the YouTube page; make sure IPipe is enabled in `chrome://extensions/` |
| "No Gemini API key" error | Open IPipe popup → Setup → add your Gemini key |
| Request takes very long | Normal for long videos (30–90 s). If it fails, wait 1–2 min and retry (rate limit) |
| Rate limit error (429) | Free Gemini tier has per-minute limits. Wait ~1 minute |
| OpenAI / Claude not appearing | Only shows if that API key is saved in Setup |
| Translation not showing | Add a Sarvam AI key in the Setup tab |
| Results cut off | Try fewer summary sections, or use a shorter video |

---

## Publishing on Chrome Web Store

To submit IPipe to the Chrome Web Store:

1. Zip the extension folder (exclude `.git`, `node_modules`, etc.):
   ```
   zip -r ipipe.zip . --exclude "*.git*" --exclude "node_modules/*"
   ```

2. Go to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/)

3. Click **"New Item"** → upload `ipipe.zip`

4. Fill in:
   - **Name**: IPipe — YouTube AI Analyzer
   - **Short description** (132 chars max): AI-powered YouTube analyzer. Notes, multi-AI fact-check & Indian language translation — powered by Gemini, GPT-4o & Claude.
   - **Detailed description**: (use the Features section above)
   - **Category**: Productivity
   - **Screenshots**: At least 1280×800 or 640×400 (required)
   - **Promo tile**: 440×280 (optional but recommended)

5. Under **Privacy** — declare that the extension:
   - Uses remote code: No
   - Collects user data: No (just explain keys are stored locally)

6. Submit for review (usually 1–3 business days)

### Icon Files
The `icons/icon.svg` is the source file. Export it as PNG at:
- `icon16.png` — 16×16 px
- `icon48.png` — 48×48 px
- `icon128.png` — 128×128 px

You can use [Figma](https://figma.com), [Inkscape](https://inkscape.org/), or an online SVG-to-PNG converter like [svgtopng.com](https://svgtopng.com).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Platform | Chrome Extension (Manifest V3) |
| Primary AI | Google Gemini 2.0 Flash (video multimodal) |
| Cross Fact-Check | OpenAI GPT-4o + Web Search |
| Cross Fact-Check | Anthropic Claude Haiku 4.5 |
| Translation | Sarvam AI Mayura v1 |
| Export | PDF (browser print) + Word (.doc blob) |

---

## License

MIT License — free to use, modify, and distribute.

---

## Contributing

Pull requests welcome. For major changes, open an issue first to discuss.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes
4. Push and open a Pull Request

---

*Built with Gemini's multimodal video understanding · Designed for curious minds*
