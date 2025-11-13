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
// Examples: 95 (green), 70 (amber), 45 (red), null (random)
const TEST_SCORE = null;

// The TTL for the cache storing scan results.
const CACHE_DURATION = 1000 * 5;

// Function to check cache or scan
async function getCachedOrScan(url) {
  const cacheKey = `scan_${encodeURIComponent(url)}`;
  const data = await chrome.storage.local.get(cacheKey);
  const now = Date.now();

  if (data[cacheKey]) {
    const cached = data[cacheKey];
    if (now - cached.timestamp < CACHE_DURATION) {
      console.log(`Using cached scan for ${url}`);
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
  
  console.log(`Icon updated to ${iconState} (score: ${safetyScore})`);
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

    console.log('Updated recent scans');
  });
}

// Listen for tab updates to auto-scan current page
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Only scan if HTTP or HTTPS page
    if (!/^https?:\/\//i.test(tab.url)){
      console.log("Skipping scan for non-HTTP/HTTPS page:", tab.url);
      return;
    }
    
    // Auto-scan the page and update icon
    console.log('Tab updated:', tab.url);
    
    // Perform security scan
    const result = await getCachedOrScan(tab.url);
    
    // Update icon based on safety score
    updateIcon(tabId, result.safetyScore);

    // Update recently scanned
    updateRecentScans(tab.url, result.safetyScore);

  }
});

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    // Only scan if HTTP or HTTPS
    if (!/^https?:\/\//i.test(tab.url)) {
      console.log("Skipping scan for non-HTTP/HTTPS page:", tab.url);
      return;
    }
    const result = await getCachedOrScan(tab.url);
    updateIcon(activeInfo.tabId, result.safetyScore);
    updateRecentScans(tab.url, result.safetyScore);
  }
});

// Message handler for communication with popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'scanUrl') {
    // Make sure manually entered websites have a TLD
    if (!/\.[a-z]{2,}/i.test(request.url)) {
      console.log("Invalid URL entered:", request.url);
      sendResponse({ error: true, message: "Invalid URL. Please enter a valid website address with a top-level domain (e.g., .com, .org, .net)" });
      return true;
    }

    // Simulate security scan
    const result = await getCachedOrScan(request.url);
    
    // Update icon if this is for the current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      updateIcon(tabs[0].id, result.safetyScore);     
      // Update the recently scanned
      updateRecentScans(request.url, result.safetyScore);
    }
      
    sendResponse(result);
    
    return true;
  }
  
  if (request.action === 'getCurrentTab') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true});
      if (tabs[0]) {
        // Also send the current security score if available
        const url = tabs[0].url;
        // Check if URL is a valid URL to be scanned
        if (!/^https?:\/\//i.test(url)) {
          sendResponse({ url, title: tabs[0].title, securityData: null });
          return true;
        }
        const result = await getCachedOrScan(url);
        sendResponse({ 
          url, 
          title: tabs[0].title,
          securityData: result || null
        });
      }
    return true;
  }
  
  return true;
});

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
  
  return {
    safetyScore: safetyScore,
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
