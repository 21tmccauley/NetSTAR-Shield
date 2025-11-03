import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X, Settings } from "lucide-react"
import { ThemeToggleIcon } from "@/components/ThemeToggleIcon"

// Constants for button highlight IDs
const HIGHLIGHT_IDS = {
  THEME_TOGGLE: "theme-toggle",
  SETTINGS_BUTTON: "settings-button",
  SECURITY_SCORE: "security-score",
  SECURITY_INDICATORS: "security-indicators"
}

export function Tour({ mode, isActive, onClose, currentTab, onNavigate, onStepChange }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [spotlightPos, setSpotlightPos] = useState(null)

  const steps = [
    {
      tab: "home",
      title: "Welcome to NetSTAR!",
      description: "Let's take a quick tour of your security companion. This is the Home tab where you can see an overview of the current website's security status.",
      highlightId: null,
      position: "bottom" // bottom, top, center, left, right
    },
    {
      tab: "home",
      title: "Security Score",
      description: "This shows the overall security rating of the current website. Higher scores mean better security!",
      highlightId: HIGHLIGHT_IDS.SECURITY_SCORE,
      position: "bottom"
    },
    {
      tab: "home",
      title: "Security Indicators",
      description: "These cards show detailed security metrics like Connection Security, Certificate Validity, and Site Reputation. Click any card to see more details!",
      highlightId: HIGHLIGHT_IDS.SECURITY_INDICATORS,
      position: "top"
    },
    {
      tab: "scan",
      title: "Scan Tab",
      description: "Use the Scan tab to manually check any URL for security threats before visiting it. Just paste a URL and click scan!",
      highlightId: null,
      position: "bottom"
    },
    {
      tab: "alerts",
      title: "Alerts Tab",
      description: "The Alerts tab shows you important security warnings when we detect potential threats on a website you're visiting.",
      highlightId: null,
      position: "bottom"
    },
    {
      tab: "home",
      title: "Theme Toggle",
      description: "Switch between light and dark mode using this button. Your eyes will thank you!",
      highlightId: HIGHLIGHT_IDS.THEME_TOGGLE,
      position: "bottom"
    },
    {
      tab: "home",
      title: "Settings",
      description: "Access settings and preferences by clicking this gear icon. You can always restart this tour from there!",
      highlightId: HIGHLIGHT_IDS.SETTINGS_BUTTON,
      position: "bottom"
    },
  ]

  const currentStepData = steps[currentStep]
  const isButtonHighlight = currentStepData?.highlightId === HIGHLIGHT_IDS.THEME_TOGGLE || 
                            currentStepData?.highlightId === HIGHLIGHT_IDS.SETTINGS_BUTTON

  // Navigate to the correct tab when step changes and notify parent
  useEffect(() => {
    if (isActive && currentStepData) {
      if (currentStepData.tab !== currentTab) {
        onNavigate(currentStepData.tab)
      }
      onStepChange?.(currentStepData)
    }
  }, [currentStep, isActive, currentStepData, currentTab, onNavigate, onStepChange])

  // Calculate spotlight position for button highlights (steps 6 & 7)
  useEffect(() => {
    if (!isActive || !isButtonHighlight) {
      setSpotlightPos(null)
      return
    }

    const updateSpotlight = () => {
      const element = document.getElementById(currentStepData.highlightId)
      if (element) {
        const rect = element.getBoundingClientRect()
        setSpotlightPos({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          width: rect.width + 16,
          height: rect.height + 16,
        })
      } else {
        setSpotlightPos(null)
      }
    }
    
    updateSpotlight()
    const timeout = setTimeout(updateSpotlight, 100)
    window.addEventListener('resize', updateSpotlight)
    
    return () => {
      clearTimeout(timeout)
      window.removeEventListener('resize', updateSpotlight)
      setSpotlightPos(null)
    }
  }, [currentStep, isActive, currentStepData, isButtonHighlight])

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleClose = () => {
    setCurrentStep(0)
    onClose()
  }

  if (!isActive) return null

  const positionClasses = {
    top: "top-3 left-0 right-0",
    bottom: "bottom-0 left-0 right-0",
    center: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
    left: "top-1/2 left-3 transform -translate-y-1/2",
    right: "top-1/2 right-3 transform -translate-y-1/2",
  }[currentStepData.position] || "bottom-0 left-0 right-0"

  const isFullWidth = currentStepData.position === "bottom" || currentStepData.position === "top"

  return (
    <>
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/30 z-40" />
      
      {/* Bright overlay buttons for steps 6 & 7 */}
      {spotlightPos && isButtonHighlight && (
        <div
          className="fixed z-[45] pointer-events-none"
          style={{
            left: spotlightPos.x - spotlightPos.width / 2,
            top: spotlightPos.y - spotlightPos.height / 2,
            width: spotlightPos.width,
            height: spotlightPos.height,
          }}
        >
          <div
            className={`w-full h-full rounded-full flex items-center justify-center ${
              mode === "dark" 
                ? "bg-slate-700 border border-slate-600" 
                : "bg-slate-100 border border-slate-300"
            }`}
            style={{
              filter: 'brightness(1.5) saturate(1.2)',
              boxShadow: '0 0 0 4px rgba(99, 102, 241, 0.8), 0 0 20px 4px rgba(99, 102, 241, 0.4)',
            }}
          >
            {currentStepData.highlightId === HIGHLIGHT_IDS.THEME_TOGGLE ? (
              <ThemeToggleIcon mode={mode} />
            ) : (
              <Settings className={`h-4 w-4 ${mode === "dark" ? "text-slate-200" : "text-slate-700"}`} />
            )}
          </div>
        </div>
      )}
      
      {/* Hide original buttons when showing bright overlay */}
      {isButtonHighlight && (
        <style>{`#${currentStepData.highlightId} { opacity: 0 !important; }`}</style>
      )}
      
      {/* Highlight effect for non-button elements */}
      {currentStepData.highlightId && !isButtonHighlight && (
        <style>
          {`#${currentStepData.highlightId} {
            position: relative;
            z-index: 50 !important;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.8), 0 0 20px 4px rgba(99, 102, 241, 0.4) !important;
            border-radius: 12px !important;
          }`}
        </style>
      )}

      {/* Tour Tooltip */}
      <div className={`fixed z-[60] ${isFullWidth ? 'px-3' : ''} ${positionClasses}`}>
        <div
          className={`rounded-xl p-4 shadow-2xl ${isFullWidth ? 'max-w-md mx-auto' : 'w-80'} ${
            mode === "dark" 
              ? "bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-brand-700" 
              : "bg-gradient-to-br from-white to-brand-50 border-2 border-brand-300"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`text-xs font-medium ${mode === "dark" ? "text-brand-400" : "text-brand-600"}`}>
                  {currentStep + 1}/{steps.length}
                </span>
                <h3 className={`text-sm font-bold ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
                  {currentStepData.title}
                </h3>
              </div>

              <p className={`text-xs mb-3 ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                {currentStepData.description}
              </p>

              <div className={`h-1 rounded-full mb-3 ${mode === "dark" ? "bg-slate-700" : "bg-slate-200"}`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  disabled={currentStep === 0}
                  className="flex-1 h-8 text-xs"
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="flex-1 h-8 text-xs bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700"
                >
                  {currentStep === steps.length - 1 ? "Finish" : "Next"}
                </Button>
                <button
                  onClick={handleClose}
                  className={`px-2 text-xs ${mode === "dark" ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Skip
                </button>
              </div>
            </div>

            <button
              onClick={handleClose}
              className={`p-1 rounded-lg hover:bg-slate-700/50 flex-shrink-0 ${
                mode === "dark" ? "text-slate-400" : "text-slate-600"
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

