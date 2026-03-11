import { CACHE_DURATION_MS, SCAN_API_BASE, SCAN_FETCH_TIMEOUT_MS } from "./constants.js";
import { normalizeScanDomain } from "./urlNormalize.js";

/** In-flight scan promises by cache key so concurrent callers for the same domain share one request. */
const inFlightByKey = new Map();

/**
 * Cache and scan entry points.
 * @param {string} url - URL or domain to scan
 * @param {string} [scanTraceId] - Optional trace ID for correlating logs across extension/server/scoring engine
 */
export async function getCachedOrScan(url, scanTraceId) {
  const t0 = Date.now();
  const domain = normalizeScanDomain(url);
  const cacheKey = `scan_${encodeURIComponent(domain || url)}`;
  const data = await chrome.storage.local.get(cacheKey);
  console.log("[NetSTAR][timing] getCachedOrScan: after storage.get", Date.now() - t0, "ms", scanTraceId ? { scanTraceId } : {});

  const now = Date.now();
  if (data[cacheKey]) {
    const cached = data[cacheKey];
    if (now - cached.timestamp < CACHE_DURATION_MS) {
      console.log("[NetSTAR][timing] getCachedOrScan: cache HIT, returning", Date.now() - t0, "ms");
      const elapsedMs = Date.now() - t0;
      console.log("[NetSTAR][timing] getCachedOrScan: completed", { elapsedMs, cacheStatus: "hit", scanTraceId: scanTraceId || null });
      return { ...cached, _cacheStatus: "hit" };
    } else {
      await chrome.storage.local.remove(cacheKey);
      console.log("[NetSTAR][timing] getCachedOrScan: cache expired, removed", Date.now() - t0, "ms");
    }
  } else {
    console.log("[NetSTAR][timing] getCachedOrScan: cache MISS", Date.now() - t0, "ms");
  }

  // Reuse in-flight request for the same domain so we don't double-scan (e.g. React Strict Mode / double mount).
  if (inFlightByKey.has(cacheKey)) {
    console.log("[NetSTAR][timing] getCachedOrScan: reusing in-flight request for", cacheKey);
    const existing = await inFlightByKey.get(cacheKey);
    return existing;
  }

  const promise = (async () => {
    try {
      const beforeScan = Date.now();
      const result = await performSecurityScan(url, scanTraceId);
      console.log("[NetSTAR][timing] getCachedOrScan: after performSecurityScan", Date.now() - beforeScan, "ms (total", Date.now() - t0, "ms)");

      await chrome.storage.local.set({ [cacheKey]: result });
      console.log("[NetSTAR][timing] getCachedOrScan: after storage.set, done", Date.now() - t0, "ms");
      const elapsedMs = Date.now() - t0;
      console.log("[NetSTAR][timing] getCachedOrScan: completed", { elapsedMs, cacheStatus: "miss", scanTraceId: scanTraceId || null });
      return { ...result, _cacheStatus: "miss" };
    } finally {
      inFlightByKey.delete(cacheKey);
    }
  })();
  inFlightByKey.set(cacheKey, promise);
  return promise;
}

/**
 * Scanning functionality. Sends X-Scan-Trace-Id header when scanTraceId is provided.
 * @param {string} url - URL or domain to scan
 * @param {string} [scanTraceId] - Optional trace ID for end-to-end correlation
 */
export async function performSecurityScan(url, scanTraceId) {
  const domain = normalizeScanDomain(url);

  // Prefer domain-based scans so the scoring engine doesn't get "www." subdomains for
  // mail/rdap/dns checks (which can produce dramatically different scores).
  const endpoint = domain
    ? `${SCAN_API_BASE}/scan?domain=${encodeURIComponent(domain)}`
    : `${SCAN_API_BASE}/scan?url=${encodeURIComponent(url)}`;
  const startedAt = Date.now();
  const headers = {};
  if (scanTraceId) headers["X-Scan-Trace-Id"] = scanTraceId;
  console.log("[NetSTAR][timing] performSecurityScan: fetch start", { endpoint, scanTraceId: scanTraceId || null });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCAN_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers });
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startedAt;
    console.log("[NetSTAR][timing] performSecurityScan: fetch done", elapsedMs, "ms");

    console.log("[NetSTAR][scan] Response:", JSON.stringify({
      endpoint,
      status: response.status,
      ok: response.ok,
      elapsedMs,
      scanTraceId: scanTraceId || null,
    }));

    const data = await response.json();
    console.log("[NetSTAR][scan] Payload summary:", {
      safetyScore: data?.safetyScore,
      aggregatedScore: data?.aggregatedScore,
      indicatorsCount: Array.isArray(data?.indicators) ? data.indicators.length : 0,
      timestamp: data?.timestamp,
    });

    const safetyScore = Number.isFinite(data?.safetyScore) ? data.safetyScore : data?.aggregatedScore;
    const indicators = data?.indicators || [];

    return {
      safetyScore,
      indicators,
      timestamp: Date.now(),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const elapsedMs = Date.now() - startedAt;
    if (error.name === "AbortError") {
      console.error("[NetSTAR][scan] Timed out:", JSON.stringify({ endpoint, elapsedMs, scanTraceId: scanTraceId || null }));
      throw new Error(`Scan request timed out after ${SCAN_FETCH_TIMEOUT_MS}ms`);
    }
    console.error("[NetSTAR][scan] Failed:", JSON.stringify({ endpoint, elapsedMs, scanTraceId: scanTraceId || null, error: String(error) }));
    throw error;
  }
}

