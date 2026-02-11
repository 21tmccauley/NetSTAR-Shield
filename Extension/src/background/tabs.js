import { getCachedOrScan } from "./scan.js";
import { updateIcon } from "./icon.js";
import { updateRecentScans } from "./recentScans.js";
import { maybeShowInPageAlert, maybeShowRiskNotification } from "./notifications.js";

/**
 * Auto scan on navigation and activate.
 */
export function registerTabListeners() {
  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      if (!/^https?:\/\//i.test(tab.url)) return;

      const result = await getCachedOrScan(tab.url);

      updateIcon(tabId, result.safetyScore);
      updateRecentScans(tab.url, result.safetyScore);

      // Show in-page alert overlay for risky sites
      await maybeShowInPageAlert(tabId, tab.url, result.safetyScore);

      // Also show native notification if enabled
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
}

