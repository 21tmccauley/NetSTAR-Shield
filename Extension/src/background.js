// Background service worker for NetSTAR extension

const ICON_THRESHOLDS = {
  SAFE: 75,
  WARNING: 60
}

const ICON_STATES = {
  SAFE: 'safe',
  WARNING: 'warning',
  DANGER: 'danger'
}

// TESTING: Set a specific score here (null = random scores)
// Examples: 95 (green/safe), 70 (amber/warning), 45 (red/danger), null (random)
// For testing alerts: Use a score below 75 (e.g., 45 for danger, 65 for warning)
const TEST_SCORE = 45; // Set to null to use random scores, or a number (0-100) for fixed score

// The TTL for the cache storing scan results.
const CACHE_DURATION = 1000 * 5 * 60; // 5 minutes

// Function to check cache or scan
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

// Function to update icon based on security score
function updateIcon(tabId, safetyScore) {
  let iconState = ICON_STATES.SAFE; // default
  
  if (safetyScore >= ICON_THRESHOLDS.SAFE) {
    iconState = ICON_STATES.SAFE;      // Green ShieldCheck
  } else if (safetyScore >= ICON_THRESHOLDS.WARNING) {
    iconState = ICON_STATES.WARNING;   // Amber ShieldCheck
  } else {
    iconState = ICON_STATES.DANGER;    // Red ShieldX
  }
  
  // Update the extension icon for this tab
  const iconPath = (size) => `src/icons/icon-${iconState}-${size}.png`

  chrome.action.setIcon({
    tabId: tabId,
    path: {
      16: iconPath(16),
      48: iconPath(48),
      128: iconPath(128)
    }
  });
  
}

// Function to send alert message to content script
async function sendAlertToContentScript(tabId, safetyScore, url) {
  try {
    // First, check if this tab supports content scripts
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab || !tab.url) {
      return; // Tab doesn't exist or has no URL
    }

    // Skip chrome://, chrome-extension://, edge://, about: pages
    if (tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') || 
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('about:') ||
        !/^https?:\/\//i.test(tab.url)) {
      return; // Can't inject into these pages
    }

    // Check if we should show alert (only for unsafe sites)
    if (safetyScore < ICON_THRESHOLDS.SAFE) {
      // Try to send message with retry logic
      let retries = 3;
      let success = false;
      
      while (retries > 0 && !success) {
        try {
          await chrome.tabs.sendMessage(tabId, {
            action: 'showAlert',
            safetyScore: safetyScore,
            url: url
          });
          success = true;
        } catch (err) {
          // Content script might not be loaded yet
          if (err.message.includes('Receiving end does not exist')) {
            retries--;
            if (retries > 0) {
              // Wait a bit before retrying (content script might still be loading)
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              // Last resort: try to inject the script manually
              try {
                await chrome.scripting.executeScript({
                  target: { tabId: tabId },
                  files: ['src/content.js']
                });
                // Wait a moment for script to initialize
                await new Promise(resolve => setTimeout(resolve, 200));
                // Try sending message again
                await chrome.tabs.sendMessage(tabId, {
                  action: 'showAlert',
                  safetyScore: safetyScore,
                  url: url
                });
              } catch (injectErr) {
                // Page might not allow injection (CSP, etc.)
                console.log('Could not inject or send alert to content script:', injectErr.message);
              }
            }
          } else {
            // Different error, don't retry
            console.log('Error sending alert:', err.message);
            break;
          }
        }
      }
    } else {
      // Hide alert if site is safe
      await chrome.tabs.sendMessage(tabId, {
        action: 'hideAlert'
      }).catch(err => {
        // Ignore errors - content script might not be loaded
      });
    }
  } catch (error) {
    console.log('Error in sendAlertToContentScript:', error);
  }
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('NetSTAR extension installed');
  
  // Set default icon to safe state
  const defaultIconPath = (size) => `src/icons/icon-${ICON_STATES.SAFE}-${size}.png`
  chrome.action.setIcon({
    path: {
      16: defaultIconPath(16),
      48: defaultIconPath(48),
      128: defaultIconPath(128)
    }
  });
  
  // Initialize empty storage
  chrome.storage.local.set({
    recentScans: [],
      //{ url: "github.com", safe: true, timestamp: Date.now() },
      //{ url: "google.com", safe: true, timestamp: Date.now() },
      //{ url: "amazon.com", safe: true, timestamp: Date.now() }
    settings: {
      autoScan: true,
      notifications: true
    }
  });
});

