import { StrictMode, useState, useRef, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { HomeTab } from "@/components/tabs/HomeTab"
import { DetailsTab } from "@/components/tabs/DetailsTab"
import { ScanTab } from "@/components/tabs/ScanTab"
// import { AlertsTab } from "@/components/tabs/AlertsTab"
import { SettingsTab } from "@/components/tabs/SettingsTab"
import { Tour } from "@/components/Tour"
import { Button } from "@/components/ui/button"
import { Home, Search, Shield, Settings, MessageCircleQuestionMark } from "lucide-react"
/**
 * Text size accessibility setting (5-step discrete scale).
 *
 * - Stored as `textSizeStep` in chrome.storage.sync.
 * - Range: 0..4 (0=smallest, 2=default/current size, 4=largest).
 * - Applied by changing document root (`<html>`) font-size so Tailwind `rem`-based text scales.
 *
 * NOTE:
 * - This will scale most of the UI (since Tailwind uses rem).
 * - Some UI elements (like the text size slider control itself) are intentionally "locked"
 *   to fixed px sizing via CSS so that the slider does not visually resize when the text size changes.
 */
import { ThemeToggleIcon } from "@/components/ThemeToggleIcon"
import "@/index.css"

function Popup() {
  const [mode, setMode] = useState("light")
  const [activeTab, setActiveTab] = useState("home")
  const [selectedIndicator, setSelectedIndicator] = useState(null)
  const [isTourActive, setIsTourActive] = useState(false)
  const [forceShowIndicators, setForceShowIndicators] = useState(undefined)
  const [isLoaded, setIsLoaded] = useState(false)
  // When a user runs a manual scan from the Scan tab, we want Home to show that URL + its score,
  // not whatever tab is currently active in the browser.
  const [manualScanContext, setManualScanContext] = useState(null) // { url: string, securityData: object }
  const [textSizeStep, setTextSizeStep] = useState(2) // 0..4, 2 = default
  const scrollContainerRef = useRef(null)

  /**
   * Load persisted user preferences from chrome.storage.sync.
   *
   * - themeMode: "light" | "dark"
   * - textSizeStep: number 0..4
   *
   * Uses an `isMounted` guard to prevent state updates after unmount.
   * Falls back safely when chrome.storage.sync is unavailable (e.g., non-extension dev context).
   */
  useEffect(() => {
    if (!chrome?.storage?.sync) {
      setIsLoaded(true)
      return
    }

    let isMounted = true

    chrome.storage.sync.get(
      { themeMode: "light", textSizeStep: 2 },
      ({ themeMode, textSizeStep }) => {
        if (!isMounted) return

        if (themeMode === "dark" || themeMode === "light") {
          setMode(themeMode)
        }

        const step = Number(textSizeStep)
        if (Number.isFinite(step) && step >= 0 && step <= 4) {
          setTextSizeStep(step)
        }

        setIsLoaded(true)
      }
    )

    return () => {
      isMounted = false
    }
  }, [])

  /**
   * Persist user preferences to chrome.storage.sync.
   *
   * Writes:
   * - themeMode
   * - textSizeStep
   *
   * Only runs after initial settings load completes (`isLoaded`).
   */
  useEffect(() => {
    if (!isLoaded) return
    if (!chrome?.storage?.sync) return

    chrome.storage.sync.set({ themeMode: mode, textSizeStep }, () => {})
  }, [mode, textSizeStep, isLoaded])

  /**
   * Apply the current text size step to the popup document.
   *
   * Implementation:
   * - Maps 5 discrete steps to px values (e.g., 14..18).
   * - Writes `document.documentElement.style.fontSize`.
   *
   * Smoothing:
   * - Adds a short transition on `font-size` so the change feels less abrupt.
   *   (Works well for small deltas like 14–18px.)
   *
   * Cleanup:
   * - Restores default font-size and clears transition on unmount.
   *
   * Design note:
   * - This scales general UI text (our "test text").
   * - The slider UI is styled with fixed px dimensions (CSS) so its track/thumb/labels do not scale.
   */
  useEffect(() => {
    // Keep index 2 at your current default (16px)
    const stepToPx = [14, 15, 16, 17, 18]
    const px = stepToPx[textSizeStep] ?? 16

    // Smooth the jump between sizes
    document.documentElement.style.transition = "font-size 140ms ease"

    document.documentElement.style.fontSize = `${px}px`

    return () => {
      document.documentElement.style.fontSize = "16px"
      document.documentElement.style.transition = ""
    }
  }, [textSizeStep])

  const toggleMode = () => {
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"))
  }

  const handleNavigate = (tab, data) => {
    if (tab === "details") {
      setSelectedIndicator(data)
      setActiveTab("details")
      // Reset scroll position to top when navigating to details
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0
      }
    } else {
      setActiveTab(tab)
    }
  }

  const handleBack = () => {
    setActiveTab("home")
  }

  const handleScanComplete = (url, securityData) => {
    setManualScanContext({ url, securityData })
    setActiveTab("home")
  }

  const handleStartTour = () => {
    setIsTourActive(true)
    setActiveTab("home")
  }

  const handleCloseTour = () => {
    setIsTourActive(false)
    setForceShowIndicators(undefined) // Reset indicator control
  }

  const handleTourStepChange = (stepData) => {
    // Auto-expand indicators when on the security indicators step
    if (stepData.highlightId === "security-indicators") {
      setForceShowIndicators(true)
    } else {
      setForceShowIndicators(undefined)
    }
  }

  const tabs = [
    { id: "home", label: "Home", icon: Home },
    { id: "scan", label: "Scan", icon: Search }
    // { id: "alerts", label: "Alerts", icon: Bell },
  ]

  // Helper function to get tab button classes
  const getTabButtonClasses = (isActive) => {
    const baseClasses = "flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
    if (isActive) {
      return `${baseClasses} ${mode === "dark" ? "bg-brand-900/50 text-brand-300" : "bg-brand-100 text-brand-700"}`
    }
    return `${baseClasses} ${mode === "dark" ? "text-slate-400 hover:text-brand-300 hover:bg-slate-800/50" : "text-slate-600 hover:text-brand-600 hover:bg-brand-50"}`
  }

  if (!isLoaded) {
    return <div className="p-4 text-sm text-slate-500">Loading...</div>
  }

  return (
    <div className={mode === "dark" ? "dark" : ""}>
      <div
        className={`h-[500px] flex flex-col ${mode === "dark" ? "bg-gradient-to-b from-slate-900 to-brand-950" : "bg-gradient-to-b from-white to-brand-50"}`}
      >
        {/* Header */}
        <div
          className={`border-b ${mode === "dark" ? "border-brand-900/30 bg-slate-900/50" : "border-brand-200 bg-white/50"} backdrop-blur-sm`}
        >
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className={`text-lg font-bold ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
                NetSTAR
              </h1>
              <p className={`text-xs ${mode === "dark" ? "text-brand-300" : "text-brand-600"}`}>
                Security Guide
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                id="theme-toggle"
                variant="ghost"
                size="icon"
                onClick={toggleMode}
                className="rounded-full h-8 w-8"
              >
                <ThemeToggleIcon mode={mode} />
              </Button>
              <Button
                id="message-circle-question-mark"
                variant="ghost"
                size="icon"
                onClick={handleStartTour}
                className="rounded-full h-8 w-8"
              >
                <MessageCircleQuestionMark
                  className={`h-4 w-4 ${mode === "dark" ? "text-slate-200" : "text-slate-700"}`}
                />
              </Button>
              <Button
                id="settings-button"
                variant="ghost"
                size="icon"
                onClick={() => setActiveTab("settings")}
                className="rounded-full h-8 w-8"
              >
                <Settings className={`h-4 w-4 ${mode === "dark" ? "text-slate-200" : "text-slate-700"}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          {activeTab === "home" && (
            <HomeTab
              mode={mode}
              onNavigate={handleNavigate}
              forceShowIndicators={forceShowIndicators}
              overrideUrl={manualScanContext?.url}
              overrideSecurityData={manualScanContext?.securityData}
            />
          )}
          {activeTab === "details" && (
            <DetailsTab mode={mode} onBack={handleBack} indicator={selectedIndicator} />
          )}
          {activeTab === "scan" && (
            <ScanTab mode={mode} onScanComplete={handleScanComplete} />
          )}

          {/**
            * SettingsTab receives the text size preference and its setter so that the General settings
            * screen can control the popup's text scaling.
            *
            * Props added:
            * - textSizeStep
            * - onTextSizeStepChange
            */}
          {activeTab === "settings" && (
            <SettingsTab
              mode={mode}
              onBack={handleBack}
              onStartTour={handleStartTour}
              textSizeStep={textSizeStep}
              onTextSizeStepChange={setTextSizeStep}
            />
          )}
        </div>

        {/* Bottom Tab Navigation */}
        {activeTab !== "details" && (
          <div
            className={`border-t ${mode === "dark" ? "border-brand-900/30 bg-slate-900/80" : "border-brand-200 bg-white/80"} backdrop-blur-sm`}
          >
            <div className="grid grid-cols-2 gap-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                const tabButtonId =
                  tab.id === "scan"
                    ? "scan-tab-button"
                    : tab.id === "alerts"
                      ? "alerts-tab-button"
                      : null
                return (
                  <button
                    key={tab.id}
                    id={tabButtonId}
                    onClick={() => {
                      // Clicking Home explicitly should return to showing the current active tab,
                      // rather than a prior manual scan target.
                      if (tab.id === "home") setManualScanContext(null)
                      setActiveTab(tab.id)
                    }}
                    className={getTabButtonClasses(isActive)}
                  >
                    <Icon className={`h-5 w-5 ${isActive ? "scale-110" : ""}`} />
                    <span className="text-xs font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Tour Component */}
        <Tour
          mode={mode}
          isActive={isTourActive}
          onClose={handleCloseTour}
          currentTab={activeTab}
          onNavigate={handleNavigate}
          onStepChange={handleTourStepChange}
        />
      </div>
    </div>
  )
}

const root = document.getElementById("root")
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Popup />
    </StrictMode>
  )
}
