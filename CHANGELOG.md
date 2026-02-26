# Changelog

All notable changes to the NetSTAR-Shield project are documented in this file.

---

## Phase 6b — Expanded Webpage Inspect Payload Signals

- **Go Worker** (`webpage_inspect.go`): Added `InspectSignals` fields: `crypto_mining`, `clipboard_hijack`, `fingerprint_score`, `keylogger_detected`, `external_scripts`, `external_script_domains`, `suspicious_anchors`, `meta_refresh`, `meta_refresh_url`, `favicon_external`.
- **Go Worker** (`routes.go`): Added regex patterns for crypto miners (`CoinHive`, `cryptonight`, etc.), clipboard hijacking (`execCommand copy`, `navigator.clipboard.write`), browser fingerprinting (`canvas.toDataURL`, `navigator.plugins`, `AudioContext`, `WebGLRenderingContext`, `navigator.hardwareConcurrency`), and keyloggers (`addEventListener keydown/press/up`). Extended `analyzeScriptContent()` with all new detections including weighted fingerprint scoring.
- **Go Worker** (`routes.go`): Extended HTML tokenizer — `atom.Script` now tracks external script domains; `atom.Meta` detects `http-equiv="refresh"` with external URL extraction; `atom.Link` detects favicon domain mismatches; `atom.A` now buffers display text and compares domain-like text against href for suspicious anchor detection.
- **Scoring Engine** (`scoring_logic.py`): Extended `score_content_safety()` with deductions for crypto mining (-30), clipboard hijacking (-15), fingerprinting >40 (-15), keylogger (-25), excessive external scripts (-5/-15), suspicious anchors (-20), meta refresh to external domain (-15), external favicon (-5).

---

## Phase 6 — Rename, Dual-Mode Logic, Fake-Parked Detection

### Change 1: Rename `inspect` to `webpage_inspect`

- **Go Worker**: Moved `worker/app/inspect/` to `worker/app/webpage_inspect/`, updated package name.
- **Go Worker**: Renamed `worker/client/job/inspect.go` to `webpage_inspect.go` (struct names unchanged).
- **Go Worker**: Updated `worker/app/main.go` — import path, route paths (`/webpage-inspect/`), constructor.
- **Scoring Engine**: Added `webpage-inspect` to `API_ENDPOINTS` in `config.py`.
- **Scoring Engine**: Added `'webpage-inspect': 'webpage_inspect_scan'` override in `data_fetch.py`.
- **Scoring Engine**: Updated all `inspect_scan` references to `webpage_inspect_scan` in `scoring_logic.py`.

### Change 2: Live Mode Signal Forwarding + Skip Pre-flight

- **Extension** (`scan.js`): Reads cached live DOM signals from `chrome.storage.local` (keyed by `SIGNALS_CACHE_PREFIX + domain`) and appends them as `&signals=<JSON>` to the scan request URL when fresh.
- **Scoring Engine** (`scoring_main.py`): Added `is_live_mode` guard — when signals have `mode: "live"`, dead/parked pre-flight checks are skipped entirely since the user is actively on the page.

### Change 3: Fake-Parked Page Detection

- **Scoring Engine** (`scoring_logic.py`): Added `_has_suspicious_redirects()` helper that recursively walks the redirect tree looking for `js`, `meta`, or `refresh` signal types.
- **Scoring Engine** (`scoring_logic.py`): Rewrote `check_preflight()` to accept optional `redirect_data` parameter. Dead sites always short-circuit. Parked sites with suspicious redirects bypass the short-circuit and go through full scoring. Clean parked sites still short-circuit to score=1.
- **Scoring Engine** (`scoring_logic.py`): Added fake-parked penalty in `calculate_security_score()` — if parked + suspicious redirects: Domain_Reputation -30, Connection_Security -15, Content_Safety -25.
- **Scoring Engine** (`scoring_logic.py`): Rewrote `score_dom_rep_redirect()` to walk the actual redirect tree structure (with `RedirectNode.Signals[].Type`) instead of using flat keys (`js_redirect`, `meta_refresh`, `window_open`).
- **Scoring Engine** (`scoring_main.py`): Updated `check_preflight()` call to pass `redirect_scan` data.

---

## Phase 5 — Content Safety Scoring (Page Inspection)

