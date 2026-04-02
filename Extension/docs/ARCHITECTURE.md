# NetSTAR Extension Architecture

This document describes the current architecture of the NetSTAR Shield browser extension as implemented in this repository.

## System Overview

```mermaid
flowchart LR
  subgraph ext[BrowserExtension]
    ui[PopupUI]
    sw[ServiceWorker]
    cs[ContentScript]
    ui <--> sw
    cs <--> sw
  end

  sw --> server[NodeServer]
  server --> scorer[PythonScorer]
  scorer --> api[ExternalAPI]
```

## Data Flow Architecture

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant SW as ServiceWorker
  participant Server as NodeServer

  User->>Browser: Navigate
  Browser->>SW: AutoScan
  SW->>Server: ScanRequest
  Server-->>SW: ScanResult
```

