const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const app = express();

// Enable CORS for browser extension / local dev
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

function getStatusFromScore(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "moderate";
  return "poor";
}

// Parse score_engine.py output (text-first, with optional JSON fallback).
function parseScoringOutput(output) {
  // Optional: If Python ever emits JSON, try to parse it.
  try {
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      return {
        scores: jsonData.scores && typeof jsonData.scores === "object" ? jsonData.scores : {},
        aggregatedScore:
          jsonData.Aggregated_Score != null ? Number(jsonData.Aggregated_Score) : null,
      };
    }
  } catch {
    // ignore and fall back to text parsing
  }

  const lines = output.split("\n");
  const scores = {};
  let aggregatedScore = null;

  // Pattern: "AGGREGATED SECURITY SCORE: 95.5"
  const aggMatch = output.match(/AGGREGATED\s+SECURITY\s+SCORE\s*:?\s*([\d.]+)/i);
  if (aggMatch) aggregatedScore = parseFloat(aggMatch[1]);

  const KNOWN_KEYS = new Set([
    // "Scoring Engine" folder keys
    "Connection_Security",
    "Certificate_Health",
    "DNS_Record_Health",
    "Domain_Reputation",
    "Credential_Safety",
    "WHOIS_Pattern",
    "IP_Reputation",
    // Older keys
    "Cert_Score",
    "HVAL_Score",
    "DNS_Score",
    "Mail_Score",
    "Method_Score",
    "RDAP_Score",
  ]);

  // Pattern A: "Cert_Score      : 95" (or similar)
  for (const line of lines) {
    let match = line.match(/^(\w+_Score)\s*:?\s*([\d.]+)\s*$/);
    if (!match) {
      // Pattern B: "Connection_Security : 95.5" (or similar)
      match = line.match(/^([A-Za-z][A-Za-z0-9_]+)\s*:?\s*([\d.]+)\s*$/);
    }
    if (!match) continue;

    const scoreKey = match[1];
    if (!KNOWN_KEYS.has(scoreKey)) continue;

    const scoreValue = parseFloat(match[2]);
    if (!Number.isNaN(scoreValue)) scores[scoreKey] = scoreValue;
  }

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
  const input = req.query.domain || req.query.url || "netstar.ai";

  // Extract domain from URL if full URL provided
  let targetDomain = String(input);
  try {
    if (targetDomain.includes("://")) {
      const u = new URL(targetDomain);
      targetDomain = u.hostname;
    }
  } catch {
    // If URL parsing fails, use as-is
  }

  const pythonScript = resolvePythonScript();
  if (!pythonScript) {
    return res.status(500).json({
      error: true,
      message: "Python scoring script not found (scoring_main.py / score_engine.py).",
      safetyScore: 0,
      aggregatedScore: 0,
      indicators: [],
      timestamp: Date.now(),
    });
  }

  console.log(`[${new Date().toISOString()}] Scanning: ${targetDomain}`);

  const py = spawn("python3", [pythonScript, "-t", targetDomain], {
    // Run from the script's directory so relative imports/files work.
    cwd: path.dirname(pythonScript),
  });

  let output = "";
  let error = "";
  let responded = false;

  py.stdout.on("data", (data) => {
    output += data.toString();
  });
  py.stderr.on("data", (data) => {
    error += data.toString();
  });

  // Timeout after 60 seconds
  const timeout = setTimeout(() => {
    if (responded) return;
    responded = true;
    py.kill();
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

    if (code !== 0 || /Traceback|Error/i.test(error)) {
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
      const { scores, aggregatedScore } = parseScoringOutput(output);
      const response = formatForExtension(scores, aggregatedScore);

      // Debug: log the exact score payload we're about to return
      try {
        const debugPayload = {
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

      return res.json(response);
    } catch (e) {
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