- **Go Worker**: Added `/inspect/` endpoint (`worker/app/inspect/`) — fetches target page, tokenizes HTML, and extracts content signals (unicode anomalies, form analysis, script analysis, hidden content, link analysis).
- **Go Worker**: Added `job.Inspect` and `job.InspectSignals` structs in `worker/client/job/inspect.go`.
- **Scoring Engine**: Added `score_content_safety()` in `scoring_logic.py` — scores based on invisible chars, RTL overrides, homoglyphs, external form actions, eval/document.write calls, base64 blobs, obfuscation score, hidden iframes, zero-size elements, mismatched/data-URI links.
- **Scoring Engine**: Integrated Content_Safety (weight 18) into `calculate_security_score()`.

## Phase 4 — Live Signal Integration

- **Extension**: Added `content-inspect.js` content script for live DOM signal extraction.
- **Extension** (`messages.js`): Added `pageSignals` listener to cache live signals in `chrome.storage.local`.
- **Extension** (`constants.js`): Added `SIGNALS_CACHE_PREFIX`.
- **Server** (`server.js`): Added `--signals` parameter passthrough to Python scoring engine.
- **Scoring Engine** (`scoring_main.py`): Added `--signals` CLI argument for receiving live signal JSON.

## Phase 3 — Notification System

- **Extension**: Added `notifications.js` — native Chrome notifications for scores below `ALERT_THRESHOLD` (60) and in-page alerts for scores below `SAFE` threshold (75).
- **Extension**: Soft-toggle for notifications stored in `chrome.storage.local`.

## Phase 2 — Extension UI and Background Architecture

- **Extension**: Built Chrome Extension with Manifest V3, React 19, Tailwind CSS 4, Vite + @crxjs.
- **Extension**: Background service worker modules — `scan.js`, `messages.js`, `icon.js`, `tabs.js`, `constants.js`, `urlNormalize.js`, `recentScans.js`, `install.js`.
- **Extension**: Popup UI with Home/Scan/Alerts/Details/Settings tabs.
- **Extension**: Scan result caching (5-minute TTL) in `chrome.storage.local`.
- **Extension**: Icon state management (safe/warning/danger) based on score thresholds.

## Phase 1 — Scoring Engine and Server

### Phase 1a — Core Scoring + Pre-flight
- **Scoring Engine**: `scoring_main.py` orchestrator with CLI arguments (`-t`, `-v`, `--use-test-data`).
- **Scoring Engine**: `scoring_logic.py` — `check_preflight()` (dead/parked short-circuit), `score_cert_health()`, `score_dns_rec_health()`, `score_conn_sec()`, `score_dom_rep()`, `score_cred_safety()`, `score_whois_pattern()`, `calculate_final_score()` (weighted harmonic mean).
- **Scoring Engine**: `config.py` — weights, API endpoints, method/security flag bitmasks, malicious TLDs.
- **Scoring Engine**: `data_fetch.py` — concurrent cURL-based API fetching with ThreadPoolExecutor.

### Phase 1b — DKIM Scoring
- **Scoring Engine**: Added DKIM record analysis in `score_dom_rep()`.

### Phase 1c — Redirect Chain Analysis (HVAL)
- **Scoring Engine**: Full redirect chain analysis in `score_conn_sec()` — HTTP intermediate hops, excessive redirects, domain mismatch detection.

### Phase 1d — IP Reputation
- **Scoring Engine**: Added `score_ip_rep()` — firewall blocklist, high-risk country detection, bulletproof ASN detection, reverse DNS checks.
- **Config**: Added `HIGH_RISK_COUNTRIES` and `BULLETPROOF_ASNS` lists.

### Phase 1e — CT Log Scoring
- **Scoring Engine**: Added `score_cert_health_ct()` — checks certificate issuance history from crt.sh, penalises brand-new certs and unusual CAs.
- **Config**: Added `COMMON_CAS` list.

### Phase 1f — CRLite Revocation
- **Go Worker**: Integrated CRLite filter for certificate revocation checking.
- **Scoring Engine**: Added CRLite/OCSP revocation penalties in `score_cert_health()`.

### Phase 1g — Redirect Tree Analysis
- **Go Worker**: Added `/redirect/` endpoint with tree-based redirect traversal (BFS with depth/node/fanout caps).
- **Go Worker**: `job.Redirect`, `job.RedirectNode`, `job.RedirectSignal` structs — signal types: `seed`, `http`, `refresh`, `meta`, `js`.
- **Scoring Engine**: Added `score_dom_rep_redirect()` for redirect-based domain reputation scoring.

### Server
- **Server** (`server.js`): Express 5 API with `/scan` endpoint, Python process spawning with cross-platform fallback, response formatting for extension consumption.
- **Server** (`lib/urlSanitize.js`): URL normalization and validation (blocks localhost, plain IPs, non-letter TLDs).
