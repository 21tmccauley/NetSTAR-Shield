import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Lock, Info } from "lucide-react"
import { getStatusFromScore } from "@/lib/securityUtils"
import { getStatusInfo } from "@/lib/themeUtils"
import { getEducationalContent } from "@/lib/educationalContent"

/**
 * DetailsTab component - Displays detailed information about a specific security indicator
 * 
 * @component
 * @memberof module:Front End
 * @param {Object} props - Component props
 * @param {string} props.mode - Current theme mode: "light" or "dark"
 * @param {Function} props.onBack - Callback function to navigate back to the previous tab
 * @param {Object} props.indicator - Security indicator data object
 * @param {string} props.indicator.id - Unique identifier for the indicator
 * @param {string} props.indicator.name - Display name of the indicator
 * @param {number} props.indicator.score - Security score for this indicator (0-100)
 * @param {string} [props.indicator.status] - Status string: "excellent", "good", "moderate", or "poor"
 * @returns {JSX.Element} The rendered DetailsTab component
 * 
 * @example
 * ```jsx
 * <DetailsTab 
 *   mode="dark" 
 *   onBack={() => setActiveTab("home")}
 *   indicator={{
 *     id: "cert",
 *     name: "Certificate Health",
 *     score: 95,
 *     status: "excellent"
 *   }}
 * />
 * ```
 */
export function DetailsTab({ mode, onBack, indicator }) {
  const status = indicator?.status || getStatusFromScore(indicator?.score || 100)
  const statusInfo = getStatusInfo(status)
  const educationalItems = getEducationalContent(indicator?.id)

  return (
    <div className="p-6">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onBack} 
        className={`mb-4 ${mode === "dark" ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900"}`}
      >
        ← Back
      </Button>

      {/* Friendly detailed card */}
      <div className={`rounded-2xl p-5 mb-4 bg-gradient-to-br ${statusInfo.bgGradient}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-3 rounded-xl ${statusInfo.iconBg}`}>
            <Lock className={`h-6 w-6 ${statusInfo.iconColor}`} />
          </div>
          <div>
            <h3 className={`font-bold text-lg ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
              {indicator?.name || "Connection Security"}
            </h3>
            <p className={`text-sm ${statusInfo.textColor}`}>
              {statusInfo.message}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className={`text-4xl font-bold ${statusInfo.scoreColor}`}>
            {indicator?.score || 100}
          </div>
          <Badge className={`${statusInfo.badgeBg} text-white`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Educational insights */}
      <div className="space-y-3">
        <h4
          className={`text-sm font-semibold flex items-center gap-2 ${mode === "dark" ? "text-white" : "text-brand-800"}`}
        >
          <Info className="h-4 w-4" />
          What This Means
        </h4>

        {educationalItems.map((item, index) => (
          <div key={index} className={`p-4 rounded-xl ${mode === "dark" ? "bg-slate-800/50" : "bg-white"}`}>
            <div className="flex gap-3">
              <div>
                <div className={`text-sm font-medium mb-1 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
                  {item.title}
                </div>
                <div className={`text-xs ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                  {item.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
