// Content script for injecting security alerts into web pages

const ALERT_ID = 'netstar-security-alert';
const ALERT_DISMISSED_KEY = 'netstar-alert-dismissed';

// Function to create the alert overlay
function createAlertOverlay(safetyScore, url) {
  // Remove any existing alert
  removeAlert();
  
  // Check if user has dismissed this alert for this URL
  const dismissedKey = `${ALERT_DISMISSED_KEY}-${url}`;
  const dismissed = sessionStorage.getItem(dismissedKey);
  console.log('[NetSTAR] Checking dismissal for URL:', url);
  console.log('[NetSTAR] Dismissal key:', dismissedKey);
  console.log('[NetSTAR] Dismissed status:', dismissed);
  if (dismissed === 'true') {
    console.log('[NetSTAR] Alert already dismissed, not showing');
    return; // Don't show if dismissed
  }

  // Determine alert level and styling
  let alertLevel = 'danger';
  let gradientFrom = '#ef4444'; // red-500
  let gradientTo = '#ec4899'; // pink-500
  let emoji = '⚠️';
  let alertTitle = 'Hold On!';
  let alertSubtitle = 'This website might not be safe';
  let alertMessage = 'We found signs of phishing and malware. We recommend leaving this site to protect your information.';
    alertMessage = 'We detected some security issues with this website. Proceed with caution.';
  if (safetyScore < 60) {
    alertLevel = 'danger';
    gradientFrom = '#ef4444'; // red-500
    gradientTo = '#ec4899'; // pink-500
    emoji = '⚠️';
    alertTitle = 'Hold On!';
    alertSubtitle = 'This website might not be safe';
    alertMessage = 'We found signs of phishing and malware. We recommend leaving this site to protect your information.';
  }

  // Create backdrop overlay (transparent, just for click handling)
  const backdrop = document.createElement('div');
  backdrop.id = `${ALERT_ID}-backdrop`;
  backdrop.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999998;
    background: transparent;
    animation: fadeIn 0.3s ease-out;
  `;
  backdrop.onclick = () => {
    // Close alert when backdrop is clicked
    sessionStorage.setItem(dismissedKey, 'true');
    console.log('[NetSTAR] Alert dismissed (backdrop click) for URL:', url);
    console.log('[NetSTAR] SessionStorage key set:', dismissedKey);
    removeAlert();
  };

  // Host element: only positioning, so page CSS cannot change our layout/size
  const alertHost = document.createElement('div');
  alertHost.id = ALERT_ID;
  alertHost.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 999999;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    max-width: 400px;
    width: calc(100vw - 40px);
    max-height: calc(100vh - 40px);
    font-size: 16px;
    line-height: 1.5;
    box-sizing: border-box !important;
  `;

  // Shadow DOM isolates our alert from page CSS (font-size, resets, etc.)
  const shadow = alertHost.attachShadow({ mode: 'closed' });

  const sheet = document.createElement('style');
  sheet.textContent = `
    :host {
      all: initial;
      display: block;
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      max-width: 400px;
      width: calc(100vw - 40px);
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      box-sizing: border-box;
      font-size: 16px;
      line-height: 1.5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    .alert-container {
      background: linear-gradient(to bottom right, ${gradientFrom}, ${gradientTo});
      color: white;
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      animation: slideInRight 0.3s ease-out;
      position: relative;
      box-sizing: border-box;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    .netstar-alert-content { width: 100%; box-sizing: border-box; }
    .netstar-alert-header { text-align: center; margin-bottom: 16px; }
    .netstar-alert-emoji {
      font-size: 48px;
      line-height: 1;
      margin-bottom: 8px;
      animation: bounce 1s infinite;
      display: block;
    }
    .netstar-alert-title {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .netstar-alert-subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .netstar-alert-message-box {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(4px);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .netstar-alert-message { font-size: 14px; }
    .netstar-alert-actions { display: flex; gap: 8px; }
    .netstar-alert-button {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      font-family: inherit;
      background: transparent;
      color: inherit;
      box-sizing: border-box;
    }
    .netstar-alert-button-primary {
      background: white;
      color: var(--netstar-alert-primary-color, #ef4444);
    }
    .netstar-alert-button-primary:hover {
      background: var(--netstar-alert-primary-hover, #fef2f2);
    }
    .netstar-alert-button-secondary {
      background: transparent;
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
    .netstar-alert-button-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .netstar-alert-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(0, 0, 0, 0.2);
      border: none;
      color: white;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
      padding: 6px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s;
      opacity: 0.9;
      z-index: 1;
      box-sizing: border-box;
    }
    .netstar-alert-close:hover {
      background: rgba(0, 0, 0, 0.3);
      opacity: 1;
      transform: scale(1.1);
    }
  `;
  shadow.appendChild(sheet);

  const alertContainer = document.createElement('div');
  alertContainer.className = 'alert-container';
  alertContainer.style.setProperty('--netstar-alert-primary-color', gradientFrom);
  alertContainer.style.setProperty('--netstar-alert-primary-hover', alertLevel === 'danger' ? '#fef2f2' : '#fffbeb');
  shadow.appendChild(alertContainer);

  // Create alert content - matching AlertsTab structure
  const content = document.createElement('div');
  content.className = 'netstar-alert-content';

  // Header section with emoji, title, and subtitle
  const header = document.createElement('div');
  header.className = 'netstar-alert-header';
  
  const emojiDiv = document.createElement('div');
  emojiDiv.className = 'netstar-alert-emoji';
  emojiDiv.textContent = emoji;
  
  const title = document.createElement('div');
  title.className = 'netstar-alert-title';
  title.textContent = alertTitle;
  
  const subtitle = document.createElement('div');
  subtitle.className = 'netstar-alert-subtitle';
  subtitle.textContent = alertSubtitle;
  
  header.appendChild(emojiDiv);
  header.appendChild(title);
  header.appendChild(subtitle);

  // Message box
  const messageBox = document.createElement('div');
  messageBox.className = 'netstar-alert-message-box';
  
  const message = document.createElement('div');
  message.className = 'netstar-alert-message';
  message.textContent = alertMessage;
  
  messageBox.appendChild(message);

  // Actions section
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'netstar-alert-actions';

  // Primary button (Take Me Back for danger, or View Details)
  const primaryBtn = document.createElement('button');
  primaryBtn.className = 'netstar-alert-button netstar-alert-button-primary';
  
  if (alertLevel === 'danger') {
    primaryBtn.textContent = 'Take Me Back';
    primaryBtn.onclick = () => {
      window.history.back();
      removeAlert();
    };
  } else {
    primaryBtn.textContent = 'View Details';
    primaryBtn.onclick = () => {
      chrome.runtime.sendMessage({ action: 'highlightExtension' });
      primaryBtn.textContent = 'Click extension icon ↑';
      setTimeout(() => {
        primaryBtn.textContent = 'View Details';
      }, 3000);
    };
  }

  // Secondary button (Tell Me More)
  const secondaryBtn = document.createElement('button');
  secondaryBtn.className = 'netstar-alert-button netstar-alert-button-secondary';
  secondaryBtn.textContent = 'Tell Me More';
  secondaryBtn.onclick = () => {
    chrome.runtime.sendMessage({ action: 'highlightExtension' });
    secondaryBtn.textContent = 'Click extension icon ↑';
    setTimeout(() => {
      secondaryBtn.textContent = 'Tell Me More';
    }, 3000);
  };

  actionsDiv.appendChild(primaryBtn);
  actionsDiv.appendChild(secondaryBtn);

  // Close button (positioned absolutely)
  const closeBtn = document.createElement('button');
  closeBtn.className = 'netstar-alert-close';
  closeBtn.innerHTML = '×';
  closeBtn.title = 'Dismiss alert';
  closeBtn.onclick = () => {
    sessionStorage.setItem(dismissedKey, 'true');
    console.log('[NetSTAR] Alert dismissed for URL:', url);
    console.log('[NetSTAR] SessionStorage key set:', dismissedKey);
    removeAlert();
  };

  // Assemble the content
  content.appendChild(header);
  content.appendChild(messageBox);
  content.appendChild(actionsDiv);
  alertContainer.appendChild(content);
  alertContainer.appendChild(closeBtn);

  // Prevent clicks inside the modal from closing it
  alertContainer.onclick = (e) => {
    e.stopPropagation();
  };

  // Insert backdrop and host (shadow root contains the styled alert) into body
  if (document.body) {
    document.body.appendChild(backdrop);
    document.body.appendChild(alertHost);

    setTimeout(() => {
      alertHost.style.top = '20px';
      alertHost.style.right = '20px';
    }, 0);
  } else {
    const observer = new MutationObserver((mutations, obs) => {
      if (document.body) {
        document.body.appendChild(backdrop);
        document.body.appendChild(alertHost);

        setTimeout(() => {
          alertHost.style.top = '20px';
          alertHost.style.right = '20px';
        }, 0);

        obs.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true });
  }
}

// Function to remove the alert
function removeAlert() {
  const existingAlert = document.getElementById(ALERT_ID);
  const existingBackdrop = document.getElementById(`${ALERT_ID}-backdrop`);
  if (existingAlert) {
    existingAlert.remove();
  }
  if (existingBackdrop) {
    existingBackdrop.remove();
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showAlert') {
    createAlertOverlay(request.safetyScore, request.url);
    sendResponse({ success: true });
  } else if (request.action === 'hideAlert') {
    removeAlert();
    sendResponse({ success: true });
  }
  return true;
});

// Clean up alert when navigating away
window.addEventListener('beforeunload', () => {
  removeAlert();
});

// Also handle SPA navigation (for single-page apps)
let lastUrl = location.href;

// Use multiple methods to detect URL changes for better reliability
function checkUrlChange() {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    const previousUrl = lastUrl;
    lastUrl = currentUrl;
    
    // Only clear the dismissal for the previous URL, not all dismissals
    if (previousUrl) {
      const previousDismissedKey = `${ALERT_DISMISSED_KEY}-${previousUrl}`;
      sessionStorage.removeItem(previousDismissedKey);
    }
    removeAlert();
  }
}

// Listen for popstate (back/forward navigation)
window.addEventListener('popstate', checkUrlChange);

// Listen for hashchange
window.addEventListener('hashchange', checkUrlChange);

// Use MutationObserver as a fallback, but throttle it
let mutationTimeout;
new MutationObserver(() => {
  // Throttle checks to avoid excessive clearing
  clearTimeout(mutationTimeout);
  mutationTimeout = setTimeout(checkUrlChange, 100);
}).observe(document, { subtree: true, childList: true });

