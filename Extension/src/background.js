// Background service worker for NetSTAR extension

/** ---------------------------
 *  Icon thresholds and states
 *  ---------------------------
 */
const ICON_THRESHOLDS = {
  SAFE: 75,
  WARNING: 60
};

const ICON_STATES = {
  SAFE: "safe",
  WARNING: "warning",
  DANGER: "danger"
};

// Testing: set a fixed score or null for random
const TEST_SCORE = null;

// Cache TTL for scan results
const CACHE_DURATION = 1000 * 5 * 60; // 5 minutes

/** ---------------------------------
 *  Notifications gating and helpers
 *  ---------------------------------
 *  Follows the Settings soft toggle + Chrome permission model:
 *   - Soft toggle key: notificationsEnabledSoft (boolean)
 *   - Chrome optional permission: "notifications"
 *  Only notify when both are true.
 */

// Score threshold to trigger a warning notification
const ALERT_THRESHOLD = 60;

/** Read the soft toggle the popup controls. */
function readSoftToggle() {
  return new Promise((resolve) => {
    chrome.storage.local.get("notificationsEnabledSoft", (res) => {
      resolve(Boolean(res && res.notificationsEnabledSoft));
    });
  });
}

/** Check Chrome permission for notifications. */
function hasNotificationsPermission() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.permissions) return resolve(false);
    chrome.permissions.contains({ permissions: ["notifications"] }, (has) =>
      resolve(Boolean(has))
    );
  });
}

/** True only if soft toggle and Chrome permission are both enabled. */
async function canNotifyNow() {
  const [soft, perm] = await Promise.all([readSoftToggle(), hasNotificationsPermission()]);
  return soft && perm;
}

/** Create a native notification if allowed by canNotifyNow. */
async function maybeShowRiskNotification(url, safetyScore) {
  if (safetyScore >= ALERT_THRESHOLD) return; // only warn for risky scores
  if (!(await canNotifyNow())) return;
  if (!(chrome && chrome.notifications)) return;

  const iconUrl = chrome.runtime.getURL("src/icons/icon-danger-128.png");
  chrome.notifications.create(
    `risky-site-${Date.now()}`,
    {
      type: "basic",
      iconUrl,
      title: "Risky site detected",
      message: `This page scored ${safetyScore}/100\nURL: ${url}`,
      priority: 2
    },
    () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.warn("Notification error:", chrome.runtime.lastError.message);
      }
    }
  );
}

/** ----------------------------
 *  Cache and scan entry points
 *  ----------------------------
 */
async function getCachedOrScan(url) {
  const cacheKey = `scan_${encodeURIComponent(url)}`;
  const data = await chrome.storage.local.get(cacheKey);
  const now = Date.now();

  if (data[cacheKey]) {
    const cached = data[cacheKey];
    if (now - cached.timestamp < CACHE_DURATION) {
      return cached;
    } else {
      await chrome.storage.local.remove(cacheKey);
    }
  }

  const result = await performSecurityScan(url);
  await chrome.storage.local.set({ [cacheKey]: result });
  return result;
}

/** -------------------------
 *  Browser action icon state
 *  -------------------------
 */
function updateIcon(tabId, safetyScore) {
  let iconState = ICON_STATES.SAFE;

  if (safetyScore >= ICON_THRESHOLDS.SAFE) {
    iconState = ICON_STATES.SAFE;
  } else if (safetyScore >= ICON_THRESHOLDS.WARNING) {
    iconState = ICON_STATES.WARNING;
  } else {
    iconState = ICON_STATES.DANGER;
  }

  const iconPath = (size) => `src/icons/icon-${iconState}-${size}.png`;

  chrome.action.setIcon({
    tabId: tabId,
    path: {
      16: iconPath(16),
      48: iconPath(48),
      128: iconPath(128)
    }
  });
}

