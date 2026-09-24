const fileInput = document.getElementById('file');
const dropZone = document.getElementById('dropZone');
const dropText = document.getElementById('dropText');
const preview = document.getElementById('preview');
const scanBtn = document.getElementById('scanBtn');
const statusEl = document.getElementById('status');
const results = document.getElementById('results');
const ocrText = document.getElementById('ocrText');
const matchesEl = document.getElementById('matches');
const manualInput = document.getElementById('manualInput');
const manualResults = document.getElementById('manualResults');
const copyOcr = document.getElementById('copyOcr');

let currentFile = null;

// File handling
function setFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  currentFile = file;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  dropText.hidden = true;
  scanBtn.disabled = false;
  setStatus(`📎 ${file.name}`, '');
}

function setStatus(text, type = '') {
  statusEl.innerHTML = text;
  statusEl.className = 'status ' + type;
}

fileInput.addEventListener('change', e => setFile(e.target.files[0]));

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  setFile(e.dataTransfer.files[0]);
});

document.addEventListener('paste', e => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (item) setFile(item.getAsFile());
});

// Scan
scanBtn.addEventListener('click', async () => {
  if (!currentFile) return;
  scanBtn.disabled = true;
  setStatus('<span class="spinner"></span>Running QVAC OCR on-device…', 'loading');
  results.hidden = true;

  const fd = new FormData();
  fd.append('image', currentFile);

  try {
    const res = await fetch('/api/scan', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    ocrText.textContent = data.ocrText || '(no text detected)';
    renderMatches(data.matches, matchesEl);
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setStatus(`✅ Found ${data.matches.length} match(es)`, 'success');
  } catch (err) {
    setStatus('❌ ' + err.message, 'error');
  } finally {
    scanBtn.disabled = false;
  }
});

// Copy OCR text
copyOcr.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ocrText.textContent);
    copyOcr.textContent = 'Copied!';
    setTimeout(() => copyOcr.textContent = 'Copy', 1500);
  } catch {}
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function renderMatches(matches, target) {
  target.innerHTML = '';
  if (!matches || !matches.length) {
    target.innerHTML = `
      <div class="no-match">
        <strong>No match found</strong>
        Try a clearer image, crop just the chip label, or use manual search below.
      </div>`;
    return;
  }

  for (const m of matches) {
    const div = document.createElement('div');
    div.className = 'match';
    const pct = (m.confidence * 100).toFixed(0);
    div.innerHTML = `
      <div class="match-header">
        <div>
          <div class="match-part">${escapeHtml(m.part)}</div>
          ${m.type ? `<div class="match-type">${escapeHtml(m.type)}</div>` : ''}
        </div>
        <div class="confidence">${pct}% match</div>
      </div>
      ${m.specs ? `<div class="specs">${escapeHtml(m.specs)}</div>` : ''}
      ${m.description ? `<div class="description">${escapeHtml(m.description)}</div>` : ''}
      <div class="alt-label">Local Alternatives</div>
      <div class="alt-list">
        ${(m.alternatives || []).map(a => `
          <div class="alt">
            <div class="alt-info">
              <div class="alt-top">
                <span class="alt-name">${escapeHtml(a.name)}</span>
                <span class="alt-source">${escapeHtml(a.source || 'local')}</span>
              </div>
              <div class="alt-brand">${escapeHtml(a.brand || '')}</div>
              ${a.note ? `<div class="alt-note">${escapeHtml(a.note)}</div>` : ''}
            </div>
            <div class="alt-price">${escapeHtml(a.price || '')}</div>
          </div>
        `).join('')}
      </div>
    `;
    target.appendChild(div);
  }
}

// Manual search (debounced)
let debounce;
manualInput.addEventListener('input', e => {
  clearTimeout(debounce);
  const q = e.target.value.trim();
  if (!q) { manualResults.innerHTML = ''; return; }
  debounce = setTimeout(async () => {
    const res = await fetch('/api/search?q=' + encodeURIComponent(q));
    const data = await res.json();
    renderMatches(data, manualResults);
  }, 250);
});