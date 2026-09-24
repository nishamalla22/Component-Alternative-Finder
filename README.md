# OCR + QVAC — Component Alternative Finder

Snap a photo of an electronic component. QVAC's on-device AI extracts the part number, then the app suggests locally available alternatives with specs, brands, and prices.

**No cloud. No API keys. 100% on-device inference.**

## What It Does

1. **Upload** an image of an electronic component (IC, MOSFET, transistor, etc.)
2. **OCR** runs entirely on your machine using QVAC's multimodal model
3. **Fuzzy match** extracted text against a local component database
4. **Get alternatives** with brand names, specs, and local pricing

## QVAC Functions Used

- `loadModel()` — loads the `OCR_0_6B_MULTIMODAL_Q4_K_M` model with `MMPROJ_OCR_0_6B_MULTIMODAL_F16` projection
- `completion()` — runs streaming inference to extract text from the uploaded image
- `unloadModel()` — cleanly releases the model on shutdown

All inference runs **on-device**. No image or text ever leaves your machine.

## SDK Version

- `@qvac/sdk@0.20.0`
- `@qvac/inference@0.20.0`
- Node.js v22.17.0 (LTS)

## Requirements

- **Node.js v22.17.0 or higher** (Node.js 24 has a compatibility issue with `@qvac/rag`)
- **8 GB RAM** minimum (models require ~1.5 GB when loaded)
- **~1.2 GB free disk space** for model cache (one-time download)
- No GPU required — runs on CPU

## Install

```bash
git clone https://github.com/YOUR_USERNAME/ocr-qvac.git
cd ocr-qvac
npm install
```

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

**First run:** The QVAC SDK will download the OCR model (~1.2 GB) to `~/.qvac/models`. This is a one-time download. After that, the app works fully offline.

## Usage

1. Click the drop zone or drag an image of a component
2. Click **Scan & Find Alternatives**
3. View OCR output and matched alternatives
4. Or use the manual search at the bottom to look up components by name

## Project Structure

```
ocr-qvac/
├── server.js              # Express server + QVAC OCR integration
├── data/
│   └── components.json    # Local component database
├── public/
│   ├── index.html         # UI markup
│   ├── style.css          # Glassmorphism dark theme
│   └── app.js             # Frontend logic
├── package.json
├── LICENSE
└── README.md
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/scan` | Upload image, run OCR, return matches |
| `GET` | `/api/search?q=` | Manual fuzzy search |
| `GET` | `/api/components` | Full component catalog |

## How It Works

```
User uploads image
      ↓
QVAC loadModel() — multimodal OCR model loads into RAM
      ↓
QVAC completion() — model reads the chip label and extracts text
      ↓
Token extraction — regex filters candidate part numbers (e.g., IRFZ44)
      ↓
Fuse.js fuzzy match against components.json
      ↓
Return top matches with alternatives
```

## Extending the Database

Edit `data/components.json`. Each entry follows this schema:

```json
{
  "part": "IRFZ44",
  "type": "N-Channel Power MOSFET",
  "specs": "TO-220, 55V, 49A, 0.028Ω RDS(on)",
  "description": "Short description of what it does.",
  "alternatives": [
    {
      "name": "IRFZ44N",
      "brand": "Infineon",
      "source": "local",
      "price": "₹40",
      "note": "Why this alternative works"
    }
  ]
}
```

## Notes

- The `@qvac/rag` transitive dependency ships with an invalid `"imports"` field that breaks Node.js ESM. This project avoids it by using `@qvac/sdk`'s high-level API only.
- If you upgrade to Node.js 24, you may hit `ERR_INVALID_PACKAGE_TARGET`. Stay on Node.js 22 LTS.

## License

MIT — see [LICENSE](LICENSE).

## Why I Built This

In Nepal and similar markets, hobbyists and repair technicians often can't find the exact replacement part they need. This tool turns a 15-minute manual cross-reference task into a 5-second scan — entirely offline.