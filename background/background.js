// background/background.js — IPipe v2.1 — Gemini + OpenAI + Anthropic + Sarvam AI

const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';

// Gemini model fallback chain
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-2.5-flash'];

// ── Gemini API call (video URL + text prompt) ─────────────────────
async function callGemini(apiKey, videoUrl, textPrompt, model) {
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{
      parts: [
        { fileData: { fileUri: videoUrl, mimeType: 'video/*' } },
        { text: textPrompt },
      ],
    }],
    generationConfig: {
      temperature: 0.4,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `HTTP ${response.status}`;
    const error = new Error(msg);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini.');
  return text;
}

// ── Gemini with retry + model fallback ───────────────────────────
async function callWithRetry(apiKey, videoUrl, textPrompt) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log(`[IPipe] Trying ${model} (attempt ${attempt + 1})...`);
        const result = await callGemini(apiKey, videoUrl, textPrompt, model);
        console.log(`[IPipe] ✅ Gemini success with ${model}`);
        return result;
      } catch (e) {
        lastError = e;
        console.log(`[IPipe] ❌ ${model}: ${e.message}`);

        if (e.status === 429 || e.status === 503) {
          if (attempt === 0) {
            const wait = 3 + Math.random() * 4;
            await new Promise(r => setTimeout(r, wait * 1000));
            continue;
          }
          break;
        }
        break;
      }
    }
  }

  if (lastError?.status === 429) {
    throw new Error(
      'All Gemini models rate-limited. Wait 1-2 minutes and try again. ' +
      'Free Gemini API has per-minute limits on video processing.'
    );
  }
  throw lastError || new Error('All Gemini models failed.');
}

// ── OpenAI API call ───────────────────────────────────────────────
async function callOpenAI(apiKey, systemPrompt, userContent) {
  // Try search-enabled model first, fall back to standard gpt-4o
  const configs = [
    { model: 'gpt-4o-search-preview', web_search_options: { search_context_size: 'medium' } },
    { model: 'gpt-4o' },
  ];

  let lastError;
  for (const { model, ...extra } of configs) {
    try {
      console.log(`[IPipe] Trying OpenAI ${model}...`);
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          ...extra,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        lastError = new Error(err?.error?.message || `HTTP ${response.status}`);
        // Auth errors are fatal, don't try next model
        if (response.status === 401 || response.status === 403) throw lastError;
        console.log(`[IPipe] OpenAI ${model} failed (${response.status}), trying next...`);
        continue;
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error('Empty response from OpenAI.');
      console.log(`[IPipe] ✅ OpenAI success with ${model}`);
      return text;
    } catch (e) {
      lastError = e;
      if (e.message.includes('401') || e.message.includes('403') ||
          e.message.includes('Incorrect API key') || e.message.includes('invalid_api_key')) {
        throw e;
      }
      console.log(`[IPipe] OpenAI ${model} error: ${e.message}`);
    }
  }
  throw lastError || new Error('OpenAI API call failed.');
}

// ── Anthropic Claude API call ─────────────────────────────────────
async function callClaude(apiKey, systemPrompt, userContent) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Anthropic HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude.');
  console.log('[IPipe] ✅ Claude success');
  return text;
}

// ── Sarvam AI Translation (with chunking) ────────────────────────
const SARVAM_CHUNK_SIZE = 900;