function updateRecentScans(url, safetyScore) {
  let safeStatus = 'safe';
  if (safetyScore >= ICON_THRESHOLDS.SAFE) {
    safeStatus = 'safe';
  } else if (safetyScore >= ICON_THRESHOLDS.WARNING) {
    safeStatus = 'warning';
  } else {
    safeStatus = 'danger';
  }

  chrome.storage.local.get('recentScans', (data) => {
    let recent = data.recentScans || [];

    recent = recent.filter(entry => entry.url !== url);

    const newEntry = {
      url: url,
      safe: safeStatus,
      timestamp: Date.now()
    };
    recent.unshift(newEntry);

    if (recent.length > 3) {
      recent = recent.slice(0, 3);
    }

    chrome.storage.local.set({recentScans: recent});

  });
}

// Listen for tab updates to auto-scan current page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Only scan if HTTP or HTTPS page
    if (!/^https?:\/\//i.test(tab.url)){
      return;
    }
    
    // Auto-scan the page and update icon
    
    // Perform security scan
    const result = await getCachedOrScan(tab.url);
    
    // Update icon based on safety score
    updateIcon(tabId, result.safetyScore);

    // Update recently scanned
    updateRecentScans(tab.url, result.safetyScore);

    // Send alert to content script if site is unsafe
    // Add a small delay to ensure content script has loaded
    setTimeout(() => {
      sendAlertToContentScript(tabId, result.safetyScore, tab.url);
    }, 300);

  }
});

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    // Only scan if HTTP or HTTPS
    if (!/^https?:\/\//i.test(tab.url)) {
      return;
    }
    const result = await getCachedOrScan(tab.url);
    updateIcon(activeInfo.tabId, result.safetyScore);
    updateRecentScans(tab.url, result.safetyScore);
    // Send alert to content script if site is unsafe
    // Add a small delay to ensure content script has loaded
    setTimeout(() => {
      sendAlertToContentScript(activeInfo.tabId, result.safetyScore, tab.url);
    }, 300);
  }
});

