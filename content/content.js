// content/content.js — IPipe v2.1
// Notes · Multi-AI Fact Check · PDF + Word Download · Sarvam AI Translation

(function () {
  'use strict';

  let currentVideoId = null;
  let videoUrl = '';
  let videoTitle = '';
  let panelInjected = false;
  let initAttempts = 0;

  // Per-tab raw text results (for download/copy/translate)
  let rawResults = { fc: '', notes: '', sum: '', custom: '' };

  // Multi-AI fact check storage
  let fcMultiResults = {};   // { gemini: {result|error}, openai: {result|error}, claude: {result|error} }
  let fcActiveAI = 'gemini';

  // ── Helpers ───────────────────────────────────────────────────────
  function getVideoId() {
    return new URLSearchParams(window.location.search).get('v');
  }
  function getVideoUrl() {
    const vid = getVideoId();
    return vid ? `https://www.youtube.com/watch?v=${vid}` : '';
  }
  function getVideoTitle() {
    for (const sel of [
      '#title h1 yt-formatted-string',
      'h1.ytd-watch-metadata yt-formatted-string',
      '#title h1',
    ]) {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return document.title.replace(' - YouTube', '').trim();
  }
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function sanitizeFilename(name) {
    return name.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 80);
  }

  // ── Markdown → HTML ───────────────────────────────────────────────
  function md2html(md) {
    let html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/^---$/gm, '<hr>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = html.replace(/(<li>.*?<\/li>(?:<br>)?)+/gs, m => `<ul>${m.replace(/<br>/g, '')}</ul>`);
    html = html.replace(/<\/blockquote><br><blockquote>/g, '<br>');

    return `<p>${html}</p>`
      .replace(/<p><\/p>/g, '').replace(/<p><h/g, '<h')
      .replace(/<\/h(\d)><\/p>/g, '</h$1>')
      .replace(/<p><ul>/g, '<ul>').replace(/<\/ul><\/p>/g, '</ul>')
      .replace(/<p><hr><\/p>/g, '<hr>').replace(/<p><hr>/g, '<hr>');
  }

  // ── Strip markdown for plain-text translation ─────────────────────
  function stripMarkdown(md) {
    return md
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/^[-*+]\s+/gm, '• ')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^---+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // ── Language options helper ───────────────────────────────────────
  function langOptions() {
    return `
      <option value="hi-IN">🇮🇳 Hindi</option>
      <option value="bn-IN">Bengali</option>
      <option value="ta-IN">Tamil</option>
      <option value="te-IN">Telugu</option>
      <option value="kn-IN">Kannada</option>
      <option value="ml-IN">Malayalam</option>
      <option value="gu-IN">Gujarati</option>
      <option value="mr-IN">Marathi</option>
      <option value="pa-IN">Punjabi</option>
      <option value="od-IN">Odia</option>`;
  }

  // ── Download as PDF (print dialog) ───────────────────────────────
  function downloadPDF(markdownContent, title) {
    if (!markdownContent) return;
    const htmlContent = md2html(markdownContent);
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const pdfHtml = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"><title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 1.5cm 2cm; size: A4; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', sans-serif; color: #1a1a2e; line-height: 1.65; font-size: 13px; max-width: 800px; margin: 0 auto; padding: 20px; }
    .hdr { background: linear-gradient(135deg,#4338ca,#6c63ff); color: white; padding: 22px 28px; border-radius: 10px; margin-bottom: 24px; }
    .hdr h1 { font-size: 20px; margin-bottom: 5px; font-weight: 700; }
    .hdr .meta { font-size: 11px; opacity: 0.85; }
    .save-bar { background:#f0f0ff; border:1px solid #d0d0e8; border-radius:8px; padding:14px 20px; margin-bottom:24px; text-align:center; }
    .save-bar p { color:#4338ca; font-size:13px; font-weight:500; }
    .save-bar small { color:#666; font-size:11px; }
    .save-btn { background:#4338ca; color:white; border:none; padding:10px 28px; border-radius:6px; font-size:14px; font-weight:600; cursor:pointer; margin-top:8px; }
    h2 { font-size:17px; color:#4338ca; margin:24px 0 10px; padding-bottom:6px; border-bottom:2px solid #e8e8f4; }
    h3 { font-size:14px; color:#2d2a5e; margin:18px 0 8px; }
    p { margin-bottom:10px; }
    ul { margin:8px 0 12px 22px; }
    li { margin-bottom:6px; }
    strong { color:#1a1a2e; }
    blockquote { border-left:3px solid #6c63ff; background:#f5f4ff; padding:10px 16px; margin:10px 0; border-radius:0 6px 6px 0; font-style:italic; color:#444; }
    code { background:#f0f0f5; padding:2px 6px; border-radius:3px; font-size:12px; font-family:Consolas,monospace; }
    hr { border:none; border-top:1px solid #e0e0e8; margin:16px 0; }
    .footer { margin-top:30px; padding-top:14px; border-top:1px solid #e0e0e8; font-size:10px; color:#999; text-align:center; }
  </style>
</head><body>
  <div class="hdr">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${escapeHtml(videoTitle)} • ${now} • IPipe</div>
  </div>
  <div class="save-bar no-print">
    <p>📄 Save this page as PDF</p>
    <small>Click the button below, then choose <strong>"Save as PDF"</strong> as the destination</small><br>
    <button class="save-btn" onclick="window.print()">💾 Save as PDF (Ctrl+P)</button>
  </div>
  <div>${htmlContent}</div>
  <div class="footer">Generated by IPipe • ${escapeHtml(videoUrl)} • ${now}</div>
</body></html>`;

    const blob = new Blob([pdfHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank');
    if (win) win.addEventListener('load', () => setTimeout(() => win.print(), 500));
  }

  // ── Download as Word (.doc) ───────────────────────────────────────
  function downloadWord(markdownContent, title) {
    if (!markdownContent) return;
    const htmlContent = md2html(markdownContent);
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const wordHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'><title>${escapeHtml(title)}</title>
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>90</w:Zoom></w:WordDocument></xml><![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a2e; line-height: 1.6; margin: 2cm; }
    h1 { font-size: 20pt; color: white; background: #4338ca; padding: 12pt 16pt; margin: -2cm -2cm 16pt -2cm; }
    h2 { font-size: 14pt; color: #4338ca; border-bottom: 1pt solid #d0d0e8; padding-bottom: 4pt; margin-top: 16pt; }
    h3 { font-size: 12pt; color: #2d2a5e; margin-top: 12pt; }
    p { margin: 6pt 0; }
    ul, ol { margin: 6pt 0; padding-left: 20pt; }
    li { margin: 4pt 0; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    blockquote { border-left: 3pt solid #6c63ff; padding-left: 12pt; color: #555; font-style: italic; margin: 8pt 0; }
    code { font-family: Consolas, monospace; font-size: 10pt; background: #f5f5f5; padding: 1pt 4pt; }
    hr { border: none; border-top: 1pt solid #e0e0e8; margin: 12pt 0; }
    .meta { color: rgba(255,255,255,0.85); font-size: 10pt; margin-top: 4pt; }
    .footer { margin-top: 20pt; border-top: 1pt solid #ccc; padding-top: 8pt; font-size: 9pt; color: #999; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}<div class="meta">${escapeHtml(videoTitle)} • ${now} • IPipe</div></h1>
  ${htmlContent}
  <div class="footer">Generated by IPipe • ${escapeHtml(videoUrl)} • ${now}</div>
</body></html>`;

    const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitizeFilename(title)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ── Panel Injection ───────────────────────────────────────────────
  function findTarget() {
    for (const sel of ['#secondary-inner', '#secondary', '#below']) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function injectPanel() {
    const old = document.getElementById('ytai-panel');
    if (old) old.remove();
    panelInjected = false;

    const target = findTarget();
    if (!target) {
      if (++initAttempts < 30) setTimeout(injectPanel, 1000);
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'ytai-panel';
    panel.innerHTML = getPanelHTML();
    target.insertBefore(panel, target.firstChild);

    panelInjected = true;
    initAttempts = 0;

    bindPanelEvents(panel);
    checkReady(panel);
  }

  async function checkReady(panel) {
    const statusEl = panel.querySelector('#ytai-status');
    const infoEl = panel.querySelector('#ytai-transcript-info');
    const lengthEl = panel.querySelector('#ytai-transcript-length');

    videoUrl = getVideoUrl();
    videoTitle = getVideoTitle();

    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
      statusEl.className = 'ytai-status error';
      statusEl.innerHTML = '⚠️ No Gemini API key. Click the extension icon ↗ to configure.';
      return;
    }
    if (!videoUrl) {
      statusEl.className = 'ytai-status error';
      statusEl.innerHTML = '⚠️ Could not detect video URL.';
      return;
    }

    statusEl.style.display = 'none';
    infoEl.style.display = 'flex';
    lengthEl.textContent = 'Ready — Gemini will analyze the video directly';
    panel.querySelectorAll('.ytai-btn-primary').forEach(btn => btn.disabled = false);
  }

  // ── Panel HTML ────────────────────────────────────────────────────
  function getPanelHTML() {
    return `
      <div class="ytai-header" id="ytai-toggle">
        <div class="ytai-logo">
          <div class="ytai-logo-badge">
            <svg width="16" height="18" viewBox="0 0 16 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0.5" y="0.5" width="15" height="4.5" rx="2" fill="white"/>
              <rect x="6" y="5" width="4" height="8" fill="white"/>
              <rect x="0.5" y="13" width="15" height="4.5" rx="2" fill="white"/>
            </svg>
          </div>
          <span class="ytai-logo-text">IPipe</span>
        </div>
        <span class="ytai-collapse-icon">▲</span>
      </div>

      <div class="ytai-body">
        <div class="ytai-status info" id="ytai-status">
          <span class="ytai-spinner"></span> Initializing...
        </div>
        <div class="ytai-transcript-info" id="ytai-transcript-info" style="display:none;">
          <span class="ytai-dot green"></span>
          <span id="ytai-transcript-length"></span>
        </div>

        <div class="ytai-tabs">
          <button class="ytai-tab active" data-panel="factcheck">🔍 Fact Check</button>
          <button class="ytai-tab" data-panel="notes">📓 Notes</button>
          <button class="ytai-tab" data-panel="summarize">📝 Summarize</button>
          <button class="ytai-tab" data-panel="custom">⚙️ Custom</button>
        </div>

        <!-- ── Fact Check ──────────────────────────────────────── -->
        <div class="ytai-panel-content active" id="ytai-panel-factcheck">
          <p class="ytai-panel-desc">
            Gemini watches the video and verifies all factual claims. Optionally cross-validate with ChatGPT and Claude.
          </p>

          <div class="ytai-cross-check" id="ytai-cross-check" style="display:none;">
            <div class="ytai-label">Also cross-check with:</div>
            <div class="ytai-ai-checkboxes">
              <label class="ytai-ai-checkbox" id="ytai-openai-check-wrap" style="display:none;">
                <input type="checkbox" id="ytai-use-openai"> 🟢 ChatGPT
              </label>
              <label class="ytai-ai-checkbox" id="ytai-claude-check-wrap" style="display:none;">
                <input type="checkbox" id="ytai-use-claude"> 🔶 Claude
              </label>
            </div>
          </div>

          <textarea class="ytai-textarea" id="ytai-fc-instructions" rows="2"
            placeholder="Optional: Focus areas (e.g., 'Check statistics', 'Focus on science claims')"></textarea>
          <button class="ytai-btn ytai-btn-primary" id="ytai-fc-btn" disabled>🔍 Verify Authenticity</button>

          <div class="ytai-ai-result-tabs" id="ytai-fc-ai-tabs" style="display:none;">
            <button class="ytai-ai-result-tab active" data-ai="gemini">🤖 Gemini</button>
            <button class="ytai-ai-result-tab" data-ai="openai" id="ytai-fc-openai-tab" style="display:none;">🟢 ChatGPT</button>
            <button class="ytai-ai-result-tab" data-ai="claude" id="ytai-fc-claude-tab" style="display:none;">🔶 Claude</button>
          </div>

          <div class="ytai-results hidden" id="ytai-fc-results"></div>

          <div class="ytai-download-row" id="ytai-fc-actions" style="display:none;">
            <button class="ytai-btn ytai-btn-secondary" id="ytai-fc-dl-pdf">📄 PDF</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-fc-dl-word">📝 Word</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-fc-copy">📋 Copy</button>
          </div>

          <div class="ytai-translate-section" id="ytai-fc-translate" style="display:none;">
            <div class="ytai-label">🌐 Translate to Indian Language</div>
            <div class="ytai-translate-controls">
              <select class="ytai-language-select" id="ytai-fc-lang">${langOptions()}</select>
              <button class="ytai-btn ytai-btn-secondary ytai-translate-btn" id="ytai-fc-translate-btn">Translate</button>
            </div>
            <div id="ytai-fc-translated" style="display:none;"></div>
          </div>
        </div>

        <!-- ── Notes ──────────────────────────────────────────── -->
        <div class="ytai-panel-content" id="ytai-panel-notes">
          <p class="ytai-panel-desc">
            Gemini generates structured notes from the video. Choose your preferred note format.
          </p>
          <div class="ytai-label">Note Format</div>
          <div class="ytai-note-style">
            <button class="ytai-note-style-btn active" data-style="study">📚 Study Notes</button>
            <button class="ytai-note-style-btn" data-style="cornell">📋 Cornell Notes</button>
            <button class="ytai-note-style-btn" data-style="flashcard">🃏 Flashcards</button>
          </div>
          <textarea class="ytai-textarea" id="ytai-notes-instructions" rows="2"
            placeholder="Optional: e.g., 'Focus on technical details', 'Use simple language'"></textarea>
          <button class="ytai-btn ytai-btn-primary" id="ytai-notes-btn" disabled>📓 Generate Notes</button>

          <div class="ytai-results hidden" id="ytai-notes-results"></div>

          <div class="ytai-download-row" id="ytai-notes-actions" style="display:none;">
            <button class="ytai-btn ytai-btn-secondary" id="ytai-notes-dl-pdf">📄 PDF</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-notes-dl-word">📝 Word</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-notes-copy">📋 Copy</button>
          </div>

          <div class="ytai-translate-section" id="ytai-notes-translate" style="display:none;">
            <div class="ytai-label">🌐 Translate to Indian Language</div>
            <div class="ytai-translate-controls">
              <select class="ytai-language-select" id="ytai-notes-lang">${langOptions()}</select>
              <button class="ytai-btn ytai-btn-secondary ytai-translate-btn" id="ytai-notes-translate-btn">Translate</button>
            </div>
            <div id="ytai-notes-translated" style="display:none;"></div>
          </div>
        </div>

        <!-- ── Summarize ───────────────────────────────────────── -->
        <div class="ytai-panel-content" id="ytai-panel-summarize">
          <div class="ytai-label">Select sections to generate</div>
          <div class="ytai-sections">
            <button class="ytai-section-tag selected" data-section="summary">📋 Summary</button>
            <button class="ytai-section-tag selected" data-section="keyPoints">🔑 Key Points</button>
            <button class="ytai-section-tag selected" data-section="actionPlan">🚀 Action Plan</button>
            <button class="ytai-section-tag selected" data-section="takeaways">💡 Takeaways</button>
            <button class="ytai-section-tag" data-section="timestamps">⏱️ Timestamps</button>
            <button class="ytai-section-tag" data-section="quotes">💬 Quotes</button>
          </div>
          <textarea class="ytai-textarea" id="ytai-sum-instructions" rows="2"
            placeholder="Optional: Additional instructions"></textarea>
          <button class="ytai-btn ytai-btn-primary" id="ytai-sum-btn" disabled>📝 Generate Summary</button>

          <div class="ytai-results hidden" id="ytai-sum-results"></div>

          <div class="ytai-download-row" id="ytai-sum-actions" style="display:none;">
            <button class="ytai-btn ytai-btn-secondary" id="ytai-sum-dl-pdf">📄 PDF</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-sum-dl-word">📝 Word</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-sum-copy">📋 Copy</button>
          </div>

          <div class="ytai-translate-section" id="ytai-sum-translate" style="display:none;">
            <div class="ytai-label">🌐 Translate to Indian Language</div>
            <div class="ytai-translate-controls">
              <select class="ytai-language-select" id="ytai-sum-lang">${langOptions()}</select>
              <button class="ytai-btn ytai-btn-secondary ytai-translate-btn" id="ytai-sum-translate-btn">Translate</button>
            </div>
            <div id="ytai-sum-translated" style="display:none;"></div>
          </div>
        </div>

        <!-- ── Custom ──────────────────────────────────────────── -->
        <div class="ytai-panel-content" id="ytai-panel-custom">
          <div class="ytai-label">Prompt templates</div>
          <div class="ytai-templates" id="ytai-templates"></div>
          <textarea class="ytai-textarea" id="ytai-custom-prompt" rows="4"
            placeholder="Write your own prompt. Gemini watches the video and follows your instructions.&#10;&#10;Examples:&#10;• Create a quiz with 10 questions&#10;• List all products/tools mentioned&#10;• Create detailed study notes"></textarea>
          <button class="ytai-btn ytai-btn-primary" id="ytai-custom-btn" disabled>⚡ Run Custom Prompt</button>

          <div class="ytai-results hidden" id="ytai-custom-results"></div>

          <div class="ytai-download-row" id="ytai-custom-actions" style="display:none;">
            <button class="ytai-btn ytai-btn-secondary" id="ytai-custom-dl-pdf">📄 PDF</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-custom-dl-word">📝 Word</button>
            <button class="ytai-btn ytai-btn-secondary" id="ytai-custom-copy">📋 Copy</button>
          </div>

          <div class="ytai-translate-section" id="ytai-custom-translate" style="display:none;">
            <div class="ytai-label">🌐 Translate to Indian Language</div>
            <div class="ytai-translate-controls">
              <select class="ytai-language-select" id="ytai-custom-lang">${langOptions()}</select>
              <button class="ytai-btn ytai-btn-secondary ytai-translate-btn" id="ytai-custom-translate-btn">Translate</button>
            </div>
            <div id="ytai-custom-translated" style="display:none;"></div>
          </div>
        </div>
      </div>`;
  }

  // ── Event Binding ─────────────────────────────────────────────────
  async function bindPanelEvents(panel) {
    // Collapse toggle
    panel.querySelector('#ytai-toggle').addEventListener('click', () => panel.classList.toggle('collapsed'));

    // Main tabs
    panel.querySelectorAll('.ytai-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.ytai-tab').forEach(t => t.classList.remove('active'));
        panel.querySelectorAll('.ytai-panel-content').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        panel.querySelector(`#ytai-panel-${tab.dataset.panel}`).classList.add('active');
      });
    });

    // Section tags (summarize)
    panel.querySelectorAll('.ytai-section-tag').forEach(tag => {
      tag.addEventListener('click', () => tag.classList.toggle('selected'));
    });

    // Note style buttons
    panel.querySelectorAll('.ytai-note-style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.ytai-note-style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // AI result sub-tabs (multi-AI fact check)
    panel.querySelectorAll('.ytai-ai-result-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        panel.querySelectorAll('.ytai-ai-result-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        fcActiveAI = tab.dataset.ai;

        const aiData = fcMultiResults[fcActiveAI];
        const resultsEl = panel.querySelector('#ytai-fc-results');
        const translatedEl = panel.querySelector('#ytai-fc-translated');

        // Reset translate on tab switch
        if (translatedEl) { translatedEl.style.display = 'none'; translatedEl.innerHTML = ''; }

        if (aiData?.error) {
          resultsEl.innerHTML = `<p style="color:var(--ytai-error);">❌ ${escapeHtml(aiData.error)}</p>`;
          rawResults.fc = '';
        } else if (aiData?.result) {
          resultsEl.innerHTML = md2html(aiData.result);
          rawResults.fc = aiData.result;
        }
      });
    });

    // Action buttons
    panel.querySelector('#ytai-fc-btn').addEventListener('click', () => runFactCheck(panel));
    panel.querySelector('#ytai-notes-btn').addEventListener('click', () => runNotes(panel));
    panel.querySelector('#ytai-sum-btn').addEventListener('click', () => runSummarize(panel));
    panel.querySelector('#ytai-custom-btn').addEventListener('click', () => runCustom(panel));

    // Download + Copy + Translate for each tab
    const tabMeta = {
      fc: 'Fact-Check Report',
      notes: 'Video Notes',
      sum: 'Video Summary',
      custom: 'Custom Analysis',
    };
    Object.entries(tabMeta).forEach(([prefix, title]) => {
      panel.querySelector(`#ytai-${prefix}-dl-pdf`)?.addEventListener('click', () => {
        downloadPDF(rawResults[prefix], title);
      });
      panel.querySelector(`#ytai-${prefix}-dl-word`)?.addEventListener('click', () => {
        downloadWord(rawResults[prefix], title);
      });
      panel.querySelector(`#ytai-${prefix}-copy`)?.addEventListener('click', () => {
        if (!rawResults[prefix]) return;
        navigator.clipboard.writeText(rawResults[prefix]).then(() => {
          const btn = panel.querySelector(`#ytai-${prefix}-copy`);
          const orig = btn.textContent;
          btn.textContent = '✓ Copied!';
          setTimeout(() => btn.textContent = orig, 1500);
        });
      });
      panel.querySelector(`#ytai-${prefix}-translate-btn`)?.addEventListener('click', () => {
        runTranslate(panel, prefix);
      });
    });

    // Check optional API keys to show/hide features
    await updateOptionalFeatures(panel);
    loadTemplates(panel);
    loadDefaultSections(panel);
  }

  // Show/hide cross-check options and translation based on configured keys
  async function updateOptionalFeatures(panel) {
    const { openaiKey, anthropicKey, sarvamKey } = await chrome.storage.local.get(['openaiKey', 'anthropicKey', 'sarvamKey']);

    const hasOpenAI = !!openaiKey;
    const hasClaude = !!anthropicKey;

    if (hasOpenAI || hasClaude) {
      panel.querySelector('#ytai-cross-check').style.display = 'block';
      if (hasOpenAI) panel.querySelector('#ytai-openai-check-wrap').style.display = 'flex';
      if (hasClaude) panel.querySelector('#ytai-claude-check-wrap').style.display = 'flex';
    }

    // Store for use in showResult
    panel._hasSarvam = !!sarvamKey;
  }

  // ── Loading / Result / Error helpers ─────────────────────────────
  function showLoading(btn, resultsEl, actionsRow, message) {
    btn.disabled = true;
    btn._origHTML = btn.innerHTML;
    btn.innerHTML = `<span class="ytai-spinner"></span> ${message}`;
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = `<div class="ytai-pulse" style="color:var(--ytai-text-dim);">
      ${message}<br><br>
      <span style="font-size:11px;">⏳ This takes 30–90 s. Auto-retries on rate limits.</span>
    </div>`;
    actionsRow.style.display = 'none';
  }

  function showResult(btn, resultsEl, actionsRow, prefix, result, panel) {
    rawResults[prefix] = result;
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = md2html(result);
    actionsRow.style.display = 'flex';
    btn.disabled = false;
    btn.innerHTML = btn._origHTML;

    // Show translate section if Sarvam key is configured
    if (panel?._hasSarvam) {
      const translateSection = panel.querySelector(`#ytai-${prefix}-translate`);
      if (translateSection) translateSection.style.display = 'block';
    }
  }

  function showError(btn, resultsEl, error) {
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = `<p style="color:var(--ytai-error);">❌ ${escapeHtml(error)}</p>`;
    btn.disabled = false;
    btn.innerHTML = btn._origHTML;
  }

  // ── Run: Fact Check (single or multi-AI) ─────────────────────────
  async function runFactCheck(panel) {
    const btn = panel.querySelector('#ytai-fc-btn');
    const resultsEl = panel.querySelector('#ytai-fc-results');
    const actionsRow = panel.querySelector('#ytai-fc-actions');
    const aiTabsRow = panel.querySelector('#ytai-fc-ai-tabs');
    const instructions = panel.querySelector('#ytai-fc-instructions').value.trim();
    const { customInstructions } = await chrome.storage.local.get('customInstructions');
    const combined = [customInstructions, instructions].filter(Boolean).join('\n');

    const useOpenAI = !!(panel.querySelector('#ytai-use-openai')?.checked &&
      panel.querySelector('#ytai-openai-check-wrap')?.style.display !== 'none');
    const useClaude = !!(panel.querySelector('#ytai-use-claude')?.checked &&
      panel.querySelector('#ytai-claude-check-wrap')?.style.display !== 'none');

    // Reset state
    fcMultiResults = {};
    fcActiveAI = 'gemini';
    aiTabsRow.style.display = 'none';
    panel.querySelectorAll('.ytai-ai-result-tab').forEach(t => t.classList.remove('active'));
    panel.querySelector('.ytai-ai-result-tab[data-ai="gemini"]')?.classList.add('active');
    panel.querySelector('#ytai-fc-openai-tab').style.display = 'none';
    panel.querySelector('#ytai-fc-claude-tab').style.display = 'none';

    const loadMsg = useOpenAI || useClaude
      ? '🔍 Fact-checking with multiple AIs...'
      : '🔍 Gemini is fact-checking the video...';
    showLoading(btn, resultsEl, actionsRow, loadMsg);

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'factCheckMulti',
        videoUrl, videoTitle,
        customInstructions: combined,
        useOpenAI, useClaude,
      });

      if (!response.success) {
        showError(btn, resultsEl, response.error);
        return;
      }

      fcMultiResults = response.results;

      // Show AI sub-tabs if multiple results
      const hasOpenAIResult = !!fcMultiResults.openai;
      const hasClaudeResult = !!fcMultiResults.claude;
      if (hasOpenAIResult || hasClaudeResult) {
        aiTabsRow.style.display = 'flex';
        if (hasOpenAIResult) panel.querySelector('#ytai-fc-openai-tab').style.display = '';
        if (hasClaudeResult) panel.querySelector('#ytai-fc-claude-tab').style.display = '';
      }

      const geminiData = fcMultiResults.gemini;
      if (geminiData?.error) {
        showError(btn, resultsEl, geminiData.error);
      } else if (geminiData?.result) {
        showResult(btn, resultsEl, actionsRow, 'fc', geminiData.result, panel);
      } else {
        showError(btn, resultsEl, 'No result returned from Gemini.');
      }
    } catch (e) {
      showError(btn, resultsEl, e.message);
    }
  }

  // ── Run: Notes ────────────────────────────────────────────────────
  async function runNotes(panel) {
    const btn = panel.querySelector('#ytai-notes-btn');
    const resultsEl = panel.querySelector('#ytai-notes-results');
    const actionsRow = panel.querySelector('#ytai-notes-actions');
    const instructions = panel.querySelector('#ytai-notes-instructions').value.trim();
    const { customInstructions } = await chrome.storage.local.get('customInstructions');
    const combined = [customInstructions, instructions].filter(Boolean).join('\n');
    const noteStyle = panel.querySelector('.ytai-note-style-btn.active')?.dataset.style || 'study';

    showLoading(btn, resultsEl, actionsRow, '📓 Gemini is generating notes...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'notes', videoUrl, videoTitle,
        customInstructions: combined, noteStyle,
      });
      if (response.success) showResult(btn, resultsEl, actionsRow, 'notes', response.result, panel);
      else showError(btn, resultsEl, response.error);
    } catch (e) {
      showError(btn, resultsEl, e.message);
    }
  }

  // ── Run: Summarize ────────────────────────────────────────────────
  async function runSummarize(panel) {
    const btn = panel.querySelector('#ytai-sum-btn');
    const resultsEl = panel.querySelector('#ytai-sum-results');
    const actionsRow = panel.querySelector('#ytai-sum-actions');
    const instructions = panel.querySelector('#ytai-sum-instructions').value.trim();
    const { customInstructions } = await chrome.storage.local.get('customInstructions');

    const sections = [];
    panel.querySelectorAll('.ytai-section-tag.selected').forEach(t => sections.push(t.dataset.section));
    if (sections.length === 0) {
      resultsEl.classList.remove('hidden');
      resultsEl.innerHTML = '<p style="color:var(--ytai-warning);">⚠️ Select at least one section.</p>';
      return;
    }

    const combined = [customInstructions, instructions].filter(Boolean).join('\n');
    showLoading(btn, resultsEl, actionsRow, '📝 Gemini is analyzing the video...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'summarize', videoUrl, videoTitle,
        customInstructions: combined, sections,
      });
      if (response.success) showResult(btn, resultsEl, actionsRow, 'sum', response.result, panel);
      else showError(btn, resultsEl, response.error);
    } catch (e) {
      showError(btn, resultsEl, e.message);
    }
  }

  // ── Run: Custom ───────────────────────────────────────────────────
  async function runCustom(panel) {
    const btn = panel.querySelector('#ytai-custom-btn');
    const resultsEl = panel.querySelector('#ytai-custom-results');
    const actionsRow = panel.querySelector('#ytai-custom-actions');
    const prompt = panel.querySelector('#ytai-custom-prompt').value.trim();

    if (!prompt) {
      resultsEl.classList.remove('hidden');
      resultsEl.innerHTML = '<p style="color:var(--ytai-warning);">⚠️ Enter a prompt first.</p>';
      return;
    }

    showLoading(btn, resultsEl, actionsRow, '⚡ Running your custom prompt...');

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'customPrompt', videoUrl, videoTitle, prompt,
      });
      if (response.success) showResult(btn, resultsEl, actionsRow, 'custom', response.result, panel);
      else showError(btn, resultsEl, response.error);
    } catch (e) {
      showError(btn, resultsEl, e.message);
    }
  }

  // ── Run: Translate (Sarvam AI) ────────────────────────────────────
  async function runTranslate(panel, prefix) {
    const btn = panel.querySelector(`#ytai-${prefix}-translate-btn`);
    const lang = panel.querySelector(`#ytai-${prefix}-lang`).value;
    const translatedEl = panel.querySelector(`#ytai-${prefix}-translated`);

    const rawText = rawResults[prefix];
    if (!rawText) return;

    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳';
    translatedEl.style.display = 'block';
    translatedEl.innerHTML = '<span class="ytai-pulse" style="font-size:12px;color:var(--ytai-text-dim);">Translating with Sarvam AI...</span>';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'translate',
        text: stripMarkdown(rawText),
        targetLang: lang,
      });

      if (response.success) {
        translatedEl.innerHTML = `<div class="ytai-translated-text">${escapeHtml(response.result).replace(/\n/g, '<br>')}</div>`;
      } else {
        translatedEl.innerHTML = `<p style="color:var(--ytai-error);font-size:12px;">❌ ${escapeHtml(response.error)}</p>`;
      }
    } catch (e) {
      translatedEl.innerHTML = `<p style="color:var(--ytai-error);font-size:12px;">❌ ${escapeHtml(e.message)}</p>`;
    }

    btn.disabled = false;
    btn.textContent = origLabel;
  }

  // ── Load Templates & Default Sections ────────────────────────────
  async function loadTemplates(panel) {
    const { customPromptTemplates } = await chrome.storage.local.get('customPromptTemplates');
    const container = panel.querySelector('#ytai-templates');
    container.innerHTML = '';

    const templates = customPromptTemplates
      ? customPromptTemplates.split('\n').filter(l => l.includes('|')).map(line => {
          const [name, ...rest] = line.split('|');
          return [name.trim(), rest.join('|').trim()];
        }).filter(([n, p]) => n && p)
      : [
          ['📚 Study Notes', 'Create detailed study notes with key definitions, concepts, and examples.'],
          ['❓ Quiz', 'Create a quiz with 10 MCQs based on this video. Include answers.'],
          ['🐦 Tweet Thread', 'Convert the key points into a Twitter/X thread (10-15 tweets).'],
          ['📧 Email Summary', 'Write a professional email summarizing this video for my team.'],
        ];

    templates.forEach(([name, prompt]) => {
      const btn = document.createElement('button');
      btn.className = 'ytai-template-btn';
      btn.textContent = name;
      btn.addEventListener('click', () => panel.querySelector('#ytai-custom-prompt').value = prompt);
      container.appendChild(btn);
    });
  }

  async function loadDefaultSections(panel) {
    const { defaultSections } = await chrome.storage.local.get('defaultSections');
    if (defaultSections) {
      panel.querySelectorAll('.ytai-section-tag').forEach(tag => {
        tag.classList.toggle('selected', defaultSections.includes(tag.dataset.section));
      });
    }
  }

  // ── SPA Navigation Watch ──────────────────────────────────────────
  function watchNavigation() {
    let lastVid = getVideoId();
    const check = () => {
      const vid = getVideoId();
      if (vid && vid !== lastVid) {
        lastVid = vid;
        currentVideoId = vid;
        panelInjected = false;
        initAttempts = 0;
        rawResults = { fc: '', notes: '', sum: '', custom: '' };
        fcMultiResults = {};
        const old = document.getElementById('ytai-panel');
        if (old) old.remove();
        setTimeout(injectPanel, 2000);
      }
    };
    window.addEventListener('yt-navigate-finish', () => setTimeout(check, 500));
    setInterval(check, 2000);
    let lastHref = location.href;
    new MutationObserver(() => {
      if (location.href !== lastHref) { lastHref = location.href; check(); }
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Init ──────────────────────────────────────────────────────────
  function init() {
    const vid = getVideoId();
    if (!vid) { watchNavigation(); return; }
    currentVideoId = vid;
    initAttempts = 0;
    setTimeout(injectPanel, 2000);
    watchNavigation();
  }

  console.log('[IPipe] v2.1 Loaded');
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : setTimeout(init, 800);
})();
