import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lock,
  GlobeLock,
  KeyRound,
  Network,
  CheckCircle2,
  AlertCircle,
  ZoomIn,
  ScrollText,
  FileUser,
  NotebookText,
} from "lucide-react";
import { getStatusFromScore, getStatusMessage } from "@/lib/securityUtils";
import { getColorClasses } from "@/lib/themeUtils";
import { DEFAULT_INDICATOR_DATA } from "@/lib/constants";

/**
 * Mapping of indicator IDs to their corresponding icon components from lucide-react
 * @type {Object<string, React.ComponentType>}
 * @constant
 */
const INDICATOR_ICONS = {
  cert: ScrollText,
  connection: Lock,
  domain: GlobeLock,
  credentials: KeyRound,
  ip: Network,
  dns: NotebookText,
  whois: FileUser,
};

/**
 * localStorage key used to persist the expanded/collapsed state of the "What We Checked" section
 * @type {string}
 * @constant
 */
const INDICATORS_OPEN_KEY = "indicatorsOpen";

/**
 * HomeTab component - Main tab displaying security score and indicators for the current website
 * 
 * @component
 * @memberof module:Front End
 * @param {Object} props - Component props
 * @param {string} props.mode - Current theme mode: "light" or "dark"
 * @param {Function} props.onNavigate - Callback function to navigate to other tabs/pages
 * @param {Function} props.onNavigate.details - Navigate to details tab with indicator data
 * @param {boolean|undefined} props.forceShowIndicators - Force indicators to be shown (used by tour/guided experiences). 
 *   When provided, overrides user's saved preference
 * @returns {JSX.Element} The rendered HomeTab component
 * 
 * @example
 * ```jsx
 * <HomeTab 
 *   mode="dark" 
 *   onNavigate={(tab, data) => setActiveTab(tab)} 
 *   forceShowIndicators={true} 
 * />
 * ```
 */
