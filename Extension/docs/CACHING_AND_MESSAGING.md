# Caching and Messaging Architecture

This document explains the evolution of the caching system and message passing mechanism in the NetSTAR extension, including the initial issues and how they were resolved.

## Table of Contents
1. [Initial Implementation](#initial-implementation)
2. [Caching Issues](#caching-issues)
3. [Message Passing Issues](#message-passing-issues)
4. [Final Solution](#final-solution)
5. [Key Takeaways](#key-takeaways)

---

## Initial Implementation

### How It Worked

The extension initially had a simple caching and messaging setup:

#### Caching System
```javascript
// Simple cache lookup
async function getCachedOrScan(url) {
  const cacheKey = `scan_${encodeURIComponent(url)}`;
  const data = await chrome.storage.local.get(cacheKey);
  
  if (data[cacheKey] && (Date.now() - data[cacheKey].timestamp < CACHE_DURATION)) {
    return data[cacheKey]; // Return cached result
  }
  
  // Perform new scan and cache it
  const result = await performSecurityScan(url);
  await chrome.storage.local.set({ [cacheKey]: result });
  return result;
}
```

#### Message Passing
```javascript
// Background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await getCachedOrScan(tabs[0].url);
    sendResponse({ url: tabs[0].url, securityData: result });
  }
  return true; // Keep channel open for async response
});

// Popup (HomeTab)
chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
  if (response.securityData) {
    setSafetyScore(response.securityData.safetyScore);
  }
});
```

### What Was Working
- ✅ Caching was storing scan results in `chrome.storage.local`
- ✅ Background script was successfully retrieving cached data
- ✅ Background script was sending data to the popup

### What Was Broken
- ❌ Popup was always showing default score (87) instead of cached scores
- ❌ Cache entries existed but weren't being displayed

---

## Caching Issues

### Problem 1: Tab Selection

**Issue**: When the popup opened, `chrome.tabs.query({ active: true, currentWindow: true })` was returning the extension popup itself or Chrome internal pages (like `chrome://extensions`), not the actual browser tab the user was viewing.

**Why It Happened**: 
- The popup window becomes the "active" tab when it opens
- Chrome internal pages don't have HTTP/HTTPS URLs
- The background script would try to scan invalid URLs and return `null`

**Solution**: 
```javascript
// First try active tab
const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
let targetTab = activeTabs[0];

// If active tab is not a valid webpage, search all tabs
if (!targetTab || !targetTab.url || !/^https?:\/\//i.test(targetTab.url) ||
    targetTab.url.startsWith('chrome-extension://') || 
    targetTab.url.startsWith('chrome://')) {
  const allTabs = await chrome.tabs.query({ currentWindow: true });
  for (const tab of allTabs) {
    if (tab.url && /^https?:\/\//i.test(tab.url) &&
        !tab.url.startsWith('chrome-extension://') && 
        !tab.url.startsWith('chrome://')) {
      targetTab = tab;
      break;
    }
  }
}
```

### Problem 2: URL Normalization (Initially Added, Then Removed)

**Issue**: URLs like `https://example.com` and `https://example.com/` would create separate cache entries, even though they represent the same page.

**Initial Solution**: We added URL normalization to handle:
- Trailing slashes
- Default ports (80, 443)
- Lowercase hostnames

**Why It Was Removed**: 
- Added complexity without significant benefit
- Most URLs are already consistent
- Simplified code is easier to maintain
- If needed, normalization can be added back later

**Current Approach**: Use URLs exactly as they come from the browser. This means `https://example.com` and `https://example.com/` are cached separately, which is acceptable for most use cases.

---

## Message Passing Issues

### The Core Problem: Manifest V3 Async Message Handling

**Issue**: In Manifest V3, when a message handler performs async operations (like `await getCachedOrScan(url)`), the message port closes before `sendResponse()` can be called, causing the error:

```
Error: The message port closed before a response was received
```

### Why This Happens

1. **Popup sends message**: `chrome.runtime.sendMessage({ action: 'getCurrentTab' }, callback)`
2. **Background receives message**: Handler starts async work
3. **Port closes immediately**: Chrome closes the message port because no response was sent synchronously
4. **Callback fires with error**: The callback in the popup is called with "message port closed" error
5. **Async work completes**: Background script finishes and tries to call `sendResponse()`, but it's too late

### Timeline of the Problem

```
Time 0ms:  Popup sends message
Time 1ms:  Background receives message, starts async work
Time 2ms:  Chrome closes message port (no sync response)
Time 3ms:  Popup callback fires with "port closed" error ❌
Time 50ms: Background async work completes
Time 51ms: Background calls sendResponse() (but port is already closed) ❌
```

### Initial Attempts to Fix

#### Attempt 1: Return `true` to Keep Channel Open
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    const result = await getCachedOrScan(url);
    sendResponse(result);
  })();
  return true; // Keep channel open
});
```

**Problem**: The callback still fires with an error before the async work completes, even though `sendResponse()` eventually works.

#### Attempt 2: Ignore "Port Closed" Error
```javascript
chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
  if (chrome.runtime.lastError) {
    const errorMsg = chrome.runtime.lastError.message;
    if (errorMsg.includes('message port closed')) {
      // Wait for response... but callback won't be called again!
      return;
    }
  }
  // Handle response
});
```

**Problem**: The callback is only called once. Even if we ignore the error, we never receive the actual response.

---

## Final Solution

### The Message Listener Pattern

Instead of relying on the callback from `sendMessage()`, we use a **message listener pattern** where:

1. Popup sends a request with a unique `requestId`
2. Popup sets up a message listener to receive the response
3. Background processes the request asynchronously
4. Background sends the response as a **new message** (not via `sendResponse()`)
5. Popup's message listener receives the response

### Implementation

#### Popup Side (HomeTab.jsx)
```javascript
const response = await new Promise((resolve, reject) => {
  let resolved = false;
  const requestId = `getCurrentTab_${Date.now()}_${Math.random()}`;
  
  // Set up message listener for the response
  const messageListener = (message) => {
    if (message.action === 'getCurrentTabResponse' && message.requestId === requestId) {
      chrome.runtime.onMessage.removeListener(messageListener);
      if (!resolved) {
        resolved = true;
        resolve(message.data);
      }
      return true;
    }
  };
  
  chrome.runtime.onMessage.addListener(messageListener);
  
  // Send the request
  chrome.runtime.sendMessage({ 
    action: 'getCurrentTab',
    requestId: requestId 
  }, (response) => {
    // Handle synchronous response (if any)
    if (response && typeof response === 'object' && response.url !== undefined) {
      chrome.runtime.onMessage.removeListener(messageListener);
      if (!resolved) {
        resolved = true;
        resolve(response);
      }
      return;
    }
    
    // If port closed error, wait for message listener
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message;
      if (errorMsg.includes('message port closed')) {
        // Expected - wait for message listener
        return;
      }
      // Handle other fatal errors
      if (errorMsg.includes('Receiving end does not exist')) {
        chrome.runtime.onMessage.removeListener(messageListener);
        if (!resolved) {
          resolved = true;
          reject(chrome.runtime.lastError);
        }
      }
    }
  });
  
  // Timeout fallback
  setTimeout(() => {
    if (!resolved) {
      chrome.runtime.onMessage.removeListener(messageListener);
      resolved = true;
      resolve(null);
    }
  }, 3000);
});
```

#### Background Side (background.js)
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentTab') {
    // If requestId provided, use async message pattern
    if (request.requestId) {
      (async () => {
        // ... async work ...
        const result = await getCachedOrScan(url);
        
        // Send response as a new message
        chrome.runtime.sendMessage({
          action: 'getCurrentTabResponse',
          requestId: request.requestId,
          data: { url, title, securityData: result }
        }).catch(() => {
          // Silently ignore - popup might have closed
        });
      })();
      return false; // Don't keep channel open
    } else {
      // Synchronous pattern - keep channel open
      (async () => {
        // ... async work ...
        sendResponse({ url, title, securityData: result });
      })();
      return true; // Keep channel open
    }
  }
});
```