/** ---------------------------
 *  Install defaults and icon
 *  ---------------------------
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log("NetSTAR extension installed");

  const defaultIconPath = (size) => `src/icons/icon-${ICON_STATES.SAFE}-${size}.png`;
  chrome.action.setIcon({
    path: {
      16: defaultIconPath(16),
      48: defaultIconPath(48),
      128: defaultIconPath(128)
    }
  });

  chrome.storage.local.set({
    recentScans: [],
    settings: {
      autoScan: true,
      notifications: true
    }
  });
});

/** -----------------------
 *  Recent scans list
 *  -----------------------
 */
function updateRecentScans(url, safetyScore) {
  let safeStatus = "safe";
  if (safetyScore >= ICON_THRESHOLDS.SAFE) {
    safeStatus = "safe";
  } else if (safetyScore >= ICON_THRESHOLDS.WARNING) {
    safeStatus = "warning";
  } else {
    safeStatus = "danger";
  }

  chrome.storage.local.get("recentScans", (data) => {
    let recent = data.recentScans || [];

    recent = recent.filter((entry) => entry.url !== url);

    const newEntry = {
      url: url,
      safe: safeStatus,
      timestamp: Date.now()
    };
    recent.unshift(newEntry);

    if (recent.length > 3) {
      recent = recent.slice(0, 3);
    }

    chrome.storage.local.set({ recentScans: recent });
  });
}

/** ------------------------------------
 *  Auto scan on navigation and activate
 *  ------------------------------------
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (!/^https?:\/\//i.test(tab.url)) return;

    const result = await getCachedOrScan(tab.url);

    updateIcon(tabId, result.safetyScore);
    updateRecentScans(tab.url, result.safetyScore);

    // New: notify only when allowed by soft toggle and permission
    await maybeShowRiskNotification(tab.url, result.safetyScore);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    if (!/^https?:\/\//i.test(tab.url)) return;
    const result = await getCachedOrScan(tab.url);
    updateIcon(activeInfo.tabId, result.safetyScore);
    updateRecentScans(tab.url, result.safetyScore);
    // No notification on tab switch to avoid noise
  }
});

/** -----------------------------------------
 *  Messaging used by popup and other pages
 *  -----------------------------------------
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scanUrl") {
    (async () => {
      try {
        if (!/\.[a-z]{2,}/i.test(request.url)) {
          console.log("Invalid URL entered:", request.url);
          sendResponse({
            error: true,
            message:
              "Invalid URL. Please enter a valid website address with a top-level domain (e.g., .com, .org, .net)"
          });
          return;
        }

        const result = await getCachedOrScan(request.url);

        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          updateIcon(tabs[0].id, result.safetyScore);
          updateRecentScans(request.url, result.safetyScore);
          await maybeShowRiskNotification(request.url, result.safetyScore);
        }

        sendResponse(result);
      } catch (error) {
        console.error("Error in scanUrl:", error);
        sendResponse({ error: true, message: error.message });
      }
    })();
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }

  if (request.action === "getCurrentTab") {
    if (request.requestId) {
      (async () => {
        try {
          const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
          let targetTab = activeTabs[0];

          if (
            !targetTab ||
            !targetTab.url ||
            !/^https?:\/\//i.test(targetTab.url) ||
            targetTab.url.startsWith("chrome-extension://") ||
            targetTab.url.startsWith("chrome://") ||
            targetTab.url.startsWith("edge://") ||
            targetTab.url.startsWith("about:")
          ) {
            const allTabs = await chrome.tabs.query({ currentWindow: true });
            for (const t of allTabs) {
              if (
                t.url &&
                /^https?:\/\//i.test(t.url) &&
                !t.url.startsWith("chrome-extension://") &&
                !t.url.startsWith("chrome://") &&
                !t.url.startsWith("edge://") &&
                !t.url.startsWith("about:")
              ) {
                targetTab = t;
                break;
              }
            }
          }

          let response;
          if (targetTab && targetTab.url) {
            const url = targetTab.url;
            if (!/^https?:\/\//i.test(url)) {
              response = { url, title: targetTab.title, securityData: null };
            } else {
              const result = await getCachedOrScan(url);
              response = {
                url,
                title: targetTab.title,
                securityData: result || null
              };
            }
          } else {
            response = { url: null, title: null, securityData: null };
          }

          chrome.runtime
            .sendMessage({
              action: "getCurrentTabResponse",
              requestId: request.requestId,
              data: response
            })
            .catch(() => {});
        } catch (error) {
          console.error("Error in getCurrentTab handler:", error);
          chrome.runtime
            .sendMessage({
              action: "getCurrentTabResponse",
              requestId: request.requestId,
              data: { url: null, title: null, securityData: null, error: error.message }
            })
            .catch(() => {});
        }
      })();
      return false;
    } else {
      (async () => {
        try {
          const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
          let targetTab = activeTabs[0];

          if (
            !targetTab ||
            !targetTab.url ||
            !/^https?:\/\//i.test(targetTab.url) ||
            targetTab.url.startsWith("chrome-extension://") ||
            targetTab.url.startsWith("chrome://") ||
            targetTab.url.startsWith("edge://") ||
            targetTab.url.startsWith("about:")
          ) {
            const allTabs = await chrome.tabs.query({ currentWindow: true });
            for (const t of allTabs) {
              if (
                t.url &&
                /^https?:\/\//i.test(t.url) &&
                !t.url.startsWith("chrome-extension://") &&
                !t.url.startsWith("chrome://") &&
                !t.url.startsWith("edge://") &&
                !t.url.startsWith("about:")
              ) {
                targetTab = t;
                break;
              }
            }
          }

          if (targetTab && targetTab.url) {
            const url = targetTab.url;
            if (!/^https?:\/\//i.test(url)) {
              sendResponse({ url, title: targetTab.title, securityData: null });
              return;
            }
            const result = await getCachedOrScan(url);
            sendResponse({
              url,
              title: targetTab.title,
              securityData: result || null
            });
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
  }


  return false;
});

/** ------------------------------
 *  Score helpers and scan mock
 *  ------------------------------
 */