function splitIntoChunks(text, maxLen) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';

  for (const para of paragraphs) {
    if (!para.trim()) continue;

    if (current.length === 0) {
      if (para.length > maxLen) {
        // Long paragraph: split at line breaks
        const lines = para.split('\n');
        for (const line of lines) {
          if (current.length + (current ? 1 : 0) + line.length <= maxLen) {
            current += (current ? '\n' : '') + line;
          } else {
            if (current) chunks.push(current);
            current = line.slice(0, maxLen);
          }
        }
      } else {
        current = para;
      }
    } else if (current.length + 2 + para.length <= maxLen) {
      current += '\n\n' + para;
    } else {
      chunks.push(current);
      current = para.length > maxLen ? para.slice(0, maxLen) : para;
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(c => c.trim());
}

async function callSarvam(apiKey, text, targetLang) {
  const chunks = splitIntoChunks(text, SARVAM_CHUNK_SIZE);
  const translated = [];

  for (const chunk of chunks) {
    const response = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        input: chunk,
        source_language_code: 'en-IN',
        target_language_code: targetLang,
        speaker_gender: 'Female',
        mode: 'formal',
        model: 'mayura:v1',
        enable_preprocessing: false,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.message || err?.detail || `Sarvam HTTP ${response.status}`);
    }

    const data = await response.json();
    const translatedText = data?.translated_text;
    if (!translatedText) throw new Error('Empty response from Sarvam AI.');
    translated.push(translatedText);
  }

  return translated.join('\n\n');
}

// ── Key Validation ────────────────────────────────────────────────
async function validateGemini(apiKey) {
  try {
    const url = `${GEMINI_API}/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply OK' }] }],
        generationConfig: { maxOutputTokens: 10 },
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${resp.status}`);
    }
    return { valid: true, message: 'Gemini key is valid!' };
  } catch (e) {
    return { valid: false, message: e.message };
  }
}

async function validateOpenAI(apiKey) {
  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${resp.status}`);
    }
    return { valid: true, message: 'OpenAI key is valid!' };
  } catch (e) {
    return { valid: false, message: e.message };
  }
}

async function validateClaude(apiKey) {
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${resp.status}`);
    }
    return { valid: true, message: 'Claude key is valid!' };
  } catch (e) {
    return { valid: false, message: e.message };
  }
}

async function validateSarvam(apiKey) {
  try {
    const resp = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        input: 'Hello',
        source_language_code: 'en-IN',
        target_language_code: 'hi-IN',
        speaker_gender: 'Female',
        mode: 'formal',
        model: 'mayura:v1',
        enable_preprocessing: false,
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.message || err?.detail || `HTTP ${resp.status}`);
    }
    return { valid: true, message: 'Sarvam AI key is valid!' };
  } catch (e) {
    return { valid: false, message: e.message };
  }
}

// ── Prompt Builders ───────────────────────────────────────────────
function factCheckPrompt(title, extra) {
  return `You are an expert fact-checker. Watch this YouTube video carefully and verify all factual claims.

VIDEO TITLE: "${title}"
${extra ? `\nADDITIONAL INSTRUCTIONS:\n${extra}\n` : ''}
Structure your response EXACTLY:

## 🔍 Overall Authenticity Score
Score 1-10 (10 = highly factual) with a one-line verdict.

## ✅ Verified Facts
For each TRUE claim:
- **Claim**: [what was said]
- **Verdict**: ✅ TRUE
- **Evidence**: [supporting evidence]

## ❌ False or Misleading Claims
For each FALSE/MISLEADING claim:
- **Claim**: [what was said]
- **Verdict**: ❌ FALSE / ⚠️ MISLEADING / ❓ UNVERIFIED
- **Correction**: [accurate information]

## ⚠️ Claims Needing More Context
Partially true claims that need nuance.

## 🎯 Bottom Line
2-3 sentence reliability summary.

Be thorough. If opinion-based, note that and check embedded facts.`;
}

function claimsExtractPrompt(title) {
  return `Watch this YouTube video titled "${title}".
Extract every specific factual claim, statistic, historical statement, and verifiable assertion made.
Return ONLY a numbered list of claims — no analysis, no commentary.
Format: 1. [claim text]`;
}

