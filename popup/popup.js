// popup/popup.js — Multi-API key management

document.addEventListener('DOMContentLoaded', init);

function init() {
  setupTabs();
  loadSavedState();
  bindEvents();
}

// ── Tab Switching ─────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ── Load Saved State ──────────────────────────────────────────────
async function loadSavedState() {
  const data = await chrome.storage.local.get([
    'apiKey', 'openaiKey', 'anthropicKey', 'sarvamKey',
    'defaultSections', 'customInstructions', 'customPromptTemplates',
  ]);

  if (data.apiKey) {
    document.getElementById('apiKeyInput').value = data.apiKey;
    showStatus('keyStatus', 'success', '✓ Gemini key saved');
  }
  if (data.openaiKey) {
    document.getElementById('openaiKeyInput').value = data.openaiKey;
    showStatus('openaiStatus', 'success', '✓ OpenAI key saved');
  }
  if (data.anthropicKey) {
    document.getElementById('claudeKeyInput').value = data.anthropicKey;
    showStatus('claudeStatus', 'success', '✓ Claude key saved');
  }
  if (data.sarvamKey) {
    document.getElementById('sarvamKeyInput').value = data.sarvamKey;
    showStatus('sarvamStatus', 'success', '✓ Sarvam AI key saved');
  }

  if (data.defaultSections) {
    document.querySelectorAll('#defaultSections input').forEach((cb) => {
      cb.checked = data.defaultSections.includes(cb.value);
    });
  }
  if (data.customInstructions) {
    document.getElementById('customInstructions').value = data.customInstructions;
  }
  if (data.customPromptTemplates) {
    document.getElementById('customPromptTemplates').value = data.customPromptTemplates;
  }
}

// ── Bind Events ───────────────────────────────────────────────────
function bindEvents() {
  // Toggle visibility buttons
  setupToggle('toggleGeminiVisibility', 'apiKeyInput');
  setupToggle('toggleOpenAIVisibility', 'openaiKeyInput');
  setupToggle('toggleClaudeVisibility', 'claudeKeyInput');
  setupToggle('toggleSarvamVisibility', 'sarvamKeyInput');

  // ── Gemini ──────────────────────────────────────────────────────
  document.getElementById('saveKeyBtn').addEventListener('click', async () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) { showStatus('keyStatus', 'error', '✗ Enter a Gemini API key'); return; }
    await chrome.storage.local.set({ apiKey: key });
    showStatus('keyStatus', 'success', '✓ Gemini key saved');
  });

  document.getElementById('verifyKeyBtn').addEventListener('click', async () => {
    await verifyKey('apiKeyInput', 'verifyKeyBtn', 'keyStatus', 'validateKey', 'Verifying Gemini...');
  });

  // ── OpenAI ──────────────────────────────────────────────────────
  document.getElementById('saveOpenAIBtn').addEventListener('click', async () => {
    const key = document.getElementById('openaiKeyInput').value.trim();
    if (!key) { showStatus('openaiStatus', 'error', '✗ Enter an OpenAI API key'); return; }
    await chrome.storage.local.set({ openaiKey: key });
    showStatus('openaiStatus', 'success', '✓ OpenAI key saved');
  });

  document.getElementById('verifyOpenAIBtn').addEventListener('click', async () => {
    await verifyKey('openaiKeyInput', 'verifyOpenAIBtn', 'openaiStatus', 'validateOpenAI', 'Verifying OpenAI...');
  });

  // ── Claude ──────────────────────────────────────────────────────
  document.getElementById('saveClaudeBtn').addEventListener('click', async () => {
    const key = document.getElementById('claudeKeyInput').value.trim();
    if (!key) { showStatus('claudeStatus', 'error', '✗ Enter an Anthropic API key'); return; }
    await chrome.storage.local.set({ anthropicKey: key });
    showStatus('claudeStatus', 'success', '✓ Claude key saved');
  });

  document.getElementById('verifyClaudeBtn').addEventListener('click', async () => {
    await verifyKey('claudeKeyInput', 'verifyClaudeBtn', 'claudeStatus', 'validateClaude', 'Verifying Claude...');
  });

  // ── Sarvam AI ───────────────────────────────────────────────────
  document.getElementById('saveSarvamBtn').addEventListener('click', async () => {
    const key = document.getElementById('sarvamKeyInput').value.trim();
    if (!key) { showStatus('sarvamStatus', 'error', '✗ Enter a Sarvam AI API key'); return; }
    await chrome.storage.local.set({ sarvamKey: key });
    showStatus('sarvamStatus', 'success', '✓ Sarvam AI key saved');
  });

  document.getElementById('verifySarvamBtn').addEventListener('click', async () => {
    await verifyKey('sarvamKeyInput', 'verifySarvamBtn', 'sarvamStatus', 'validateSarvam', 'Verifying Sarvam AI...');
  });

  // ── Settings ────────────────────────────────────────────────────
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    const sections = [];
    document.querySelectorAll('#defaultSections input:checked').forEach((cb) => {
      sections.push(cb.value);
    });
    await chrome.storage.local.set({
      defaultSections: sections,
      customInstructions: document.getElementById('customInstructions').value.trim(),
      customPromptTemplates: document.getElementById('customPromptTemplates').value.trim(),
    });
    showStatus('settingsStatus', 'success', '✓ Settings saved');
    setTimeout(() => hideStatus('settingsStatus'), 2500);
  });
}

// ── Helpers ───────────────────────────────────────────────────────
function setupToggle(btnId, inputId) {
  document.getElementById(btnId)?.addEventListener('click', () => {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
  });
}

async function verifyKey(inputId, btnId, statusId, action, loadingMsg) {
  const key = document.getElementById(inputId).value.trim();
  if (!key) {
    showStatus(statusId, 'error', '✗ Enter a key first');
    return;
  }
  showStatus(statusId, 'loading', `<span class="spinner"></span> ${loadingMsg}`);
  const btn = document.getElementById(btnId);
  btn.disabled = true;

  try {
    const result = await chrome.runtime.sendMessage({ action, apiKey: key });
    if (result.valid) {
      showStatus(statusId, 'success', `✓ ${result.message}`);
      // Auto-save on successful verification
      const keyMap = {
        validateKey: 'apiKey',
        validateOpenAI: 'openaiKey',
        validateClaude: 'anthropicKey',
        validateSarvam: 'sarvamKey',
      };
      if (keyMap[action]) await chrome.storage.local.set({ [keyMap[action]]: key });
    } else {
      showStatus(statusId, 'error', `✗ ${result.message}`);
    }
  } catch (e) {
    showStatus(statusId, 'error', `✗ ${e.message}`);
  }
  btn.disabled = false;
}

function showStatus(id, type, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `status ${type}`;
  el.innerHTML = html;
}

function hideStatus(id) {
  const el = document.getElementById(id);
  if (el) el.className = 'status hidden';
}
