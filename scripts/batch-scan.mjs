#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    input: null,
    outDir: null,
    baseUrl: "http://localhost:3000",
    concurrency: 6,
    timeoutMs: 60000,
    useUrlParam: false,
    includeTiming: true,
  };

  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") args.input = argv[++i];
    else if (a === "--out-dir") args.outDir = argv[++i];
    else if (a === "--base-url") args.baseUrl = argv[++i];
    else if (a === "--concurrency") args.concurrency = Number(argv[++i] || 0);
    else if (a === "--timeout-ms") args.timeoutMs = Number(argv[++i] || 0);
    else if (a === "--use-url-param") args.useUrlParam = true;
    else if (a === "--include-timing") args.includeTiming = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else rest.push(a);
  }

  if (!args.input && rest.length > 0) args.input = rest[0];
  return args;
}

function usage() {
  return `Batch scan a list of websites against your /scan endpoint.

Usage:
  node scripts/batch-scan.mjs --input scripts/websites.txt

Options:
  --input <path>         Newline-delimited list of domains/URLs
  --out-dir <dir>        Output directory (default: scripts/batch-scan-output-<timestamp>)
  --base-url <url>       Scan API base URL (default: http://localhost:3000)
  --concurrency <n>      Parallel requests (default: 6)
  --timeout-ms <ms>      Per-request timeout (default: 60000)
  --use-url-param        Use /scan?url=... instead of /scan?domain=...
  --include-timing      Request scoring-engine timing (per-scan engine duration + per-stage details) and store in results

Input format:
  - One site per line
  - Blank lines and lines starting with # are ignored
  - Examples:
      example.com
      https://www.example.com/path

Timing: With --include-timing, the scoring engine returns per-scan timing (totalMs, pythonMs,
  scoringEngineDetails with per-stage durations). Results store engineMs (per-scan) and
  requestWallClockMs (HTTP request elapsed). When running in parallel, use engineMs; request
  wall clock is not comparable across scans.
`;
}

function nowIsoCompact() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function scanTraceId(prefix = "batch") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function toCsv(rows) {
  // engineMs = per-scan duration from scoring engine (meaningful when parallel).
  // requestWallClockMs = HTTP request elapsed (not meaningful when parallel).
  const headers = [
    "input",
    "requestUrl",
    "scanTraceId",
    "ok",
    "httpStatus",
    "engineMs",
    "requestWallClockMs",
    "safetyScore",
    "aggregatedScore",
    "indicatorsCount",
    "errorMessage",
    "timing_totalMs",
    "timing_pythonMs",
    "timing_scoringEngineDetails",
  ];

  const escape = (v) => {
    const s = v == null ? "" : String(v);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

async function withConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let idx = 0;

  async function runOne() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }

  const pool = [];
  const c = Math.max(1, Number(concurrency) || 1);
  for (let i = 0; i < c; i++) pool.push(runOne());
  await Promise.all(pool);
  return results;
}

