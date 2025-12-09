// Background service worker for NetSTAR extension

/**
 * @file background.js
 * @description Core background logic. Notification delivery requires both the soft toggle and
 *              the Chrome permission. This prevents accidental notifications while allowing
 *              fast re-enable without another permission prompt.
 */

const ICON_THRESHOLDS = { SAFE: 75, WARNING: 60 };
const ICON_STATES = { SAFE: "safe", WARNING: "warning", DANGER: "danger" };
const TEST_SCORE = null;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes
const ALERT_THRESHOLD = 60; // notify only when below this

/**
 * Read soft toggle from storage.
 * @returns {Promise<boolean>}
 */
function readSoftToggle() {
  return new Promise((resolve) => {
    chrome.storage.local.get("notificationsEnabledSoft", (res) => {
      resolve(Boolean(res && res.notificationsEnabledSoft));
    });
  });
}

/**
 * Check Chrome notifications permission.
 * @returns {Promise<boolean>}
 */
function hasNotificationsPermission() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.permissions) return resolve(false);
    chrome.permissions.contains({ permissions: ["notifications"] }, (has) => resolve(Boolean(has)));
  });
}

/**
 * Gate for notification delivery.
 * @returns {Promise<boolean>} true only if soft toggle and permission are both true
 */
async function canNotifyNow() {
  const [soft, perm] = await Promise.all([readSoftToggle(), hasNotificationsPermission()]);
  return soft && perm;
}

/**
 * Validate URL scheme for scanning.
 * @param {string} url
 * @returns {boolean}
 */
function isHttpUrl(url) {
  return /^https?:\/\//i.test(url);
}

/**
 * Build icon path for action icon.
 * @param {"safe"|"warning"|"danger"} state
 * @param {16|48|128} size
 * @returns {string}
 */
function iconPathByState(state, size) {
  return `src/icons/icon-${state}-${size}.png`;
}

/**
 * Update extension action icon per score.
 * @param {number} tabId
 * @param {number} safetyScore
 */
function updateIcon(tabId, safetyScore) {
  let state = ICON_STATES.SAFE;
  if (safetyScore >= ICON_THRESHOLDS.SAFE) state = ICON_STATES.SAFE;
  else if (safetyScore >= ICON_THRESHOLDS.WARNING) state = ICON_STATES.WARNING;
  else state = ICON_STATES.DANGER;

  chrome.action.setIcon({
    tabId,
    path: {
      16: iconPathByState(state, 16),
      48: iconPathByState(state, 48),
      128: iconPathByState(state, 128)
    }
  });
}

/**
 * Cache key for scans.
 * @param {string} url
 * @returns {string}
 */
function getScanCacheKey(url) {
  return `scan_${encodeURIComponent(url)}`;
}

/**
 * Read cache or scan.
 * @param {string} url
 * @returns {Promise<{safetyScore:number, indicators:Array, timestamp:number}>}
 */
async function getCachedOrScan(url) {
  const cacheKey = getScanCacheKey(url);
  const { [cacheKey]: cached } = await chrome.storage.local.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_DURATION) return cached;
  if (cached) await chrome.storage.local.remove(cacheKey);

  const result = await performSecurityScan(url);
  await chrome.storage.local.set({ [cacheKey]: result });
  return result;
}

/**
 * Simulated security scan.
 * @param {string} url
 * @returns {Promise<{safetyScore:number, indicators:Array, timestamp:number}>}
 */
async function performSecurityScan(url) {
  let safetyScore;
  if (TEST_SCORE !== null) {
    safetyScore = TEST_SCORE;
  } else {
    const r = Math.random();
    safetyScore = r > 0.8 ? Math.floor(Math.random() * 40) + 40 : Math.floor(Math.random() * 25) + 75;
  }
  return {
    safetyScore,
    indicators: [
      { id: "cert", name: "Certificate Health", score: 95, status: "excellent" },
      { id: "connection", name: "Connection Security", score: 100, status: "excellent" },
      { id: "domain", name: "Domain Reputation", score: 78, status: "good" },
      { id: "credentials", name: "Credential Safety", score: 85, status: "good" },
      { id: "ip", name: "IP Reputation", score: 92, status: "excellent" },
      { id: "dns", name: "DNS Record Health", score: 88, status: "good" },
      { id: "whois", name: "WHOIS Pattern", score: 71, status: "moderate" }
    ],
    timestamp: Date.now()
  };
}

/**
 * Resolve the icon for danger notifications.
 * @returns {string}
 */
