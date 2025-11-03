import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Lock,
  Globe,
  Key,
  Server,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { getStatusFromScore, getStatusMessage } from "@/lib/securityUtils"
import { getColorClasses } from "@/lib/themeUtils"
import { DEFAULT_INDICATOR_DATA } from "@/lib/constants"

// Icon mapping for indicators
const INDICATOR_ICONS = {
  cert: Shield,
  connection: Lock,
  domain: Globe,
  credentials: Key,
  ip: Server,
  dns: FileText,
  whois: FileText,
}

export function HomeTab({ mode, onNavigate, forceShowIndicators }) {
  const [currentUrl, setCurrentUrl] = useState("")
  const [showIndicators, setShowIndicators] = useState(false)
  const [safetyScore, setSafetyScore] = useState(87) // Default value
  const [securityData, setSecurityData] = useState(null)

  // Allow external control of showIndicators (for tour)
  useEffect(() => {
    if (forceShowIndicators !== undefined) {
      setShowIndicators(forceShowIndicators)
    }
  }, [forceShowIndicators])

  useEffect(() => {
    // Get current tab URL and security data
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ action: 'getCurrentTab' }, (response) => {
        if (response && response.url) {
          try {
            const url = new URL(response.url);
            setCurrentUrl(url.hostname);
          } catch (e) {
            setCurrentUrl("this site");
          }
          
          // Update safety score from background script if available
          if (response.securityData && response.securityData.safetyScore) {
            setSafetyScore(response.securityData.safetyScore);
            setSecurityData(response.securityData);
          }
        }
      });
    } else {
      setCurrentUrl("example.com");
    }
  }, []);

  // Map indicator data with icons
  const indicators = DEFAULT_INDICATOR_DATA.map(data => ({
    ...data,
    icon: INDICATOR_ICONS[data.id]
  }))

  return (
    <div className="p-6">
      {/* Header with friendly greeting */}
      <div className="text-center mb-6">
        <h2 className={`font-bold text-xl mb-1 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
          You're Safe Here!
        </h2>
        <p className={`text-sm ${mode === "dark" ? "text-slate-200" : "text-brand-600"}`}>
          {currentUrl} is looking good
        </p>
      </div>

      {/* Friendly Score Display */}
      <div
        id="security-score"
        className={`rounded-2xl p-6 mb-6 ${mode === "dark" ? "bg-gradient-to-br from-brand-900/50 to-brand-accent-500/30" : "bg-gradient-to-br from-brand-100 to-brand-accent-400/20"}`}
      >
        <div className="text-center">
          <div className="inline-flex items-baseline gap-2 mb-2">
            <span className={`text-6xl font-bold bg-gradient-to-r ${getColorClasses(getStatusFromScore(safetyScore)).gradient} bg-clip-text text-transparent`}>
              {safetyScore}
            </span>
            <span className={`text-2xl font-medium ${mode === "dark" ? "text-slate-100" : "text-brand-600"}`}>
              /100
            </span>
          </div>
          <div className={`text-sm font-medium ${mode === "dark" ? "text-slate-100" : "text-brand-700"}`}>
            Safety Score
          </div>
          <div className="flex items-center justify-center gap-1 mt-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-8 h-1.5 rounded-full ${
                  i < Math.floor(safetyScore / 20)
                    ? `bg-gradient-to-r ${getColorClasses(getStatusFromScore(safetyScore)).gradient}`
                    : mode === "dark"
                      ? "bg-slate-700"
                      : "bg-brand-200"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Friendly Indicators */}
      <div id="security-indicators" className="space-y-3">
        <button
          onClick={() => setShowIndicators(!showIndicators)}
          className={`text-sm font-semibold mb-3 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${mode === "dark" ? "text-white" : "text-brand-800"}`}
        >
          <Sparkles className="h-4 w-4" />
          What We Checked
          <span className="text-xs ml-auto">{showIndicators ? "▼" : "▶"}</span>
        </button>
        {showIndicators && indicators.map((indicator) => {
          const Icon = indicator.icon
          const status = getStatusFromScore(indicator.score)
          const colors = getColorClasses(status)
          
          return (
            <button
              key={indicator.id}
              onClick={() => onNavigate("details", { ...indicator, status })}
              className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all hover:scale-[1.02] ${
                mode === "dark" ? "bg-slate-800/50 hover:bg-slate-800" : "bg-white hover:shadow-md"
              }`}
            >
              <div className={`p-2 rounded-lg ${colors.bg}`}>
                <Icon className={`h-4 w-4 ${colors.text}`} />
              </div>
              <div className="flex-1 text-left">
                <div className={`text-sm font-medium ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
                  {indicator.name}
                </div>
                <div className={`text-xs ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                  {getStatusMessage(status)}
                </div>
              </div>
              {status === "excellent" || status === "good" ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : status === "moderate" ? (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