export function HomeTab({ mode, onNavigate, forceShowIndicators }) {
  /** Current website URL hostname */
  const [currentUrl, setCurrentUrl] = useState("");
  
  /** Security safety score (0-100), default is 87 */
  const [safetyScore, setSafetyScore] = useState(87);
  
  /** Complete security scan data including indicators and metadata, or null if not loaded */
  const [securityData, setSecurityData] = useState(null);

  /**
   * State for whether the "What We Checked" indicators section is expanded
   * Initialized from localStorage to persist user's preference across sessions
   * @type {boolean}
   */
  const [showIndicators, setShowIndicators] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      const saved = window.localStorage.getItem(INDICATORS_OPEN_KEY);
      return saved ? saved === "1" : false;
    } catch {
      return false;
    }
  });

  /**
   * Computed indicator visibility state - allows external control (tour) to override user preference
   * @type {boolean}
   */
  const computedShowIndicators =
    forceShowIndicators ?? showIndicators;

  /**
   * Effect to persist user's indicator toggle preference to localStorage
   * Runs whenever showIndicators changes, but does not persist forced overrides
   */
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          INDICATORS_OPEN_KEY,
          showIndicators ? "1" : "0"
        );
      }
    } catch {
      /* ignore write errors */
    }
  }, [showIndicators]);

  /**
   * Effect to fetch current tab URL and security data from background script
   * Runs once on component mount to populate initial security information
   */
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "getCurrentTab" }, (response) => {
        if (response && response.url) {
          try {
            const url = new URL(response.url);
            setCurrentUrl(url.hostname);
          } catch (e) {
            setCurrentUrl("this site");
          }

          // Update safety score & data from background script if available
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

  /**
   * Builds indicator list by merging default indicator data with live security scan data
   * Maps indicator IDs to icons and merges scores from securityData when available
   * Sorts indicators by score in ascending order (lowest scores first)
   * @type {Array<Object>}
   * @property {string} id - Indicator identifier
   * @property {string} name - Display name for the indicator
   * @property {number} score - Security score (0-100)
   * @property {React.ComponentType} icon - Icon component for the indicator
   */
  const indicators = DEFAULT_INDICATOR_DATA
  .sort(((a, b) => a.score - b.score))
    .map((data) => ({
      ...data,
      score: securityData?.indicators?.[data.id]?.score ?? data.score ?? 0,
      icon: INDICATOR_ICONS[data.id],
    }))

  /**
   * Handler function to toggle the visibility of the "What We Checked" indicators section
   * Prevents toggling when a forced override is active (e.g., during a tour)
   */
  const handleToggleIndicators = () => {
    // If a forced value is provided (tour/demo), don't toggle the persisted state
    if (forceShowIndicators != null) return;
    setShowIndicators((openState) => !openState);
  };
  return (
    <div className="p-6">
      {/* Header with friendly greeting */}
      <div className="text-center mb-6">
        <h2
          className={`font-bold text-xl mb-1 ${
            mode === "dark" ? "text-white" : "text-slate-900"
          }`}
        >
          You're Safe Here!
        </h2>
        <p
          className={`text-sm ${
            mode === "dark" ? "text-slate-200" : "text-brand-600"
          }`}
        >
          {currentUrl} is looking good
        </p>
      </div>

      {/* Friendly Score Display */}
      <div
        id="security-score"
        className={`rounded-2xl p-6 mb-6 ${
          mode === "dark"
            ? "bg-gradient-to-br from-brand-900/50 to-brand-accent-500/30"
            : "bg-gradient-to-br from-brand-100 to-brand-accent-400/20"
        }`}
      >
        <div className="text-center">
          <div className="inline-flex items-baseline gap-2 mb-2">
            <span
              className={`text-6xl font-bold bg-gradient-to-r ${
                getColorClasses(getStatusFromScore(safetyScore)).gradient
              } bg-clip-text text-transparent`}
            >
              {safetyScore}
            </span>
            <span
              className={`text-2xl font-medium ${
                mode === "dark" ? "text-slate-100" : "text-brand-600"
              }`}
            >
              /100
            </span>
          </div>
          <div
            className={`text-sm font-medium ${
              mode === "dark" ? "text-slate-100" : "text-brand-700"
            }`}
          >
            Safety Score
          </div>
          <div className="flex items-center justify-center gap-1 mt-3">
            {[...Array(5)].map((_, i) => {
              const segmentFill = Math.min(
                Math.max((safetyScore - i * 20) / 20, 0),
                1
              );
              const colors = getColorClasses(getStatusFromScore(safetyScore));

              return (
                <div
                  key={i}
                  className={`relative w-8 h-1.5 rounded-full overflow-hidden ${
                    mode === "dark" ? "bg-slate-700" : "bg-brand-200"
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 transition-all ${
                      segmentFill > 0 ? `bg-gradient-to-r ${colors.gradient}` : ""
                    }`}
                    style={{ width: `${segmentFill * 100}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Friendly Indicators */}
      <div id="security-indicators" className="space-y-3">
        <button
          onClick={handleToggleIndicators}
          className={`text-sm font-semibold mb-3 flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${
            mode === "dark" ? "text-white" : "text-brand-800"
          }`}
        >
          <ZoomIn className="h-4 w-4" />
          What We Checked
          <span className="text-xs ml-auto">
            {computedShowIndicators ? "▼" : "▶"}
          </span>
        </button>

        {computedShowIndicators &&
          indicators.map((indicator) => {
            const Icon = indicator.icon;
            const status = getStatusFromScore(indicator.score);
            const colors = getColorClasses(status);

            return (
              <button
                key={indicator.id}
                onClick={() => onNavigate("details", { ...indicator, status })}
                className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all hover:scale-[1.02] ${
                  mode === "dark"
                    ? "bg-slate-800/50 hover:bg-slate-800"
                    : "bg-white hover:shadow-md"
                }`}
              >
                <div className={`p-2 rounded-lg ${colors.bg}`}>
                  <Icon className={`h-4 w-4 ${colors.text}`} />
                </div>
                <div className="flex-1 text-left">
                  <div
                    className={`text-sm font-medium ${
                      mode === "dark" ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {indicator.name}
                  </div>
                  <div
                    className={`text-xs ${
                      mode === "dark" ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
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
            );
          })}
      </div>
    </div>
  );
}
