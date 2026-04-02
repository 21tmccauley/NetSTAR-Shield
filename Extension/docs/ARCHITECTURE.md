# NetSTAR Extension Architecture

This document describes the current architecture of the NetSTAR Shield browser extension as implemented in this repository.

## System Overview

```mermaid
graph LR
  subgraph browserExtension [BrowserExtension_(MV3)]
    direction TB
    popupUI[PopupUI_(React)]
    serviceWorker[BackgroundServiceWorker]
    contentScript[ContentScript_(InPageOverlay)]

    popupUI <-->|"chrome.runtime.sendMessage"| serviceWorker
    contentScript <-->|"chrome.runtime.sendMessage"| serviceWorker
  end

  subgraph browserPlatform [BrowserPlatform]
    direction TB
    tabsApi[Tabs_(tabs.onUpdated/onActivated)]
    actionIcon[ActionIcon_(chrome.action)]
    notificationsApi[Notifications_(optional_permission)]
    storageLocal[chrome.storage.local_(cache,recentScans,soft_toggles)]
    storageSync[chrome.storage.sync_(theme,textSize)]
  end

  subgraph serverHost [ServerHost]
    direction TB
    nodeServer[NodeExpressServer_(GET_/scan)]
    pyEngine[PythonScoringEngine_(scoring_main.py)]
  end

  subgraph externalServices [ExternalServices]
    direction TB
    netstarApi[w4.netstar.dev_API]
  end

  tabsApi --> serviceWorker
  serviceWorker -->|"update_icon"| actionIcon
  serviceWorker -->|"read/write"| storageLocal
  popupUI -->|"read/write_preferences"| storageSync
  serviceWorker -->|"may_notify"| notificationsApi
  serviceWorker -->|"fetch_(HTTP)"| nodeServer
  nodeServer -->|"spawn_subprocess"| pyEngine
  pyEngine -->|"curl_(HTTPS)"| netstarApi
```

## Data Flow Architecture

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant ServiceWorker as BackgroundServiceWorker
  participant StorageLocal as chrome.storage.local
  participant NodeServer as NodeExpressServer
  participant PyEngine as PythonScoringEngine
  participant NetSTAR as w4.netstar.dev
  participant ActionIcon as chrome.action
  participant Content as ContentScript
  participant Notify as chrome.notifications
  participant Popup as PopupUI_(React)

  User->>Browser: Navigate_to_URL
  Browser->>ServiceWorker: tabs.onUpdated(status=complete)

  ServiceWorker->>StorageLocal: get(cacheKey_for_domain)
  alt cache_hit_and_fresh
    StorageLocal-->>ServiceWorker: cached_result
  else cache_miss_or_expired
    ServiceWorker->>NodeServer: GET_/scan?domain=example.com
    NodeServer->>PyEngine: spawn(scoring_main.py_-t_example.com)
    PyEngine->>NetSTAR: curl_concurrent(cert,dns,hval,mail,rdap,firewall)
    NetSTAR-->>PyEngine: JSON_responses
    PyEngine-->>NodeServer: stdout(JSON_scores+aggregatedScore)
    NodeServer-->>ServiceWorker: JSON({safetyScore,indicators,...})
    ServiceWorker->>StorageLocal: set(cacheKey,result)
  end

  ServiceWorker->>ActionIcon: setIcon(based_on_score)
  ServiceWorker->>StorageLocal: updateRecentScans(url,score)

  opt risky_score
    ServiceWorker->>Content: sendMessage(showAlert)
    ServiceWorker->>Notify: create(notification)_if_enabled
  end

  Note over User,Popup: Later_user_opens_popup
  User->>Popup: Open_extension_popup
  Popup->>ServiceWorker: sendMessage(getCurrentTab)
  ServiceWorker-->>Popup: {url,title,securityData}
  Popup->>Popup: Render_tabs_and_indicators
```

