# Privacy Policy — IPipe

**Last updated: March 6, 2026**

IPipe ("the Extension") is a Chrome extension that analyzes YouTube videos using AI APIs. This policy explains what data is collected, how it is used, and your rights.

---

## 1. Data We Collect

### API Keys (stored locally)
- You optionally enter API keys for Google Gemini, OpenAI, Anthropic, and/or Sarvam AI.
- These keys are stored **exclusively in Chrome's local extension storage** (`chrome.storage.local`) on your device.
- They are **never transmitted to our servers** — there are no IPipe servers.

### YouTube Video URLs
- When you trigger an analysis, the URL of the currently open YouTube video is sent directly from your browser to whichever AI API(s) you have configured.
- No other browsing data or history is collected.

---

## 2. How Data Is Used

| Data | Purpose | Who receives it |
|------|---------|-----------------|
| YouTube video URL | Video analysis (notes, fact-check, translation) | Google Gemini, OpenAI, Anthropic, and/or Sarvam AI — only the APIs you configure |
| API keys | Authenticating requests to AI APIs | Stored locally; transmitted only to the respective API provider as an Authorization header |

All AI API calls are made **directly from your browser** to the respective provider. IPipe has no intermediate backend.

---

## 3. Data We Do NOT Collect

- We do not collect names, email addresses, or any personal identifiers.
- We do not collect browsing history.
- We do not use analytics or tracking.
- We do not use cookies.
- We do not sell or share any data with third parties.

---

## 4. Third-Party Services

When you use IPipe, data is sent to the AI providers whose keys you supply. Their privacy practices are governed by their own policies:

- **Google Gemini**: https://policies.google.com/privacy
- **OpenAI**: https://openai.com/policies/privacy-policy
- **Anthropic**: https://www.anthropic.com/privacy
- **Sarvam AI**: https://www.sarvam.ai/privacy-policy

IPipe is not affiliated with any of these providers.

---

## 5. Data Retention

IPipe stores nothing remotely. API keys remain in your local Chrome storage until you clear them via the extension popup or uninstall the extension. No data persists on any external server.

---

## 6. Children's Privacy

IPipe is not directed at children under 13 and does not knowingly collect data from minors.

---

## 7. Changes to This Policy

If this policy is updated, the "Last updated" date at the top will change. Continued use of the Extension after changes constitutes acceptance of the updated policy.

---

## 8. Contact

For questions about this policy, open an issue on the project repository or contact the developer directly through GitHub.
