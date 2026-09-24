import express from 'express';
import multer from 'multer';
import Fuse from 'fuse.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadModel,
  completion,
  unloadModel,
  OCR_0_6B_MULTIMODAL_Q4_K_M,
  MMPROJ_OCR_0_6B_MULTIMODAL_F16
} from '@qvac/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ dest: 'uploads/' });

const components = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data/components.json'), 'utf-8')
);

const fuse = new Fuse(components, {
  keys: ['part', 'type', 'specs'],
  threshold: 0.4,
  includeScore: true
});

let modelId = null;

async function initQvac() {
  console.log('Loading QVAC multimodal OCR model...');
  modelId = await loadModel({
    modelSrc: OCR_0_6B_MULTIMODAL_Q4_K_M,
    modelType: 'llm',
    modelConfig: {
      projectionModelSrc: MMPROJ_OCR_0_6B_MULTIMODAL_F16,
      ctx_size: 4096
    }
  });
  console.log('✅ QVAC multimodal model loaded');
}

app.post('/api/scan', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const result = completion({
      modelId,
      history: [{
        role: 'user',
        content: 'Extract all text visible in this image. Output only the raw text, nothing else.',
        attachments: [{ path: req.file.path }]
      }],
      stream: true
    });

    // Collect streamed tokens into a single string
    let rawText = '';
    for await (const token of result.tokenStream) {
      rawText += token;
    }

    console.log('OCR raw text:', rawText);
    fs.unlinkSync(req.file.path);

    const tokens = rawText.toUpperCase()
      .replace(/[^A-Z0-9\-\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && /[A-Z]/.test(t) && /[0-9]/.test(t));

    const matches = [];
    for (const token of tokens) {
      const results = fuse.search(token).slice(0, 2);
      for (const r of results) {
        if (!matches.find(m => m.part === r.item.part)) {
          matches.push({
            ...r.item,
            confidence: parseFloat((1 - r.score).toFixed(2)),
            matchedOn: token
          });
        }
      }
    }

    res.json({ ocrText: rawText, candidates: tokens, matches });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json([]);
  const results = fuse.search(q).map(r => ({
    ...r.item,
    confidence: parseFloat((1 - r.score).toFixed(2))
  }));
  res.json(results);
});

app.get('/api/components', (_req, res) => res.json(components));
app.use(express.static('public'));

const PORT = 3000;
initQvac()
  .then(() => {
    app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize QVAC:', err);
    process.exit(1);
  });

process.on('SIGINT', async () => {
  if (modelId) await unloadModel({ modelId });
  process.exit(0);
});