function getStatusFromScore(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "moderate";
  return "poor";
}

function generateRandomScore(biasTowardHigh = true) {
  const random = Math.random();

  if (biasTowardHigh) {
    if (random > 0.3) {
      return Math.floor(Math.random() * 41) + 60; // 60-100
    } else {
      return Math.floor(Math.random() * 50) + 30; // 30-79
    }
  } else {
    return Math.floor(Math.random() * 101); // 0-100
  }
}

async function performSecurityScan(url) {
  let safetyScore;

  if (TEST_SCORE !== null) {
    safetyScore = TEST_SCORE;
    console.log(`TEST MODE: Using fixed score of ${TEST_SCORE}`);
  } else {
    const random = Math.random();
    if (random > 0.8) {
      safetyScore = Math.floor(Math.random() * 40) + 40; // 40-79
    } else {
      safetyScore = Math.floor(Math.random() * 25) + 75; // 75-100
    }
  }

  const indicators = [
    { id: "cert", name: "Certificate Health", score: generateRandomScore(true), status: null },
    { id: "connection", name: "Connection Security", score: generateRandomScore(true), status: null },
    { id: "domain", name: "Domain Reputation", score: generateRandomScore(true), status: null },
    { id: "credentials", name: "Credential Safety", score: generateRandomScore(true), status: null },
    { id: "ip", name: "IP Reputation", score: generateRandomScore(true), status: null },
    { id: "dns", name: "DNS Record Health", score: generateRandomScore(true), status: null },
    { id: "whois", name: "WHOIS Pattern", score: generateRandomScore(true), status: null }
  ];

  indicators.forEach((indicator) => {
    indicator.status = getStatusFromScore(indicator.score);
  });

  return {
    safetyScore,
    indicators,
    timestamp: Date.now()
  };
}
