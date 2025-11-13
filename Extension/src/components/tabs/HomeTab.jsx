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

// localStorage key used to remember whether "What We Checked" is open or closed across navigations/reloads
const INDICATORS_OPEN_KEY = "indicatorsOpen";


export function HomeTab({ mode, onNavigate, forceShowIndicators }) {
  const [currentUrl, setCurrentUrl] = useState("");
  const [safetyScore, setSafetyScore] = useState(87); // Default value
  const [securityData, setSecurityData] = useState(null);

  // Persist open/closed state in localStorage
  // Persisted open/closed UI state initialized from localStorage (runs once on mount)
  const [showIndicators, setShowIndicators] = useState(() => {
    try {
      if (typeof window === "undefined") return false;
      const saved = window.localStorage.getItem(INDICATORS_OPEN_KEY);
      return saved ? saved === "1" : false;
    } catch {
      return false;
    }
  });

// If you want a tour or parent to force the open state, keep honoring it
// Effective open state: allow an external prop (e.g., a guided tour) to override the user's persisted choice
  const computedShowIndicators =
    forceShowIndicators ?? showIndicators;

  // Persist user-toggled state (do not persist the forced override)
  // Write the user's latest open/closed choice to localStorage whenever it changes
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

  // Get current tab URL and security data (Chrome extension context)
  useEffect(() => {
    // Get current tab URL and security data
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      const getTabData = async () => {
        try {
          const response = await new Promise((resolve, reject) => {
            let resolved = false;
            const requestId = `getCurrentTab_${Date.now()}_${Math.random()}`;
            
            // Set up a one-time message listener for the response
            const messageListener = (message) => {
              if (message.action === 'getCurrentTabResponse' && message.requestId === requestId) {
                chrome.runtime.onMessage.removeListener(messageListener);
                if (!resolved) {
                  resolved = true;
                  resolve(message.data);
                }
                return true;
              }
            };
            
            chrome.runtime.onMessage.addListener(messageListener);
            
            // Send the request
            chrome.runtime.sendMessage({ 
              action: 'getCurrentTab',
              requestId: requestId 
            }, (response) => {
              const callbackError = chrome.runtime.lastError;
              
              // If we got a response synchronously, use it
              if (response && typeof response === 'object' && response.url !== undefined) {
                chrome.runtime.onMessage.removeListener(messageListener);
                if (!resolved) {
                  resolved = true;
                  resolve(response);
                }
                return;
              }
              
              // Check for port closed error - expected in Manifest V3 with async handlers
              if (callbackError) {
                const errorMsg = callbackError.message || String(callbackError);
                if (errorMsg.includes('message port closed') || 
                    errorMsg.includes('The message port closed before a response was received')) {
                  // Wait for message listener to receive the response
                  return;
                }
                
                // Other fatal errors
                if (errorMsg.includes('Receiving end does not exist') || 
                    errorMsg.includes('Could not establish connection') ||
                    errorMsg.includes('Extension context invalidated')) {
                  chrome.runtime.onMessage.removeListener(messageListener);
                  if (!resolved) {
                    resolved = true;
                    reject(callbackError);
                  }
                  return;
                }
              }
            });
            
            // Timeout fallback
            setTimeout(() => {
              if (!resolved) {
                chrome.runtime.onMessage.removeListener(messageListener);
                resolved = true;
                resolve(null);
              }
            }, 3000);
          });
          
          if (!response) {
            return;
          }
          
          if (response.url) {
            try {
              const url = new URL(response.url);
              setCurrentUrl(url.hostname);
            } catch (e) {
              setCurrentUrl("this site");
            }
            
            // Update safety score from background script if available
            if (response.securityData?.safetyScore !== undefined) {
              setSafetyScore(response.securityData.safetyScore);
              setSecurityData(response.securityData);
            }
          }
        } catch (error) {
          console.error('Error getting current tab:', error);
        }
      };
      
      getTabData();
    } else {
      setCurrentUrl("example.com");
    }
  }, []);

  // Map indicator data with icons - use cached data if available, otherwise use defaults
  const indicators = (securityData?.indicators || DEFAULT_INDICATOR_DATA)
    .sort(((a, b) => a.score - b.score))
    .map(data => ({
      ...data,
      icon: INDICATOR_ICONS[data.id]
    }))
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
              key={`score-${safetyScore}`}
              className={`text-6xl font-bold bg-gradient-to-r ${getColorClasses(getStatusFromScore(safetyScore)).gradient} bg-clip-text text-transparent`}
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