// Message handler for communication with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async operations properly to avoid message port errors
  if (request.action === 'scanUrl') {
    (async () => {
      try {
        // Make sure manually entered websites have a TLD
        if (!/\.[a-z]{2,}/i.test(request.url)) {
          console.log("Invalid URL entered:", request.url);
          sendResponse({ error: true, message: "Invalid URL. Please enter a valid website address with a top-level domain (e.g., .com, .org, .net)" });
          return;
        }

        // Simulate security scan
        const result = await getCachedOrScan(request.url);
        
        // Update icon if this is for the current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          updateIcon(tabs[0].id, result.safetyScore);     
          // Update the recently scanned
          updateRecentScans(request.url, result.safetyScore);
          // Send alert to content script if site is unsafe (only if URL matches current tab)
          try {
            const requestHostname = new URL(request.url.startsWith('http') ? request.url : `https://${request.url}`).hostname;
            if (tabs[0].url && tabs[0].url.includes(requestHostname)) {
              await sendAlertToContentScript(tabs[0].id, result.safetyScore, tabs[0].url);
            }
          } catch (e) {
            // If URL parsing fails, just skip the alert
            console.log('Could not match URL for alert:', e);
          }
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
  
  if (request.action === 'getCurrentTab') {
    // If requestId is provided, we'll send response via message (don't keep channel open)
    if (request.requestId) {
      (async () => {
        try {
          // First, try to get the active tab (most common case)
          const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
          let targetTab = activeTabs[0];
          
          // Check if active tab is a valid HTTP/HTTPS page
          if (!targetTab || !targetTab.url || !/^https?:\/\//i.test(targetTab.url) ||
              targetTab.url.startsWith('chrome-extension://') || 
              targetTab.url.startsWith('chrome://') || 
              targetTab.url.startsWith('edge://') ||
              targetTab.url.startsWith('about:')) {
            // Active tab is not a valid webpage, search for the first valid HTTP/HTTPS tab
            const allTabs = await chrome.tabs.query({ currentWindow: true });
            for (const tab of allTabs) {
              if (tab.url && /^https?:\/\//i.test(tab.url) &&
                  !tab.url.startsWith('chrome-extension://') && 
                  !tab.url.startsWith('chrome://') && 
                  !tab.url.startsWith('edge://') &&
                  !tab.url.startsWith('about:')) {
                targetTab = tab;
                break;
              }
            }
          }
          
          let response;
          if (targetTab && targetTab.url) {
            const url = targetTab.url;
            
            // Check if URL is a valid URL to be scanned
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
          
          // Send response via message
          chrome.runtime.sendMessage({
            action: 'getCurrentTabResponse',
            requestId: request.requestId,
            data: response
          }).catch(() => {
            // Silently ignore errors - popup might have closed
          });
        } catch (error) {
          console.error('Error in getCurrentTab handler:', error);
          chrome.runtime.sendMessage({
            action: 'getCurrentTabResponse',
            requestId: request.requestId,
            data: { url: null, title: null, securityData: null, error: error.message }
          }).catch(() => {
            // Silently ignore errors - popup might have closed
          });
        }
      })();
      return false; // Don't keep channel open - we're using message pattern
    } else {
      // Synchronous response pattern - keep channel open
      (async () => {
        try {
          const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
          let targetTab = activeTabs[0];
          
          if (!targetTab || !targetTab.url || !/^https?:\/\//i.test(targetTab.url) ||
              targetTab.url.startsWith('chrome-extension://') || 
              targetTab.url.startsWith('chrome://') || 
              targetTab.url.startsWith('edge://') ||
              targetTab.url.startsWith('about:')) {
            const allTabs = await chrome.tabs.query({ currentWindow: true });
            for (const tab of allTabs) {
              if (tab.url && /^https?:\/\//i.test(tab.url) &&
                  !tab.url.startsWith('chrome-extension://') && 
                  !tab.url.startsWith('chrome://') && 
                  !tab.url.startsWith('edge://') &&
                  !tab.url.startsWith('about:')) {
                targetTab = tab;
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
          console.error('Error in getCurrentTab handler:', error);
          sendResponse({ url: null, title: null, securityData: null, error: error.message });
        }
      })();
      return true; // Keep the message channel open for async response
    }
  }
  
  if (request.action === 'highlightExtension') {
    // We can't programmatically open popup, but we can set a badge
    // to draw attention to the extension icon
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    sendResponse({ success: true });
    return true;
  }
  
  // Return false if we don't handle the message
  return false;
});

// Helper function to determine status from score
function getStatusFromScore(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "moderate";
  return "poor";
}

// Generate random score with weighted distribution (favors higher scores)
function generateRandomScore(biasTowardHigh = true) {
  const random = Math.random();
  
  if (biasTowardHigh) {
    // 70% chance of good scores (60-100), 30% chance of lower scores (30-79)
    if (random > 0.3) {
      return Math.floor(Math.random() * 41) + 60; // 60-100
    } else {
      return Math.floor(Math.random() * 50) + 30; // 30-79
    }
  } else {
    // Uniform distribution
    return Math.floor(Math.random() * 101); // 0-100
  }
}

// Simulated security scan function
async function performSecurityScan(url) {
  // In a real extension, this would make API calls to security services
  
  let safetyScore;
  
  // Check if we're in test mode with a specific score
  if (TEST_SCORE !== null) {
    // Use the test score
    safetyScore = TEST_SCORE;
    console.log(`🔧 TEST MODE: Using fixed score of ${TEST_SCORE}`);
  } else {
    // For demo: generate varied scores to test different icon states
    // Most sites will be safe (75-100), some warning (60-74), few danger (<60)
    const random = Math.random();
    
    if (random > 0.8) {
      // 20% chance of warning or danger
      safetyScore = Math.floor(Math.random() * 40) + 40; // 40-79
    } else {
      // 80% chance of safe
      safetyScore = Math.floor(Math.random() * 25) + 75; // 75-100
    }
  }
  
  // Generate random scores for each indicator
  // Using URL as a seed to ensure same URL gets same scores (via caching)
  const indicators = [
    { 
      id: "cert", 
      name: "Certificate Health", 
      score: generateRandomScore(true),
      status: null // Will be set below
    },
    { 
      id: "connection", 
      name: "Connection Security", 
      score: generateRandomScore(true),
      status: null
    },
    { 
      id: "domain", 
      name: "Domain Reputation", 
      score: generateRandomScore(true),
      status: null
    },
    { 
      id: "credentials", 
      name: "Credential Safety", 
      score: generateRandomScore(true),
      status: null
    },
    { 
      id: "ip", 
      name: "IP Reputation", 
      score: generateRandomScore(true),
      status: null
    },
    { 
      id: "dns", 
      name: "DNS Record Health", 
      score: generateRandomScore(true),
      status: null
    },
    { 
      id: "whois", 
      name: "WHOIS Pattern", 
      score: generateRandomScore(true),
      status: null
    }
  ];
  
  // Calculate status for each indicator based on its score
  indicators.forEach(indicator => {
    indicator.status = getStatusFromScore(indicator.score);
  });
  
  return {
    safetyScore: safetyScore,
    indicators: indicators,
    timestamp: Date.now()
  };
}
