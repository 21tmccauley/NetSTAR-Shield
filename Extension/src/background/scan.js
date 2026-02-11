import { CACHE_DURATION_MS, SCAN_API_BASE } from "./constants.js";

/**
 * Normalize a raw URL or domain into a clean hostname for caching and API
 * requests. This mirrors the server's normalization (see
 * Docs/url-sanitization-policy.md) so that both layers produce the same
 * canonical domain for a given input.
 *
 * Steps:
 *  1. Coerce to string and trim whitespace.
 *  2. Parse as a URL (prepend "https://" if no scheme) to extract hostname.
 *     On parse failure, fall back to the raw string (best effort).
 *  3. Lowercase and strip trailing dots.
 *  4. Strip leading "www." so the scoring engine gets the apex domain.
 *
 * This function does NOT reject invalid input — it returns an empty string
 * or a best-effort hostname. Actual blocking happens in messages.js (TLD
 * check for manual scans) and on the server (400 for invalid targets).
 *
 * @param {string} rawInput - A URL or bare domain entered by the user or
 *   obtained from a browser tab.
 * @returns {string} The normalized hostname, or "" if input was empty.
 */
function normalizeScanDomain(rawInput) {
  let raw = String(rawInput ?? "").trim();
  if (!raw) return "";

  // Parse as URL to reliably extract the hostname.
  // If the input has no scheme (e.g. "capitalone.com"), prepend "https://"
  // so the URL constructor can handle it.
  let hostname = raw;
  try {
    const u = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    hostname = u.hostname;
  } catch {
    // If parsing fails, fall back to raw (best effort).
    hostname = raw;
  }

  hostname = String(hostname).toLowerCase().replace(/\.+$/, "");
  if (hostname.startsWith("www.")) hostname = hostname.slice(4);
  return hostname;
}

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
  const endpoint = domain
    ? `${SCAN_API_BASE}/scan?domain=${encodeURIComponent(domain)}`
    : `${SCAN_API_BASE}/scan?url=${encodeURIComponent(url)}`;
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