function summaryPrompt(title, extra, sections) {
  const map = {
    summary: `## 📋 Summary\nComprehensive summary in 3-5 paragraphs.`,
    keyPoints: `## 🔑 Key Points\n7-15 bullet points, each a standalone insight.`,
    actionPlan: `## 🚀 Action Plan\nNumbered step-by-step actionable steps.`,
    takeaways: `## 💡 Key Takeaways\nTop 5-7 memorable lessons.`,
    timestamps: `## ⏱️ Topic Outline\nLogical sections with descriptions.`,
    quotes: `## 💬 Notable Quotes\nMost impactful statements.`,
  };
  const body = sections.filter(s => map[s]).map(s => map[s]).join('\n\n');

  return `You are an expert analyst. Watch this YouTube video and generate comprehensive notes.

VIDEO TITLE: "${title}"
${extra ? `\nADDITIONAL INSTRUCTIONS:\n${extra}\n` : ''}
Generate these sections:

${body}

Use clean Markdown. Be thorough and specific.`;
}

function notesPrompt(title, style, extra) {
  const styles = {
    study: `Generate comprehensive STUDY NOTES with this exact structure:

## 📚 Topic Overview
Brief 2-3 sentence overview of what this video covers.

## 🔑 Core Concepts & Definitions
For each major concept discussed:
**[Concept Name]**: Clear definition in 1-2 sentences.
- Example: [concrete example from the video]
- Why it matters: [brief explanation]

## 📊 Key Facts, Statistics & Data
All specific numbers, dates, research findings, and verifiable data mentioned.

## 💡 Important Insights
The most valuable and non-obvious ideas presented.

## 🔗 Connections & Relationships
How concepts in this video relate to each other.

## ❓ Questions & Answers
Key questions the video addresses, with their answers.

## 📝 Complete Summary
A comprehensive 3-4 paragraph synthesis of everything covered.`,

    cornell: `Generate CORNELL-STYLE NOTES with this exact structure:

## 🔍 Cue Questions (Left Column)
List 12-15 specific questions that capture the core ideas and would help recall the material.

## 📝 Notes (Right Column)
For each cue question above, provide detailed notes:
- Main points and explanations
- Examples and evidence
- Supporting details from the video

## 📌 Summary (Bottom Section)
A concise 2-paragraph summary of the entire video content in your own words.`,

    flashcard: `Generate FLASHCARD Q&A PAIRS for active recall studying.

Create 20-30 flashcard pairs. Cover: key definitions, important facts, cause-effect relationships, critical comparisons, and main insights.

Format each pair exactly as:
---
**Q:** [Specific, clear question]
**A:** [Concise, complete answer]`,
  };

  return `You are an expert educator and note-taker. Watch this YouTube video carefully and create detailed notes.

VIDEO TITLE: "${title}"
${extra ? `\nADDITIONAL INSTRUCTIONS:\n${extra}\n` : ''}
${styles[style] || styles.study}

Be specific to THIS video's content. Use clean Markdown formatting. Be thorough.`;
}

function customPromptText(title, prompt) {
  return `Watch this YouTube video and follow the instructions precisely.

VIDEO TITLE: "${title}"

INSTRUCTIONS:
${prompt}

Respond in clean Markdown.`;
}

function crossCheckPrompt(title, claims) {
  return `VIDEO TITLE: "${title}"

CLAIMS FROM THE VIDEO TO FACT-CHECK:
${claims}

For each claim above, provide your verdict:
- ✅ TRUE — [brief supporting evidence]
- ❌ FALSE — [correction with accurate information]
- ⚠️ MISLEADING — [what's accurate vs what's off]
- ❓ UNVERIFIED — [why it's hard to verify]

End with an **Overall Authenticity Score (1-10)** and a 2-sentence summary.

Use clean Markdown formatting.`;
}

