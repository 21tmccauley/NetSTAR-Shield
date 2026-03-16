const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { normalizeScanTarget } = require("./lib/urlSanitize");

const app = express();

// Enable CORS for browser extension / local dev
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Scan-Trace-Id");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

function getStatusFromScore(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "moderate";
  return "poor";
}

// Known top-level score keys from scoring_main.py (excluding aggregatedScore).
const SCORING_ENGINE_KEYS = [
  "Connection_Security",
  "Certificate_Health",
  "DNS_Record_Health",
  "Domain_Reputation",
  "WHOIS_Pattern",
  "IP_Reputation",
  "Credential_Safety",
];

// Parse scoring engine stdout. Accepts either:
// - New format: top-level score keys + "aggregatedScore" (from scoring_main.py)
// - Legacy: "scores" object + "Aggregated_Score"
function parseScoringOutput(output) {
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Scoring engine did not output valid JSON");
  }
  const jsonData = JSON.parse(jsonMatch[0]);

  let scores = {};
  if (jsonData.scores && typeof jsonData.scores === "object") {
    scores = jsonData.scores;
  } else {
    for (const key of SCORING_ENGINE_KEYS) {
      if (jsonData[key] != null && typeof jsonData[key] === "number") {
        scores[key] = jsonData[key];
      }
    }
  }

  const aggregatedScore =
    jsonData.aggregatedScore != null
      ? Number(jsonData.aggregatedScore)
      : jsonData.Aggregated_Score != null
        ? Number(jsonData.Aggregated_Score)
        : null;

  return { scores, aggregatedScore };
}

// Map scoring engine keys to extension indicator ids/names.
const SCORE_TO_INDICATOR = {
  // "Scoring Engine" folder keys
  Certificate_Health: { id: "cert", name: "Certificate Health" },
  Connection_Security: { id: "connection", name: "Connection Security" },
  Domain_Reputation: { id: "domain", name: "Domain Reputation" },
  Credential_Safety: { id: "credentials", name: "Credential Safety" },
  DNS_Record_Health: { id: "dns", name: "DNS Record Health" },
  WHOIS_Pattern: { id: "whois", name: "WHOIS Pattern" },
  IP_Reputation: { id: "ip", name: "IP Reputation" },

  // Older keys
  Cert_Score: { id: "cert", name: "Certificate Health" },
  HVAL_Score: { id: "connection", name: "Connection Security" },
  DNS_Score: { id: "dns", name: "DNS Record Health" },
  Mail_Score: { id: "credentials", name: "Credential Safety" },
  Method_Score: { id: "connection", name: "Connection Security" },
  RDAP_Score: { id: "domain", name: "Domain Reputation" },
};

function formatForExtension(scores, aggregatedScore) {
  const indicators = [];
  const usedIds = new Set();

  for (const [scoreKey, scoreValue] of Object.entries(scores)) {
    const mapping = SCORE_TO_INDICATOR[scoreKey];
    if (!mapping || usedIds.has(mapping.id)) continue;
    const normalized = Math.max(0, Math.min(100, Number(scoreValue)));
    indicators.push({
      id: mapping.id,
      name: mapping.name,
      score: Math.round(normalized),
      status: getStatusFromScore(normalized),
    });
    usedIds.add(mapping.id);
  }

  // Ensure core indicators exist (UI expects these ids).
  const defaultIndicators = [
    { id: "cert", name: "Certificate Health", baseOffset: 0 },
    { id: "connection", name: "Connection Security", baseOffset: -2 },
    { id: "domain", name: "Domain Reputation", baseOffset: -1 },
    { id: "credentials", name: "Credential Safety", baseOffset: -3 },
    { id: "dns", name: "DNS Record Health", baseOffset: -1 },
    { id: "whois", name: "WHOIS Pattern", baseOffset: 0 },
    { id: "ip", name: "IP Reputation", baseOffset: 1 },
  ];

  for (const def of defaultIndicators) {
    if (usedIds.has(def.id)) continue;
    const baseScore = Number.isFinite(aggregatedScore) ? aggregatedScore : 75;
    const fallbackScore = Math.max(0, Math.min(100, baseScore + (def.baseOffset || 0)));
    indicators.push({
      id: def.id,
      name: def.name,
      score: Math.round(fallbackScore),
      status: getStatusFromScore(fallbackScore),
    });
  }

  const safetyScore = Math.round(Number.isFinite(aggregatedScore) ? aggregatedScore : 75);

  // Backward-compat: keep aggregatedScore so existing extension code works.
  return {
    safetyScore,
    aggregatedScore: safetyScore,
    indicators,
    timestamp: Date.now(),
  };
}

