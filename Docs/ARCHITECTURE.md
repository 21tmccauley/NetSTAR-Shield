# NetSTAR Shield — System Architecture

This document captures the **big concepts** of how the system works end-to-end.

## Diagram 1 — High-Level System

```mermaid
flowchart LR
  user[User] --> browser[Browser]

  subgraph ext[BrowserExtension]
    ui[PopupUI]
    sw[ServiceWorker]
    cs[ContentScript]
    ui <--> sw
    cs <--> sw
  end

  subgraph host[ServerHost]
    api[NodeServer]
    scorer[PythonScorer]
    api --> scorer
  end

  ext --> api
  scorer --> external[ExternalAPI]
```

## Diagram 2 — High-Level Scan Flow

```mermaid
sequenceDiagram
  participant User
  participant Browser
  participant SW as ServiceWorker
  participant Cache as LocalCache
  participant Server as NodeServer
  participant Scorer as PythonScorer
  participant API as ExternalAPI

  User->>Browser: Navigate
  Browser->>SW: PageLoaded
  SW->>Cache: Check
  alt CacheHit
    Cache-->>SW: Result
  else CacheMiss
    SW->>Server: ScanRequest
    Server->>Scorer: RunScoring
    Scorer->>API: FetchSignals
    API-->>Scorer: Signals
    Scorer-->>Server: Scores
    Server-->>SW: Result
    SW->>Cache: Store
  end
  SW-->>Browser: UpdateIconAndWarnIfRisky
```

## Diagram 3 — Deployment (Big Picture)

```mermaid
flowchart TB
  dev[Developer] --> repo[Repo]
  repo --> ci[CI]
  dev --> server[RemoteServer]
  server --> node[NodeServer]
  server --> py[PythonScorer]
  py --> api[ExternalAPI]
  dev --> ext[BrowserExtensionBuild]
```

