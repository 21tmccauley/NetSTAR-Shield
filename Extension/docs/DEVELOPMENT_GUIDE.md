# NetSTAR Extension - Development Guide

This guide explains how the NetSTAR browser extension works, how files interact, and how to develop on this project.

## Table of Contents

1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [Key Concepts](#key-concepts)
7. [Development Workflow](#development-workflow)
8. [Extension Lifecycle](#extension-lifecycle)
9. [Adding New Features](#adding-new-features)

---

## Application Overview

NetSTAR is a Chrome extension (Manifest V3) that provides real-time security analysis for websites. The extension consists of two main parts:

1. **Popup Interface** - A React-based UI that shows when users click the extension icon
2. **Background Service Worker** - A JavaScript service worker that monitors tabs and performs security scans

### Key Features
- **Real-time Security Scoring** - Analyzes current website and displays safety score (0-100)
- **Tab-Based Navigation** - Home, Scan, Alerts, and Settings tabs
- **Interactive Tour** - Guided walkthrough for new users
- **Theme Support** - Light/dark mode toggle
- **Dynamic Icons** - Extension icon changes based on website security status

---

## Architecture

### Tech Stack

- **React 19** - UI framework with modern hooks
- **Vite 5** - Build tool and dev server with HMR
- **@crxjs/vite-plugin** - Enables hot module reloading for Chrome extensions
- **Tailwind CSS 4** - Utility-first CSS framework
- **Chrome Extension API (Manifest V3)** - Extension functionality
- **shadcn/ui** - Accessible component library
- **Lucide React** - Icon library

### Extension Structure

```
┌─────────────────────────────────────────────────┐
│           Browser Tab (User's Website)          │
└───────────────────┬─────────────────────────────┘
                    │
                    │ Chrome Extension API
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌─────────▼──────────┐
│ Background.js  │    │   Popup.jsx        │
│ (Service       │    │   (React UI)       │
│  Worker)       │    │                    │
│                │    │  ┌───────────────┐ │
│ - Monitors     │◄───┤  │ Tab Components│ │
│   tabs         │    │  │ - HomeTab     │ │
│ - Performs     │    │  │ - ScanTab     │ │
│   scans        │    │  │ - AlertsTab   │ │
│ - Updates icon │    │  │ - DetailsTab  │ │
│                │    │  └───────────────┘ │
└────────────────┘    └────────────────────┘
```

---

## File Structure

### Entry Points

```
src/
├── manifest.json          # Extension configuration (permissions, icons, etc.)
├── index.html             # HTML entry point for popup
├── popup.jsx              # Main React component (renders entire popup)
├── background.js          # Service worker (runs in background)
└── index.css              # Global styles (Tailwind + custom theme)
```

### Component Hierarchy

```
popup.jsx (Root)
│
├── Header (Title, Theme Toggle, Settings Button)
│
├── Tab Navigation
│   ├── HomeTab
│   │   ├── Security Score Display
│   │   └── Security Indicators (expandable list)
│   │
│   ├── ScanTab
│   │   ├── URL Input
│   │   └── Recent Scans
│   │
│   ├── AlertsTab
│   │   └── Security Alert Cards
│   │
│   ├── DetailsTab (shown when indicator clicked)
│   │   ├── Indicator Details
│   │   └── Educational Content
│   │
│   └── SettingsTab
│       └── Settings Sections
│
└── Tour Component (overlay when active)
```

### Directory Organization

```
src/
├── components/
│   ├── tabs/              # Tab-specific components
│   │   ├── HomeTab.jsx
│   │   ├── ScanTab.jsx
│   │   ├── AlertsTab.jsx
│   │   ├── DetailsTab.jsx
│   │   └── SettingsTab.jsx
│   │
│   ├── ui/                 # Reusable UI components (shadcn/ui)
│   │   ├── button.jsx
│   │   ├── badge.jsx
│   │   ├── input.jsx
│   │   └── ...
│   │
│   ├── Tour.jsx           # Guided tour component
│   └── ThemeToggleIcon.jsx # Reusable theme icon
│
└── lib/                    # Utility functions and data
    ├── constants.js        # App-wide constants (indicators, scans)
    ├── educationalContent.js # Educational content for indicators
    ├── securityUtils.js    # Security-related utilities
    ├── themeUtils.js       # Theme styling utilities
    └── utils.js           # General utilities (cn helper)
```

---

## Component Architecture

### 1. popup.jsx - Root Component

**Responsibilities:**
- Manages application state (active tab, theme mode, tour state)
- Handles tab navigation
- Coordinates between tabs and tour
- Renders header and tab navigation

**Key State:**
```javascript
- mode: "light" | "dark"           // Theme mode
- activeTab: string                 // Current tab ID
- selectedIndicator: object | null  // Selected security indicator
- isTourActive: boolean            // Whether tour is running
- forceShowIndicators: boolean     // Controls indicator expansion (for tour)
```

**Component Flow:**
```
User clicks tab → setActiveTab() → Re-render → Show appropriate Tab component
User clicks indicator → onNavigate("details", data) → Show DetailsTab
User starts tour → setIsTourActive(true) → Tour component renders overlay
```

### 2. Tab Components

#### HomeTab.jsx
- Displays current website's security score
- Shows expandable list of security indicators
- Fetches current tab URL from background script
- Allows navigation to DetailsTab when indicator clicked

**Data Flow:**
```
1. Component mounts
2. Sends message to background.js: { action: 'getCurrentTab' }
3. Background responds with { url, securityData }
4. Component updates state with safety score and URL
5. Renders indicators from DEFAULT_INDICATOR_DATA (constants.js)
```

#### ScanTab.jsx
- Manual URL scanning interface
- Shows scanning animation
- Displays recent scans from constants

#### DetailsTab.jsx
- Shows detailed information about a selected security indicator
- Displays educational content (from `lib/educationalContent.js`)
- Uses status utilities to determine colors and styling

#### AlertsTab.jsx
- Displays high-priority security alerts
- Simple card-based layout

#### SettingsTab.jsx
- Settings and preferences
- Access to guided tour

### 3. Tour.jsx

**Purpose:** Interactive guided walkthrough

**How it works:**
1. Defines array of tour steps (each step has tab, title, description, highlightId, position)
2. Manages current step index
3. Auto-navigates to required tab for each step
4. Highlights elements using CSS or spotlight overlay
5. Calculates spotlight position for button highlights dynamically

**Key Features:**
- Auto-navigation between tabs
- Element highlighting (CSS shadow for regular elements, spotlight overlay for buttons)
- Step counter and progress bar
- Back/Next/Skip controls

**Integration:**
- Receives `currentTab` prop to know which tab is active
- Calls `onNavigate()` to switch tabs as needed
- Calls `onStepChange()` to notify parent of step changes (for auto-expanding indicators)

### 4. Background.js (Service Worker)

**Responsibilities:**
- Monitors tab updates
- Performs security scans (currently simulated)
- Updates extension icon based on safety score
- Responds to messages from popup
- Manages extension storage

**Key Functions:**
```javascript
- updateIcon(tabId, safetyScore)     // Updates extension icon
- performSecurityScan(url)          // Simulates security scan
```

**Event Listeners:**
1. `chrome.runtime.onInstalled` - Sets default icon on install
2. `chrome.tabs.onUpdated` - Scans page when tab finishes loading
3. `chrome.tabs.onActivated` - Updates icon when user switches tabs
4. `chrome.runtime.onMessage` - Handles messages from popup

**Icon Thresholds:**
```javascript
- Score >= 75: Safe (green icon)
- Score >= 60: Warning (yellow icon)
- Score < 60:  Danger (red icon)
```

**Message API:**
- `{ action: 'getCurrentTab' }` → Returns current tab URL and security data
- `{ action: 'scanUrl', url: string }` → Performs scan and returns results

---

## Data Flow

### Example: User Opens Extension on a Website

```
1. User clicks extension icon
   └── Browser opens popup (index.html)

2. popup.jsx mounts
   └── Sets initial state (mode: "light", activeTab: "home")

3. HomeTab renders
   └── Sends message to background.js: { action: 'getCurrentTab' }

4. background.js receives message
   ├── Queries active tab: chrome.tabs.query()
   ├── Retrieves cached scan data from storage
   └── Sends response: { url, securityData }

5. HomeTab receives response
   ├── Updates currentUrl state
   ├── Updates safetyScore state
   └── Renders UI with data

6. User clicks a security indicator
   └── Calls onNavigate("details", indicatorData)

7. popup.jsx handles navigation
   ├── Sets selectedIndicator state
   ├── Sets activeTab to "details"
   └── DetailsTab renders with indicator data

8. DetailsTab displays
   ├── Gets educational content from educationalContent.js
   ├── Determines status using securityUtils.js
   ├── Gets styling using themeUtils.js
   └── Renders detailed view
```

### Example: Tab Auto-Scan Flow

```
1. User navigates to a new website
   └── Chrome fires chrome.tabs.onUpdated event

2. background.js receives event
   ├── Checks if tab.status === 'complete'
   ├── Calls performSecurityScan(tab.url)
   └── Stores result in chrome.storage.local

3. performSecurityScan() runs
   ├── Generates/simulates safety score
   └── Returns security data object

4. updateIcon() called with safety score
   ├── Determines icon state (safe/warning/danger)
   └── Updates extension icon using chrome.action.setIcon()

5. User clicks extension icon
   └── Popup retrieves cached scan data (as shown above)
```

---

## Key Concepts

### 1. Theme System

The app uses a centralized theme system:

**Implementation:**
- Theme mode stored in `popup.jsx` state
- Passed as `mode` prop to all components
- CSS uses Tailwind's dark mode variant (`.dark` class)
- Theme utilities in `lib/themeUtils.js`

**Theme Helper:**
```javascript
import { themeValue } from '@/lib/themeUtils'

// Instead of: mode === "dark" ? "dark-class" : "light-class"
const className = themeValue(mode, "light-class", "dark-class")
```

**Custom Properties:**
- Brand colors defined in `index.css` as CSS custom properties
- Uses OKLCH color space for better color interpolation
- Separate light/dark mode color definitions

### 2. Security Scoring System

**Status Levels:**
```javascript
- excellent (score >= 90)
- good (score >= 75)
- moderate (score >= 60)
- poor (score < 60)
```

**Utilities:**
- `getStatusFromScore(score)` - Converts score to status
- `getColorClasses(status)` - Returns color classes for status
- `getStatusInfo(status)` - Returns complete styling info

**Usage:**
```javascript
const status = getStatusFromScore(safetyScore)
const colors = getColorClasses(status)
// Returns: { bg, text, gradient }
```

### 3. Constants System

**Purpose:** Centralized configuration for easy updates

**Files:**
- `lib/constants.js` - App-wide constants
  - `DEFAULT_INDICATOR_DATA` - Security indicator definitions
  - `DEFAULT_RECENT_SCANS` - Demo scan history

- `lib/educationalContent.js` - Educational content
  - Large object with explanations for each indicator type
  - Exported as `EDUCATIONAL_CONTENT` object

**Benefits:**
- Easy to update indicator scores
- Single source of truth for data
- Maintainable content management

### 4. Component Patterns

**Tab Components:**
- Receive `mode` prop for theme
- Receive callback props for navigation (`onNavigate`, `onBack`)
- Self-contained logic and state
- Minimal props (just what's needed)

**Reusable Components:**
- `ThemeToggleIcon` - Theme-aware icon component
- UI components in `components/ui/` - shadcn/ui components

**Utility Functions:**
- Extract repeated logic to `lib/` files
- Pure functions when possible
- Clear naming and documentation

### 5. Chrome Extension API Usage

**Key APIs Used:**

1. **chrome.action** - Extension icon and popup
   ```javascript
   chrome.action.setIcon({ path: {...} })
   ```

2. **chrome.tabs** - Tab information
   ```javascript
   chrome.tabs.query({ active: true, currentWindow: true })
   chrome.tabs.get(tabId)
   ```

3. **chrome.storage.local** - Data persistence
   ```javascript
   chrome.storage.local.set({ key: value })
   chrome.storage.local.get(['key'])
   ```

4. **chrome.runtime** - Messaging
   ```javascript
   chrome.runtime.sendMessage({ action: '...' })
   chrome.runtime.onMessage.addListener(...)
   ```

---

## Development Workflow

### Prerequisites

```bash
# Node.js 16+ required
node --version

# Install dependencies
npm install
```

### Development Commands

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Loading Extension in Browser

1. Run `npm run dev` (creates `dist/` folder)
2. Open `chrome://extensions/` or `edge://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `dist/` folder

### Hot Module Reloading

The `@crxjs/vite-plugin` enables HMR for extensions:
- Changes to React components automatically update
- No need to reload extension manually
- Background script changes require extension reload

### File Watching

Vite watches for changes in:
- `src/**/*.jsx`, `src/**/*.js`
- `src/**/*.css`
- `src/manifest.json`

Changes trigger:
- Component re-render (UI files)
- Extension rebuild (manifest, background)

---

## Extension Lifecycle

### Installation

1. User installs extension
2. `chrome.runtime.onInstalled` fires
3. Background script:
   - Sets default icon
   - Initializes storage with default values
   - Logs installation

### Tab Navigation

1. User navigates to website
2. `chrome.tabs.onUpdated` fires when page loads
3. Background script:
   - Performs security scan
   - Updates extension icon
   - Caches scan result

### Tab Switching

1. User switches to different tab
2. `chrome.tabs.onActivated` fires
3. Background script:
   - Checks for cached scan data
   - Updates icon if cached, or performs new scan

### Popup Opening

1. User clicks extension icon
2. Browser opens popup (`index.html`)
3. React app initializes (`popup.jsx`)
4. Active tab requests data from background
5. Background responds with cached or fresh data
6. UI renders with security information

---

## Adding New Features

### Adding a New Tab

1. **Create Tab Component**
   ```jsx
   // src/components/tabs/NewTab.jsx
   export function NewTab({ mode, onNavigate }) {
     return <div>New Tab Content</div>
   }
   ```

2. **Import in popup.jsx**
   ```jsx
   import { NewTab } from "@/components/tabs/NewTab"
   ```

3. **Add Tab Definition**
   ```jsx
   const tabs = [
     // ... existing tabs
     { id: "new", label: "New", icon: IconComponent }
   ]
   ```

4. **Add Tab Rendering**
   ```jsx
   {activeTab === "new" && <NewTab mode={mode} />}
   ```

### Adding a New Security Indicator

1. **Add to constants.js**
   ```javascript
   export const DEFAULT_INDICATOR_DATA = [
     // ... existing indicators
     { id: "new-metric", name: "New Metric", score: 85 }
   ]
   ```

2. **Add Icon Mapping (if needed)**
   ```javascript
   // In HomeTab.jsx
   const INDICATOR_ICONS = {
     // ... existing mappings
     "new-metric": NewIconComponent
   }
   ```

3. **Add Educational Content**
   ```javascript
   // In lib/educationalContent.js
   export const EDUCATIONAL_CONTENT = {
     // ... existing content
     "new-metric": [
       { title: "...", description: "..." }
     ]
   }
   ```

### Adding a New Tour Step

1. **Update steps array in Tour.jsx**
   ```javascript
   const steps = [
     // ... existing steps
     {
       tab: "home",
       title: "New Feature",
       description: "Explanation...",
       highlightId: "element-id", // or null
       position: "bottom"
     }
   ]
   ```

### Adding Background Functionality

1. **Add to background.js**
   ```javascript
   // New event listener
   chrome.someAPI.onEvent.addListener((data) => {
     // Handle event
   })

   // New message handler
   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     if (request.action === 'newAction') {
       // Handle action
       sendResponse({ result: '...' })
     }
   })
   ```

2. **Call from Popup**
   ```javascript
   chrome.runtime.sendMessage(
     { action: 'newAction', data: {...} },
     (response) => {
       // Handle response
     }
   )
   ```

### Styling Guidelines

1. **Use Tailwind classes** - Prefer utility classes
2. **Theme-aware** - Always support light/dark mode
   ```jsx
   className={mode === "dark" ? "dark-class" : "light-class"}
   // Or use themeValue helper
   className={themeValue(mode, "light", "dark")}
   ```
3. **Use brand colors** - Use `brand-*` classes for consistency
4. **Responsive** - Popup is fixed size (500px), but consider smaller screens

---

## Common Patterns

### Getting Current Tab Data

```javascript
// In component
useEffect(() => {
  chrome.runtime.sendMessage(
    { action: 'getCurrentTab' },
    (response) => {
      if (response?.url) {
        setCurrentUrl(response.url)
      }
      if (response?.securityData) {
        setSecurityData(response.securityData)
      }
    }
  )
}, [])
```

### Navigation Between Views

```javascript
// Navigate to details
onNavigate("details", indicatorData)

// Navigate to tab
setActiveTab("scan")

// Go back
onBack() // Sets activeTab to "home"
```

### Theme-Aware Styling

```javascript
// Class names
className={`${mode === "dark" ? "bg-slate-900" : "bg-white"}`}

// Using theme helper
import { themeValue } from '@/lib/themeUtils'
className={themeValue(mode, "bg-white", "bg-slate-900")}
```

### Status-Based Styling

```javascript
import { getStatusFromScore, getColorClasses } from '@/lib/securityUtils'

const status = getStatusFromScore(score)
const colors = getColorClasses(status)

// Use colors
<div className={colors.bg}>
  <Icon className={colors.text} />
</div>
```

---

## Debugging Tips

### Chrome DevTools

1. **Popup DevTools**
   - Right-click extension icon → "Inspect popup"
   - Standard React DevTools work

2. **Background Script DevTools**
   - Go to `chrome://extensions/`
   - Find extension → Click "service worker" link
   - Opens DevTools for background script

3. **View Storage**
   - In background DevTools → Application tab → Storage
   - View `chrome.storage.local` data

### Common Issues

**Icon not updating:**
- Check background.js console for errors
- Verify icon paths in `src/icons/` exist
- Ensure `chrome.action.setIcon` is called correctly

**Popup not showing data:**
- Check popup DevTools console for errors
- Verify message passing between popup and background
- Check that background script is running (service worker status)

**Styles not applying:**
- Ensure Tailwind is building correctly
- Check for class name typos
- Verify dark mode class is on root element

**Tour highlighting not working:**
- Check element IDs match `highlightId` in steps
- Verify element exists when tour step renders
- Check console for JavaScript errors

---

## Project Structure Reference

```
extension-proto-1/
├── src/                          # Source code
│   ├── manifest.json             # Extension manifest
│   ├── index.html                # Popup HTML
│   ├── popup.jsx                 # Root React component
│   ├── background.js             # Service worker
│   ├── index.css                 # Global styles
│   │
│   ├── components/               # React components
│   │   ├── tabs/                 # Tab views
│   │   ├── ui/                   # Reusable UI components
│   │   ├── Tour.jsx              # Guided tour
│   │   └── ThemeToggleIcon.jsx  # Theme icon
│   │
│   ├── lib/                      # Utilities and data
│   │   ├── constants.js         # App constants
│   │   ├── educationalContent.js # Educational data
│   │   ├── securityUtils.js     # Security helpers
│   │   ├── themeUtils.js         # Theme helpers
│   │   └── utils.js             # General utilities
│   │
│   └── icons/                    # Extension icons
│
├── dist/                         # Build output (generated)
├── docs/                         # Documentation
├── vite.config.js                # Vite configuration
├── package.json                  # Dependencies
└── README.md                     # Project overview
```

---

## Next Steps for Developers

1. **Read the Code**
   - Start with `popup.jsx` to understand structure
   - Review `HomeTab.jsx` for data flow example
   - Check `background.js` for extension API usage

2. **Run the Extension**
   - Follow setup instructions
   - Load extension in browser
   - Test each tab and feature

3. **Explore Components**
   - Check `components/tabs/` for tab implementations
   - Review `lib/` for utility functions
   - Understand `Tour.jsx` for interactive features

4. **Make Small Changes**
   - Update indicator scores in `constants.js`
   - Modify styling in components
   - Add new tour steps

5. **Understand Data Flow**
   - Trace data from background → popup → components
   - Understand message passing
   - Review storage usage

---

## Additional Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [React 19 Docs](https://react.dev/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Docs](https://vitejs.dev/)

---

## Questions or Issues?

If you encounter issues or have questions:
1. Check this guide first
2. Review code comments in relevant files
3. Check browser console for errors
4. Verify extension is properly loaded
5. Review Chrome Extension API documentation

Happy coding! 🚀