// ── Message Handler ───────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      // ── Key validation ──────────────────────────────────────────
      if (request.action === 'validateKey') {
        sendResponse(await validateGemini(request.apiKey));
        return;
      }
      if (request.action === 'validateOpenAI') {
        sendResponse(await validateOpenAI(request.apiKey));
        return;
      }
      if (request.action === 'validateClaude') {
        sendResponse(await validateClaude(request.apiKey));
        return;
      }
      if (request.action === 'validateSarvam') {
        sendResponse(await validateSarvam(request.apiKey));
        return;
      }

      // ── Translation ─────────────────────────────────────────────
      if (request.action === 'translate') {
        const { sarvamKey } = await chrome.storage.local.get('sarvamKey');
        if (!sarvamKey) throw new Error('No Sarvam AI key configured. Add it in the extension popup → Setup tab.');
        const result = await callSarvam(sarvamKey, request.text, request.targetLang);
        sendResponse({ success: true, result });
        return;
      }

      // ── Main AI actions — require Gemini key ────────────────────
      const { apiKey } = await chrome.storage.local.get('apiKey');
      if (!apiKey) throw new Error('No Gemini API key. Click the extension icon to configure.');

      // ── Notes ───────────────────────────────────────────────────
      if (request.action === 'notes') {
        const prompt = notesPrompt(request.videoTitle, request.noteStyle, request.customInstructions);
        const result = await callWithRetry(apiKey, request.videoUrl, prompt);
        sendResponse({ success: true, result });
        return;
      }

      // ── Fact-check (single or multi-AI) ────────────────────────
      if (request.action === 'factCheckMulti') {
        const { openaiKey, anthropicKey } = await chrome.storage.local.get(['openaiKey', 'anthropicKey']);
        const needsClaims = (request.useOpenAI && openaiKey) || (request.useClaude && anthropicKey);

        // Step 1: Extract claims from video (needed for cross-AI checks)
        let claimsText = '';
        if (needsClaims) {
          try {
            claimsText = await callWithRetry(apiKey, request.videoUrl, claimsExtractPrompt(request.videoTitle));
          } catch (e) {
            claimsText = '(Could not extract claims — Gemini encountered an error)';
          }
        }

        // Step 2: Launch all fact-checks in parallel
        const promises = [];

        // Always run Gemini primary fact-check
        promises.push(
          callWithRetry(apiKey, request.videoUrl, factCheckPrompt(request.videoTitle, request.customInstructions))
            .then(r => ({ source: 'gemini', result: r }))
            .catch(e => ({ source: 'gemini', error: e.message }))
        );

        if (request.useOpenAI && openaiKey) {
          promises.push(
            callOpenAI(
              openaiKey,
              'You are an expert fact-checker with access to web search. Analyze claims thoroughly and cite sources where possible.',
              crossCheckPrompt(request.videoTitle, claimsText)
            )
              .then(r => ({ source: 'openai', result: r }))
              .catch(e => ({ source: 'openai', error: e.message }))
          );
        }

        if (request.useClaude && anthropicKey) {
          promises.push(
            callClaude(
              anthropicKey,
              'You are an expert fact-checker. Analyze claims carefully and provide evidence-based verdicts.',
              crossCheckPrompt(request.videoTitle, claimsText)
            )
              .then(r => ({ source: 'claude', result: r }))
              .catch(e => ({ source: 'claude', error: e.message }))
          );
        }

        const allResults = await Promise.all(promises);
        const resultMap = {};
        allResults.forEach(r => { resultMap[r.source] = r; });
        sendResponse({ success: true, results: resultMap });
        return;
      }

      // ── Summarize ───────────────────────────────────────────────
      if (request.action === 'summarize') {
        const prompt = summaryPrompt(request.videoTitle, request.customInstructions, request.sections);
        const result = await callWithRetry(apiKey, request.videoUrl, prompt);
        sendResponse({ success: true, result });
        return;
      }

      // ── Custom prompt ───────────────────────────────────────────
      if (request.action === 'customPrompt') {
        const prompt = customPromptText(request.videoTitle, request.prompt);
        const result = await callWithRetry(apiKey, request.videoUrl, prompt);
        sendResponse({ success: true, result });
        return;
      }

      throw new Error('Unknown action');
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  })();
  return true;
});