function resolveDangerIcon() {
  return chrome.runtime.getURL("src/icons/icon-danger-128.png");
}

/**
 * Show a risk notification when score is below threshold and policy allows it.
 * @param {number} tabId
 * @param {string} url
 * @param {number} safetyScore
 * @returns {Promise<void>}
 */
async function maybeShowRiskNotification(tabId, url, safetyScore) {
  if (safetyScore >= ALERT_THRESHOLD) return;
  if (!(await canNotifyNow())) return;

  chrome.notifications.create(
    `risky-site-${Date.now()}`,
    {
      type: "basic",
      iconUrl: resolveDangerIcon(),
      title: "Risky site detected",
      message: `This page scored ${safetyScore}/100.\nURL: ${url}`,
      priority: 2
    },
    () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.error("Notification error:", chrome.runtime.lastError);
      }
    }
  );
}

/**
 * Update the recent scans list.
 * @param {string} url
 * @param {number} safetyScore
 */
function updateRecentScans(url, safetyScore) {
  let safeStatus = "safe";
  if (safetyScore >= ICON_THRESHOLDS.SAFE) safeStatus = "safe";
  else if (safetyScore >= ICON_THRESHOLDS.WARNING) safeStatus = "warning";
  else safeStatus = "danger";

  chrome.storage.local.get("recentScans", (data) => {
    let recent = data.recentScans || [];
    recent = recent.filter((e) => e.url !== url);
    recent.unshift({ url, safe: safeStatus, timestamp: Date.now() });
    if (recent.length > 3) recent = recent.slice(0, 3);
    chrome.storage.local.set({ recentScans: recent });
  });
}

/**
 * Initialize defaults on install.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setIcon({
    path: {
      16: iconPathByState(ICON_STATES.SAFE, 16),
      48: iconPathByState(ICON_STATES.SAFE, 48),
      128: iconPathByState(ICON_STATES.SAFE, 128)
    }
  });
  // Default soft toggle off on first run
  chrome.storage.local.set({ recentScans: [], notificationsEnabledSoft: false });
});

/**
 * Scan and update on completed navigations.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!isHttpUrl(tab.url)) return;

  const result = await getCachedOrScan(tab.url);
  updateIcon(tabId, result.safetyScore);
  updateRecentScans(tab.url, result.safetyScore);
  maybeShowRiskNotification(tabId, tab.url, result.safetyScore);
});

/**
 * Refresh icon and history when the user switches tabs.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (!tab.url || !isHttpUrl(tab.url)) return;

  const result = await getCachedOrScan(tab.url);
  updateIcon(activeInfo.tabId, result.safetyScore);
  updateRecentScans(tab.url, result.safetyScore);
});

/**
 * Popup RPCs for scanning and current tab info.
 */
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === "scanUrl") {
    if (!/\.[a-z]{2,}/i.test(request.url)) {
      sendResponse({ error: true, message: "Invalid URL. Please enter a valid website address with a top-level domain." });
      return true;
    }
    const result = await getCachedOrScan(request.url);
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      updateIcon(tabs[0].id, result.safetyScore);
      updateRecentScans(request.url, result.safetyScore);
    }
    sendResponse(result);
    return true;
  }

  if (request.action === "getCurrentTab") {
    (async () => {
      try {
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        let targetTab = activeTabs[0];

        const invalid = (t) =>
          !t ||
          !t.url ||
          !isHttpUrl(t.url) ||
          t.url.startsWith("chrome-extension://") ||
          t.url.startsWith("chrome://") ||
          t.url.startsWith("edge://") ||
          t.url.startsWith("about:");

        if (invalid(targetTab)) {
          const allTabs = await chrome.tabs.query({ currentWindow: true });
          for (const t of allTabs) {
            if (!invalid(t)) {
              targetTab = t;
              break;
            }
          }
        }

        if (targetTab && targetTab.url) {
          const url = targetTab.url;
          if (!isHttpUrl(url)) {
            sendResponse({ url, title: targetTab.title, securityData: null });
            return;
          }
          const result = await getCachedOrScan(url);
          sendResponse({ url, title: targetTab.title, securityData: result || null });
        } else {
          sendResponse({ url: null, title: null, securityData: null });
        }
      } catch (error) {
        console.error("Error in getCurrentTab handler:", error);
        sendResponse({ url: null, title: null, securityData: null, error: error.message });
      }
    })();
    return true;
  }

  return true;
});
