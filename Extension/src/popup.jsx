import { StrictMode, useState, useRef } from "react"
import { createRoot } from "react-dom/client"
import { HomeTab } from "@/components/tabs/HomeTab"
import { DetailsTab } from "@/components/tabs/DetailsTab"
import { ScanTab } from "@/components/tabs/ScanTab"
import { AlertsTab } from "@/components/tabs/AlertsTab"
import { SettingsTab } from "@/components/tabs/SettingsTab"
import { Tour } from "@/components/Tour"
import { Button } from "@/components/ui/button"
import { Home, Search, Shield, Bell, Settings } from "lucide-react"
import { ThemeToggleIcon } from "@/components/ThemeToggleIcon"
import "@/index.css"

function Popup() {
  const [mode, setMode] = useState("light")
  const [activeTab, setActiveTab] = useState("home")
  const [selectedIndicator, setSelectedIndicator] = useState(null)
  const [isTourActive, setIsTourActive] = useState(false)
  const [forceShowIndicators, setForceShowIndicators] = useState(undefined)
  const scrollContainerRef = useRef(null)

  const toggleMode = () => {
    setMode(mode === "light" ? "dark" : "light")
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

  const handleScanComplete = (url) => {
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
    { id: "scan", label: "Scan", icon: Search },
    { id: "alerts", label: "Alerts", icon: Bell },
  ]

  // Helper function to get tab button classes
  const getTabButtonClasses = (isActive) => {
    const baseClasses = "flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
    if (isActive) {
      return `${baseClasses} ${mode === "dark" ? "bg-brand-900/50 text-brand-300" : "bg-brand-100 text-brand-700"}`
    }
    return `${baseClasses} ${mode === "dark" ? "text-slate-400 hover:text-brand-300 hover:bg-slate-800/50" : "text-slate-600 hover:text-brand-600 hover:bg-brand-50"}`
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
            <HomeTab mode={mode} onNavigate={handleNavigate} forceShowIndicators={forceShowIndicators} />
          )}
          {activeTab === "details" && (
            <DetailsTab mode={mode} onBack={handleBack} indicator={selectedIndicator} />
          )}
          {activeTab === "scan" && (
            <ScanTab mode={mode} onScanComplete={handleScanComplete} />
          )}
          {activeTab === "alerts" && <AlertsTab mode={mode} />}
          {activeTab === "settings" && (
            <SettingsTab mode={mode} onBack={handleBack} onStartTour={handleStartTour} />
          )}
        </div>

        {/* Bottom Tab Navigation */}
        {activeTab !== "details" && activeTab !== "settings" && (
          <div
            className={`border-t ${mode === "dark" ? "border-brand-900/30 bg-slate-900/80" : "border-brand-200 bg-white/80"} backdrop-blur-sm`}
          >
            <div className="grid grid-cols-3 gap-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
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
