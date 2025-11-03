// Background service worker for NetSTAR extension

// Constants for icon thresholds
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
const TEST_SCORE = 60;

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
  
  // Initialize storage with default values
  chrome.storage.local.set({
    recentScans: [
      { url: "github.com", safe: true, timestamp: Date.now() },
      { url: "google.com", safe: true, timestamp: Date.now() },
      { url: "amazon.com", safe: true, timestamp: Date.now() }
    ],
    settings: {
      autoScan: true,
      notifications: true
    }
  });
});

// Listen for tab updates to auto-scan current page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Auto-scan the page and update icon
    console.log('Tab updated:', tab.url);
    
    // Perform security scan
    const result = performSecurityScan(tab.url);
    
    // Update icon based on safety score
    updateIcon(tabId, result.safetyScore);
    
    // Store the result for the popup to access
    chrome.storage.local.set({
      [`scan_${tabId}`]: result
    });
  }
});

// Listen for tab activation (when user switches tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    // Check if we have a cached scan for this tab
    const result = await chrome.storage.local.get(`scan_${activeInfo.tabId}`);
    if (result[`scan_${activeInfo.tabId}`]) {
      updateIcon(activeInfo.tabId, result[`scan_${activeInfo.tabId}`].safetyScore);
    } else {
      // Perform new scan
      const scanResult = performSecurityScan(tab.url);
      updateIcon(activeInfo.tabId, scanResult.safetyScore);
      chrome.storage.local.set({
        [`scan_${activeInfo.tabId}`]: scanResult
      });
    }
  }
});

// Message handler for communication with popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanUrl') {
    // Simulate security scan
    const result = performSecurityScan(request.url);
    
    // Update icon if this is for the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        updateIcon(tabs[0].id, result.safetyScore);
        
        // Store the result
        chrome.storage.local.set({
          [`scan_${tabs[0].id}`]: result
        });
      }
    });
    
    sendResponse(result);
  }
  
  if (request.action === 'getCurrentTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0]) {
        // Also send the current security score if available
        const result = await chrome.storage.local.get(`scan_${tabs[0].id}`);
        sendResponse({ 
          url: tabs[0].url, 
          title: tabs[0].title,
          securityData: result[`scan_${tabs[0].id}`] || null
        });
      }
    });
    return true; // Will respond asynchronously
  }
  
  return true;
});

// Simulated security scan function
function performSecurityScan(url) {
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
