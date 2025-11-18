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
 * INDICATOR_ICONS is the variable for each of the What We Checked(WWC) categories' icons
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
 * It is the localStorage key used to remember whether "What We Checked" is open or closed across navigations/reloads
 */

const INDICATORS_OPEN_KEY = "indicatorsOpen";


export function HomeTab({ mode, onNavigate, forceShowIndicators }) {
  const [currentUrl, setCurrentUrl] = useState("");
  const [safetyScore, setSafetyScore] = useState(87); // Default value
  const [securityData, setSecurityData] = useState(null);


  /**
   * This is what checks the local storage to see whether the WWC section should be open or not. It runs on mount, meaning each time the tab is loaded.
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
 * This variable is what allows the tour to open the WWC section for the tour. It does override the user's choice.
 * This could also be used for a different parent to override it as well.
 */
  const computedShowIndicators =
    forceShowIndicators ?? showIndicators;

  // Persist user-toggled state (do not persist the forced override)
  // Write the user's latest open/closed choice to localStorage whenever it changes

  /**
   * This writes the user's last open/closed choice to localStorage whenever it changes.
   * It also does not allow the override from computedShowIndicators to persist/ go into the localStorage
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
   * This gets the current URL for the current tab and security data (Chrome extension context)
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

  // Build indicators with icons + score (merge live score if provided), then sort by score asc

  /**
   * Creates a variable for the WWC categories
   * Orders them by score, sorting from Lowest(Top) to Highest(Bottom)
   * Creates map of WWC categories with their important values/data
   */
  const indicators = DEFAULT_INDICATOR_DATA
  .sort(((a, b) => a.score - b.score))
    .map((data) => ({
      ...data,
      score: securityData?.indicators?.[data.id]?.score ?? data.score ?? 0,
      icon: INDICATOR_ICONS[data.id],
    }))


    /**
     * 
     * This toggles the open/closed state in localStorage unless a forced override is active
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