async function fetchJsonWithTimeout(url, { headers, timeoutMs }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, text, json };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    process.exit(0);
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const inputPath = path.resolve(process.cwd(), args.input || path.join(__dirname, "websites.txt"));
  if (!fs.existsSync(inputPath)) {
    process.stderr.write(`Input file not found: ${inputPath}\n\n${usage()}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const targets = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (targets.length === 0) {
    process.stderr.write(`No targets found in ${inputPath}\n`);
    process.exit(1);
  }

  const outDir =
    args.outDir != null
      ? path.resolve(process.cwd(), args.outDir)
      : path.resolve(process.cwd(), "scripts", `batch-scan-output-${nowIsoCompact()}`);

  fs.mkdirSync(outDir, { recursive: true });

  const base = String(args.baseUrl || "http://localhost:3000").replace(/\/+$/, "");
  const startedAt = Date.now();
  process.stdout.write(
    `Batch scan: ${targets.length} targets\n` +
      `- baseUrl: ${base}\n` +
      `- concurrency: ${args.concurrency}\n` +
      `- timeoutMs: ${args.timeoutMs}\n` +
      `- outDir: ${outDir}\n\n`
  );

  const results = await withConcurrency(targets, args.concurrency, async (input) => {
    const traceId = scanTraceId("batch");
    const queryDomain = args.useUrlParam
      ? `url=${encodeURIComponent(input)}`
      : `domain=${encodeURIComponent(input)}`;
    const requestUrl =
      `${base}/scan?${queryDomain}` +
      (args.includeTiming ? "&includeTiming=true" : "");

    const t0 = Date.now();
    try {
      const { res, text, json } = await fetchJsonWithTimeout(requestUrl, {
        headers: { "X-Scan-Trace-Id": traceId },
        timeoutMs: args.timeoutMs,
      });
      const elapsedMs = Date.now() - t0;

      const ok = res.ok && json && !json.error;
      const safetyScore = json && typeof json.safetyScore === "number" ? json.safetyScore : null;
      const aggregatedScore =
        json && typeof json.aggregatedScore === "number" ? json.aggregatedScore : null;
      const indicatorsCount = json && Array.isArray(json.indicators) ? json.indicators.length : 0;

      const errorMessage =
        json && json.error ? json.message : !res.ok ? `HTTP ${res.status}` : json ? null : "Non-JSON response";

      const timing = json && json.timing ? json.timing : null;
      const scoringEngineDetails = timing && Array.isArray(timing.scoringEngineDetails)
        ? timing.scoringEngineDetails
        : null;
      const timingTotalMs = timing && typeof timing.totalMs === "number" ? timing.totalMs : null;
      const timingPythonMs = timing && typeof timing.pythonMs === "number" ? timing.pythonMs : null;
      // Per-scan engine duration (meaningful when running in parallel). Prefer pythonMs.
      const engineMs = timingPythonMs ?? timingTotalMs ?? null;

      const row = {
        input,
        requestUrl,
        scanTraceId: traceId,
        ok,
        httpStatus: res.status,
        engineMs,
        requestWallClockMs: elapsedMs,
        safetyScore,
        aggregatedScore,
        indicatorsCount,
        errorMessage,
        timing_totalMs: timingTotalMs,
        timing_pythonMs: timingPythonMs,
        timing_scoringEngineDetails:
          scoringEngineDetails != null ? JSON.stringify(scoringEngineDetails) : null,
        timing,
      };

      // Save raw response for debugging (includes timing when requested).
      // engineMs = per-scan duration from scoring engine; elapsedMs = request wall clock (not meaningful when parallel).
      const safeName = input
        .replace(/^https?:\/\//i, "")
        .replace(/[^a-z0-9._-]+/gi, "_")
        .slice(0, 120);
      fs.writeFileSync(
        path.join(outDir, `${safeName}.${traceId}.response.json`),
        JSON.stringify(
          {
            input,
            requestUrl,
            scanTraceId: traceId,
            httpStatus: res.status,
            engineMs: engineMs ?? undefined,
            elapsedMs,
            json,
            timing: timing || undefined,
            rawText: json ? undefined : text,
          },
          null,
          2
        )
      );

      const timingNote = engineMs != null
        ? ` engine=${engineMs}ms`
        : scoringEngineDetails
          ? ` [${scoringEngineDetails.length} stages]`
          : "";
      process.stdout.write(
        `${ok ? "OK " : "ERR"} ${(engineMs ?? elapsedMs).toString().padStart(5)}ms ${input} trace=${traceId}${timingNote}\n`
      );
      return row;
    } catch (e) {
      const elapsedMs = Date.now() - t0;
      const row = {
        input,
        requestUrl,
        scanTraceId: traceId,
        ok: false,
        httpStatus: null,
        engineMs: null,
        requestWallClockMs: elapsedMs,
        safetyScore: null,
        aggregatedScore: null,
        indicatorsCount: 0,
        errorMessage: e?.name === "AbortError" ? `Timeout after ${args.timeoutMs}ms` : String(e?.message || e),
      };
      process.stdout.write(`ERR ${elapsedMs.toString().padStart(5)}ms ${input} trace=${traceId}\n`);
      return row;
    }
  });

  const finishedAt = Date.now();
  const okCount = results.filter((r) => r.ok).length;
  const errCount = results.length - okCount;
  const elapsedTotalMs = finishedAt - startedAt;

  const jsonPath = path.join(outDir, "results.json");
  const csvPath = path.join(outDir, "results.csv");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        meta: {
          startedAt,
          finishedAt,
          elapsedTotalMs,
          baseUrl: base,
          inputPath,
          concurrency: args.concurrency,
          timeoutMs: args.timeoutMs,
          okCount,
          errCount,
        },
        results,
      },
      null,
      2
    )
  );
  fs.writeFileSync(csvPath, toCsv(results));

  process.stdout.write(
    `\nDone.\n- ok: ${okCount}\n- err: ${errCount}\n- elapsed: ${elapsedTotalMs}ms\n` +
      `- results: ${jsonPath}\n- csv: ${csvPath}\n`
  );
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + "\n");
  process.exit(1);
});

