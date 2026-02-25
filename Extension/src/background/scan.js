import { CACHE_DURATION_MS, SCAN_API_BASE, SIGNALS_CACHE_PREFIX } from "./constants.js";
import { normalizeScanDomain } from "./urlNormalize.js";

/**
 * Cache and scan entry points
 */
export async function getCachedOrScan(url) {
  const domain = normalizeScanDomain(url);
  const cacheKey = `scan_${encodeURIComponent(domain || url)}`;
  const data = await chrome.storage.local.get(cacheKey);
  const now = Date.now();

  if (data[cacheKey]) {
    const cached = data[cacheKey];
    if (now - cached.timestamp < CACHE_DURATION_MS) {
      return cached;
    } else {
      await chrome.storage.local.remove(cacheKey);
    }
  }

  const result = await performSecurityScan(url);
  await chrome.storage.local.set({ [cacheKey]: result });
  return result;
}

/**
 * Scanning functionality
 */
export async function performSecurityScan(url) {
  const domain = normalizeScanDomain(url);

  // Prefer domain-based scans so the scoring engine doesn't get "www." subdomains for
  // mail/rdap/dns checks (which can produce dramatically different scores).
  let endpoint = domain
    ? `${SCAN_API_BASE}/scan?domain=${encodeURIComponent(domain)}`
    : `${SCAN_API_BASE}/scan?url=${encodeURIComponent(url)}`;

  // Attach cached live signals (from content-inspect.js) if fresh
  try {
    const signalsKey = `${SIGNALS_CACHE_PREFIX}${domain || url}`;
    const stored = await chrome.storage.local.get(signalsKey);
    const cached = stored[signalsKey];
    if (cached && (Date.now() - (cached.timestamp || 0)) < CACHE_DURATION_MS) {
      endpoint += `&signals=${encodeURIComponent(JSON.stringify(cached))}`;
      console.log("[NetSTAR][scan] Attached cached live signals for", domain || url);
    }
  } catch (err) {
    console.warn("[NetSTAR][scan] Could not read cached signals:", err);
  }

  const startedAt = Date.now();
  console.log("[NetSTAR][scan] Requesting:", endpoint);

  try {
    const response = await fetch(endpoint);
    const elapsedMs = Date.now() - startedAt;

    console.log("[NetSTAR][scan] Response:", {
      endpoint,
      status: response.status,
      ok: response.ok,
      elapsedMs,
    });

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
    const elapsedMs = Date.now() - startedAt;
    console.error("[NetSTAR][scan] Failed:", { endpoint, elapsedMs, error });
    throw error;
  }
}