function generateFallbackTraceId() {
  return `scan-srv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parse scoring engine stderr for [scan][timing] lines and return structured entries
 * for server telemetry. Lines look like:
 *   [scan][timing] traceId=... stage=total elapsedSeconds=1.234
 *   [scan][timing] traceId=... stage=data_fetch endpoint=cert elapsedSeconds=0.123
 */
function parseScoringEngineTiming(stderrText) {
  if (!stderrText || typeof stderrText !== "string") return [];
  const lines = stderrText.split(/\r?\n/);
  const result = [];
  const timingRe = /\[scan\]\[timing\].*?stage=(\S+).*?elapsedSeconds=([\d.]+)/;
  const endpointRe = /endpoint=(\S+)/;
  for (const line of lines) {
    if (!line.includes("[scan][timing]")) continue;
    const stageMatch = line.match(timingRe);
    if (!stageMatch) continue;
    const entry = { stage: stageMatch[1], elapsedSeconds: parseFloat(stageMatch[2], 10) };
    const epMatch = line.match(endpointRe);
    if (epMatch) entry.endpoint = epMatch[1];
    result.push(entry);
  }
  return result;
}

function resolvePythonScript() {
  // Prefer the new Scoring Engine folder entrypoint(s).
  const scoringEngineMain = path.join(__dirname, "..", "Scoring Engine", "scoring_main.py");
  if (fs.existsSync(scoringEngineMain)) return scoringEngineMain;

  const scoringEngineScoreEngine = path.join(__dirname, "..", "Scoring Engine", "score_engine.py");
  if (fs.existsSync(scoringEngineScoreEngine)) return scoringEngineScoreEngine;

  // Fallback: legacy location in Server/ (older layouts)
  const localScoreEngine = path.join(__dirname, "score_engine.py");
  if (fs.existsSync(localScoreEngine)) return localScoreEngine;

  return null;
}

// Main endpoint: /scan?domain=example.com OR /scan?url=https://example.com/path
app.get("/scan", (req, res) => {
  const scanTraceId = (req.headers["x-scan-trace-id"] || "").trim() || generateFallbackTraceId();
  const tRequestStart = Date.now();
  const input = req.query.domain || req.query.url || "";

  // Normalize and validate the scan target.
  // Returns 400 for invalid, empty, localhost, or plain-IP inputs.
  // See lib/urlSanitize.js and Docs/url-sanitization-policy.md.
  const tNormalizeStart = Date.now();
  const result = normalizeScanTarget(input);
  const normalizeMs = Date.now() - tNormalizeStart;

  if (!result.ok) {
    console.log(
      `[${new Date().toISOString()}] [scan][error] ${JSON.stringify({
        scanTraceId,
        errorType: "validation",
        input: String(input).slice(0, 200),
        normalizeMs,
      })}`
    );
    return res.status(400).json({
      error: true,
      message: result.reason,
      safetyScore: 0,
      aggregatedScore: 0,
      indicators: [],
      timestamp: Date.now(),
    });
  }
  const targetDomain = result.domain;

  const pythonScript = resolvePythonScript();
  if (!pythonScript) {
    const totalMs = Date.now() - tRequestStart;
    console.log(
      `[${new Date().toISOString()}] [scan][error] ${JSON.stringify({
        scanTraceId,
        errorType: "script_not_found",
        totalMs,
      })}`
    );
    return res.status(500).json({
      error: true,
      message: "Python scoring script not found (scoring_main.py / score_engine.py).",
      safetyScore: 0,
      aggregatedScore: 0,
      indicators: [],
      timestamp: Date.now(),
    });
  }

  console.log(`[${new Date().toISOString()}] Scanning: ${targetDomain} [${scanTraceId}]`);

  // When USE_SCORING_TEST_DATA=1 (e.g. in CI), pass --use-test-data so the scoring
  // engine uses built-in test data instead of live fetches (avoids network/timeouts).
  const useTestData = /^(1|true|yes)$/i.test(String(process.env.USE_SCORING_TEST_DATA || "").trim());
  const pythonArgv = ["-t", targetDomain];
  if (useTestData) pythonArgv.push("--use-test-data");
  pythonArgv.push("--trace-id", scanTraceId);

  // Try multiple python executables in order to be robust across systems.
  // On Windows users may have 'python', the 'py' launcher, or rarely 'python3'.
  // On Unix-like systems prefer 'python3' then 'python'. We attempt each
  // candidate and fall back on ENOENT until one successfully spawns.
  function spawnPythonWithFallback(scriptPath, argv, options) {
    const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
    let idx = 0;
    return new Promise((resolve, reject) => {
      const tryOne = () => {
        if (idx >= candidates.length) return reject(new Error("No suitable Python executable found"));
        const cmd = candidates[idx++];
        const child = spawn(cmd, [scriptPath, ...argv], options);

        // If the process fails to spawn because the binary doesn't exist,
        // Node emits an 'error' with code 'ENOENT'. Try the next candidate.
        child.once("error", (err) => {
          if (err && err.code === "ENOENT") {
            tryOne();
          } else {
            reject(err);
          }
        });

        // Only resolve once the process has actually spawned.
        child.once("spawn", () => resolve(child));
      };
      tryOne();
    });
  }

  let responded = false;
  let tPythonStart = null;

  spawnPythonWithFallback(pythonScript, pythonArgv, {
    cwd: path.dirname(pythonScript),
  })
    .then((py) => {
      tPythonStart = Date.now();
      let output = "";
      let error = "";

      py.stdout.on("data", (data) => {
        output += data.toString();
      });
      py.stderr.on("data", (data) => {
        error += data.toString();
      });

      try {
      // Timeout after 60 seconds
      const timeout = setTimeout(() => {
        if (responded) return;
        responded = true;
        try {
          py.kill();
        } catch {}
        const totalMs = Date.now() - tRequestStart;
        const pythonMs = tPythonStart != null ? Date.now() - tPythonStart : null;
        const scoringEngineDetails = parseScoringEngineTiming(error);
        const stderrPreview = error && error.length > 0
          ? (error.length <= 2500 ? error : error.slice(0, 2500) + "\n... (stderr truncated)")
          : undefined;
        console.log(
          `[${new Date().toISOString()}] [scan][error] ${JSON.stringify({
            scanTraceId,
            errorType: "timeout",
            totalMs,
            pythonMs,
            scoringEngineDetails: scoringEngineDetails.length ? scoringEngineDetails : undefined,
            stderrPreview,
          })}`
        );
        res.status(504).json({
          error: true,
          message: "Scan timeout - scoring engine took too long",
          safetyScore: 0,
          aggregatedScore: 0,
          indicators: [],
          timestamp: Date.now(),
        });
      }, 60000);

      py.on("close", (code) => {
        clearTimeout(timeout);
        if (responded) return;
        responded = true;
        const totalMs = Date.now() - tRequestStart;
        const pythonMs = tPythonStart != null ? Date.now() - tPythonStart : null;

        // Only treat as failure on non-zero exit or actual Python traceback (not benign "Error" in scoring messages)
        const hasTraceback = /Traceback/.test(error);
        if (code !== 0 || hasTraceback) {
          const scoringEngineDetails = parseScoringEngineTiming(error);
          const stderrPreview = error && error.length > 0
            ? (error.length <= 2500 ? error : error.slice(0, 2500) + "\n... (stderr truncated)")
            : undefined;
          console.log(
            `[${new Date().toISOString()}] [scan][error] ${JSON.stringify({
              scanTraceId,
              errorType: "scoring_engine_failed",
              totalMs,
              pythonMs,
              exitCode: code,
              scoringEngineDetails: scoringEngineDetails.length ? scoringEngineDetails : undefined,
              stderrPreview,
            })}`
          );
          return res.status(500).json({
            error: true,
            message: error || `Scoring engine failed (exit code ${code})`,
            safetyScore: 0,
            aggregatedScore: 0,
            indicators: [],
            timestamp: Date.now(),
          });
        }

        try {
          const tParseStart = Date.now();
          const { scores, aggregatedScore } = parseScoringOutput(output);
          const parseMs = Date.now() - tParseStart;

          const tFormatStart = Date.now();
          const response = formatForExtension(scores, aggregatedScore);
          const formatMs = Date.now() - tFormatStart;

          const scoringEngineDetails = parseScoringEngineTiming(error);

          // Debug: log the exact score payload we're about to return
          try {
            const debugPayload = {
              scanTraceId,
              timing: {
                totalMs,
                pythonMs,
                normalizeMs,
                parseMs,
                formatMs,
                scoringEngineDetails: scoringEngineDetails.length ? scoringEngineDetails : undefined,
              },
              request: {
                method: req.method,
                path: req.path,
                originalUrl: req.originalUrl,
                query: req.query,
                ip: req.ip,
                headers: {
                  "user-agent": req.get("user-agent"),
                  origin: req.get("origin"),
                  referer: req.get("referer"),
                },
              },
              targetDomain,
              input: String(input),
              aggregatedScoreParsed: Number.isFinite(aggregatedScore) ? aggregatedScore : null,
              response: {
                safetyScore: response?.safetyScore,
                aggregatedScore: response?.aggregatedScore,
                indicatorsCount: Array.isArray(response?.indicators) ? response.indicators.length : 0,
                indicators: Array.isArray(response?.indicators)
                  ? response.indicators.map((i) => ({
                      id: i?.id,
                      name: i?.name,
                      score: i?.score,
                      status: i?.status,
                    }))
                  : [],
                timestamp: response?.timestamp,
              },
            };
            console.log(
              `[${new Date().toISOString()}] [scan][score-response] ${JSON.stringify(debugPayload)}`
            );
          } catch {
            // Avoid breaking /scan responses due to logging issues
          }

          // Optionally include timing in response body for batch/CLI clients (extension ignores extra keys)
          const includeTiming =
            req.query.includeTiming === "true" || req.get("X-Scan-Include-Timing") === "true";
          if (includeTiming) {
            response.timing = {
              totalMs,
              pythonMs,
              normalizeMs,
              parseMs,
              formatMs,
              scoringEngineDetails: scoringEngineDetails.length ? scoringEngineDetails : [],
            };
          }

          return res.json(response);
        } catch (e) {
          console.log(
            `[${new Date().toISOString()}] [scan][error] ${JSON.stringify({
              scanTraceId,
              errorType: "parse_or_format",
              totalMs,
              pythonMs,
              message: e?.message,
            })}`
          );
          return res.status(500).json({
            error: true,
            message: `Failed to parse scoring results: ${e.message}`,
            safetyScore: 0,
            aggregatedScore: 0,
            indicators: [],
            timestamp: Date.now(),
          });
        }
      });
      } catch (e) {
        if (!responded) {
          responded = true;
          const totalMs = Date.now() - tRequestStart;
          console.log(
            `[${new Date().toISOString()}] [scan][error] ${JSON.stringify({
              scanTraceId,
              errorType: "handler_error",
              totalMs,
              message: e?.message,
            })}`
          );
          res.status(500).json({
            error: true,
            message: e?.message || "Scoring handler error",
            safetyScore: 0,
            aggregatedScore: 0,
            indicators: [],
            timestamp: Date.now(),
          });
        }
      }
    })
    .catch((err) => {
      const totalMs = Date.now() - tRequestStart;
      console.log(
        `[${new Date().toISOString()}] [scan][error] ${JSON.stringify({
          scanTraceId,
          errorType: "spawn_failed",
          totalMs,
          message: err?.message,
        })}`
      );
      return res.status(500).json({
        error: true,
        message: `Failed to start python scoring engine: ${err.message}`,
        safetyScore: 0,
        aggregatedScore: 0,
        indicators: [],
        timestamp: Date.now(),
      });
    });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    service: "NetSTAR Shield API",
    version: "1.0.0",
    endpoints: {
      scan: "/scan?domain=example.com",
      health: "/health",
    },
  });
});

// Only start listening when this file is run directly (not when required by tests).
if (require.main === module) {
  const PORT = process.env.PORT || 3000;

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`NetSTAR Shield server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Scan endpoint: http://localhost:${PORT}/scan?domain=example.com`);
  });

  server.on("error", (error) => {
    if (error.code === "EACCES") {
      console.error(`ERROR: Permission denied. Port ${PORT} may require elevated privileges.`);
    } else if (error.code === "EADDRINUSE") {
      console.error(`ERROR: Port ${PORT} is already in use.`);
    } else {
      console.error("Server error:", error);
    }
    process.exit(1);
  });

  function shutdown(signal) {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
    server.close(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
  });
}

module.exports = { app };