### How It Works

```
Time 0ms:  Popup sends message with requestId
Time 1ms:  Popup sets up message listener
Time 2ms:  Background receives message, starts async work
Time 3ms:  Background returns false (doesn't keep channel open)
Time 4ms:  Popup callback fires with "port closed" (expected, ignored)
Time 50ms: Background async work completes
Time 51ms: Background sends NEW message with response
Time 52ms: Popup message listener receives response ✅
Time 53ms: Popup updates state with cached score ✅
```

### Key Benefits

1. **Reliable**: Message listener pattern works regardless of async timing
2. **No Errors**: "Port closed" error is expected and handled gracefully
3. **Backward Compatible**: Still supports synchronous responses (when no requestId)
4. **Clean**: Properly handles cleanup (removes listeners, prevents multiple resolutions)

---

## Key Takeaways

### What We Learned

1. **Manifest V3 requires different patterns**: The callback-based message passing doesn't work well with async operations
2. **Message listeners are more reliable**: Using `chrome.runtime.onMessage.addListener()` is the preferred pattern for async responses
3. **Tab selection matters**: Always validate that you're getting the correct tab, not the popup or internal pages
4. **Simplicity over optimization**: URL normalization added complexity without significant benefit - simpler is better

### Best Practices

1. **Always use requestId for async operations**: This makes it clear you're using the async message pattern
2. **Clean up listeners**: Always remove message listeners when done to prevent memory leaks
3. **Handle timeouts**: Add timeout fallbacks to prevent hanging promises
4. **Validate tab URLs**: Check that tabs are valid HTTP/HTTPS pages before processing
5. **Return correct values**: Return `false` when using message pattern, `true` when using `sendResponse()`

### Current Cache Configuration

- **Duration**: 5 minutes (`CACHE_DURATION = 1000 * 5 * 60`)
- **Storage**: `chrome.storage.local`
- **Key Format**: `scan_${encodeURIComponent(url)}`
- **No Normalization**: URLs are cached exactly as received

---

## Summary

The initial implementation had two main issues:
1. **Caching worked but wasn't displayed** - due to tab selection and message passing problems
2. **Message passing failed** - due to Manifest V3's async message handling limitations

The solution uses a **message listener pattern** that:
- Sends requests with unique IDs
- Listens for responses via message listeners
- Handles "port closed" errors gracefully
- Properly cleans up resources

This ensures cached scores are reliably retrieved and displayed in the popup, regardless of async timing or tab selection issues.

