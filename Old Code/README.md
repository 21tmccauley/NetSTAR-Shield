
# NetStarShield — React JS (no TypeScript)

Converted from the original project to React (JSX) — no TypeScript. No files from the original `dist/` are used (you may use it to confirm behavior).

## Build & load
1. `npm install`
2. `npm run build`
3. Go to `chrome://extensions` → **Load unpacked** → select the `dist` folder.

## Files
- `public/manifest.json` — MV3 manifest, points popup to `src/popup/index.html`, and uses `src/background.js` + `src/content.js` directly.
- `src/background.js` — service worker (module). Keeps parity with your original background entry.
- `src/content.js` — content script placeholder (for SERP annotations/badges).
- `src/api.js` — `getSettings`, `saveSettings`, and `scanUrl` stub returning `{ overall, metrics, verdict }`.
- `src/popup/index.html` — popup HTML shell (loads React bundle).
- `src/popup/main.jsx` — React root.
- `src/popup/App.jsx` — the popup UI and logic (tabs, card, analysis, settings, scan button).
- `src/popup/styles.css` — Tailwind-free CSS matching your original look (tabs, yellow card, circular meter, progress bars, toggle).

## How functionality maps
- React state replaces the original TSX component state: active tab, enabled toggle, and current scan result.
- `scanUrl(url)` shape matches what the popup expects (overall score + metrics + verdict), so you can replace the stub with your real API call without touching the UI.
- Settings persist in `chrome.storage.local` exactly as before (MV3-safe).
- The background script remains plain JS and can be expanded with alarms or message routing as needed.

