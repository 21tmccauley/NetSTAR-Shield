# NetSTAR Shield Server

Express API that serves the `/scan` endpoint for the NetSTAR Shield browser extension. It normalizes and validates scan targets, then invokes the Python scoring engine to produce security scores.

> **Shared policy:** The normalization and validation rules below follow the project-wide [URL Sanitization & Normalization Policy](../Docs/url-sanitization-policy.md), which is the single source of truth for how scan targets are handled across the Extension, Server, and Scoring Engine.

---

## URL Sanitization & Normalization

Scan targets (domains or URLs) are sanitized and validated before being passed to the scoring engine. The logic lives in [`lib/urlSanitize.js`](lib/urlSanitize.js), which exports `normalizeScanTarget`.

### Normalization Steps

1. Coerce to string and trim whitespace
2. If the input contains `://`, parse as a URL and extract the hostname; otherwise treat as a bare hostname
3. Lowercase the hostname
4. Strip a leading `www.`
5. Strip trailing dots

### Validation (Blocked Inputs)

Invalid inputs cause the server to return **400 Bad Request** with a JSON body containing `error: true` and a descriptive `message`. Blocked inputs include:

- Empty or whitespace-only
- Malformed URLs (e.g. `https://` with no host)
- `localhost` and loopback addresses (`127.0.0.1`, `::1`, `0.0.0.0`)
- Plain IP addresses (IPv4 or IPv6)
- Inputs without a letter-based TLD (e.g. `.com`, `.org`)

See [`Docs/url-sanitization-policy.md`](../Docs/url-sanitization-policy.md) for the full policy shared with the extension.

---

## Unit Tests

Tests use **Jest** and **supertest**. Run them with:

```bash
npm test
```

### Test Structure

| File | Purpose |
|------|---------|
| [`__tests__/urlSanitize.test.js`](__tests__/urlSanitize.test.js) | Unit tests for `normalizeScanTarget` |
| [`__tests__/scan.test.js`](__tests__/scan.test.js) | Integration tests for `GET /scan` |

### How `urlSanitize.test.js` Works

Tests the `normalizeScanTarget` function in isolation:

- **Valid inputs** — Asserts that full URLs, bare domains, and whitespace/`www.`/trailing-dot variants normalize to the expected hostname (e.g. `https://www.Example.COM/path` → `example.com`).
- **Blocked inputs** — Asserts that empty, localhost, plain IPs, and inputs without a TLD return `{ ok: false, reason: "..." }` instead of a domain.

No mocks are used; it exercises the normalization and validation logic directly.

### How `scan.test.js` Works

Uses **supertest** to send real HTTP requests to the Express app. The Python scoring engine is **never executed** because:

- `child_process.spawn` is mocked to return a fake child process that emits predefined stdout/stderr and an exit code.
- `fs.existsSync` is mocked so `resolvePythonScript()` always finds `scoring_main.py`, allowing the handler to run.

The mock child process uses `setImmediate` to schedule events (spawn, data, close) *after* the handler attaches listeners, so the success path (200) and failure paths (500) work as expected.

Tests cover:

- **400 responses** — Blocked inputs (localhost, plain IPs, no TLD, etc.) return the expected error payload.
- **200 responses** — Valid domains return a JSON body with `safetyScore`, `aggregatedScore`, and `indicators` when the mock emits valid scoring JSON.
- **500 responses** — Non-zero exit code or invalid JSON from the mock triggers the appropriate error response.

### App Export for Testing

The server only calls `app.listen()` when run directly (`require.main === module`). When the test suite `require`s `server.js`, it receives the Express `app` via `module.exports = { app }` without starting a listener, so tests can use supertest against the app in-process.

---

## Performance logging and trace ID

To correlate scan latency across the extension, server, and scoring engine, the server supports an optional **trace ID** that flows end-to-end.

### Propagation

- **Extension → Server:** The extension sends `X-Scan-Trace-Id` on each `/scan` request (manual and auto scans). If omitted, the server generates a fallback ID (e.g. `scan-srv-<timestamp>-<random>`).
- **Server → Scoring Engine:** The server passes the same ID to the Python script as `--trace-id <id>` (or `-i <id>`). Both `scoring_main.py` and `score_engine.py` accept this flag.

### Server log shape

For each `/scan` request the server logs:

- **Success:** A `[scan][score-response]` JSON line that includes:
  - `scanTraceId` — the trace ID for this request
  - `timing` — breakdown of where time was spent:
    - `totalMs` — total request duration
    - `pythonMs` — scoring engine process duration
    - `normalizeMs` — URL normalization/validation
    - `parseMs` — parsing Python stdout JSON
    - `formatMs` — building the extension payload
    - `scoringEngineDetails` — per-stage timing from the scoring engine stderr (when present): array of `{ stage, endpoint?, elapsedSeconds }` (e.g. `stage=data_fetch endpoint=cert`, `stage=total`)
- **Errors:** A `[scan][error]` JSON line with `scanTraceId`, `errorType`, and any available timings (`totalMs`, `pythonMs`, etc.). The HTTP response body is unchanged.

### Example

```json
{"scanTraceId":"scan-1710123456789-abc123","timing":{"totalMs":4523,"pythonMs":4400,"normalizeMs":0,"parseMs":2,"formatMs":1,"scoringEngineDetails":[{"stage":"data_fetch","endpoint":"cert","elapsedSeconds":0.18},{"stage":"data_fetch","endpoint":"dns","elapsedSeconds":0.19},{"stage":"total","elapsedSeconds":4.4}]}, ...}
```

Use `scanTraceId` to match server logs with extension `[NetSTAR][timing]` logs and Python stderr `[scan][timing]` lines.

### Manual verification

1. Start the server and load the extension on the performance branch.
2. Open DevTools for the extension (e.g. Service Worker / background page) and watch for `[NetSTAR][timing]` logs (manualScan, scanUrl, getCachedOrScan, performSecurityScan).
3. Run a manual scan from the popup; in the server terminal you should see `[scan][score-response]` with the same `scanTraceId` as in the extension logs.
4. Optionally run the scoring engine directly: `python "Scoring Engine/scoring_main.py" -t example.com -i my-trace-123 -v` and confirm stderr shows `[scan][timing] traceId=my-trace-123 ...`.
