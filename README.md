# NetSTAR Shield

**Real-time website security insights in your browser.**

This folder contains the full NetSTAR Shield stack: Chrome extension, Node server, and Python scoring engine.

📖 **Full documentation:** [README at repository root](../README.md)

---

## What’s in this folder

| Folder | Description |
|--------|-------------|
| **Extension** | Chrome extension (React, Vite, Manifest V3). Popup UI, background worker, content script. |
| **Server** | Express API. `/scan` endpoint, URL sanitization, spawns scoring engine, adds flavor text. |
| **Scoring Engine** | Python. Fetches NetSTAR/RDAP data and computes security scores. |
| **Docs** | Architecture and policies (e.g. extension–server flow, URL sanitization). |
| **Old Code** | Legacy / deprecated code. |

---

## Quick start (from this folder)

1. **Extension**
   ```bash
   cd Extension && npm install && npm run build
   ```
   Load `Extension/dist` in Chrome via **Load unpacked** at `chrome://extensions/`.

2. **Server**
   ```bash
   cd Server && npm install && node server.js
   ```
   Listens on `http://localhost:3000`.

3. **Scoring Engine** (required for scans)
   ```bash
   cd "Scoring Engine" && pip install -r requirements.txt
   ```
   The server runs `scoring_main.py` automatically on each `/scan` request.

4. Point the extension at your server: set `SCAN_API_BASE` in `Extension/src/background/constants.js` to `http://localhost:3000` for local dev.

---

## Documentation

For a full documentation index, see the [root README](../README.md#documentation) or [Docs/README.md](Docs/README.md).

- [Root README](../README.md) — features, architecture, full quick start, project structure, development, config.
- [Docs/](Docs/) — architecture, policies, testing guide, deployment guide.
- [Extension README](Extension/README.md) — extension features and dev workflow. See also [Extension/docs/](Extension/docs/).
- [Server readme](Server/readme.md) — URL sanitization and tests.
- [Scoring Engine readme](Scoring%20Engine/readme.md) — scoring engine usage and status.
- [Tests-Summary.md](Tests-Summary.md) — stakeholder-facing test coverage summary.
