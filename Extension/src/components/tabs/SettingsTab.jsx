/* global chrome */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";


/**
 * SettingsTab component - Displays application settings and preferences
 * 
 * @component
 * @memberof module:Front End
 * @param {Object} props - Component props
 * @param {string} props.mode - Current theme mode: "light" or "dark"
 * @param {Function} props.onBack - Callback function to navigate back to the previous tab
 * @param {Function} props.onStartTour - Callback function to start the guided tour
 * @returns {JSX.Element} The rendered SettingsTab component
 * 
 * 
 * @example
 * ```jsx
 * <SettingsTab 
 *   mode="dark" 
 *   onBack={() => setActiveTab("home")}
 *   onStartTour={() => setIsTourActive(true)}
 * />
 * ```
 */
export function SettingsTab({ mode, onBack, onStartTour }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Load current setting + check permission
  useEffect(() => {
    if (!chrome?.storage) {
      setIsChecking(false);
      return;
    }

    chrome.storage.local.get("notificationsEnabled", (result) => {
      const stored = !!result.notificationsEnabled;

      if (!chrome.permissions) {
        setNotificationsEnabled(stored);
        setIsChecking(false);
        return;
      }

      chrome.permissions.contains(
        { permissions: ["notifications"] },
        (granted) => {
          if (chrome.runtime.lastError) {
            console.error("permissions.contains error:", chrome.runtime.lastError);
          }
          const effective = stored && granted;
          setNotificationsEnabled(effective);
          setIsChecking(false);
        }
      );
    });
  }, []);

  const handleToggleNotifications = () => {
    if (isChecking) return;

    // Turning ON
    if (!notificationsEnabled) {
      if (!chrome?.permissions) return;

      chrome.permissions.request(
        { permissions: ["notifications"] },
        (granted) => {
          if (chrome.runtime.lastError) {
            console.error("permissions.request error:", chrome.runtime.lastError);
            setNotificationsEnabled(false);
            chrome.storage.local.set({ notificationsEnabled: false });
            return;
          }

          setNotificationsEnabled(granted);
          chrome.storage.local.set({ notificationsEnabled: granted });
        }
      );
      return;
    }

    // Turning OFF
    setNotificationsEnabled(false);
    chrome.storage.local.set({ notificationsEnabled: false });
  };

  return (
    <div className="p-6 space-y-4">
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onBack} 
        className={`mb-4 ${mode === "dark" ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900"}`}
      >
        ← Back
      </Button>
      
      <h2 className={`font-bold text-lg mb-4 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
        Settings
      </h2>

      <div className="space-y-4">
        {/* Help & Tutorial */}
        <div
          className={`border-2 rounded-2xl p-5 ${mode === "dark" ? "border-brand-700 bg-gradient-to-br from-brand-900/30 to-slate-800/30" : "border-brand-300 bg-gradient-to-br from-brand-50 to-white"}`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
                Help & Tutorial
              </h3>
              <p className={`text-sm mb-3 ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                New to NetSTAR? Take a guided tour to learn how to use all the features and keep yourself safe online.
              </p>
              <Button 
                size="sm" 
                onClick={onStartTour}
                className="bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700"
              >
                Start Guided Tour
              </Button>
            </div>
          </div>
        </div>

        {/* Placeholder settings sections */}
        <div
          className={`border rounded-2xl p-5 ${mode === "dark" ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"}`}
        >
          <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
            General
          </h3>
          <p className={`text-sm ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
            Configure general settings for NetSTAR
          </p>
        </div>

        <div
          className={`border rounded-2xl p-5 ${
            mode === "dark" ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"
          }`}
        >
          <h3
            className={`font-medium mb-2 ${
              mode === "dark" ? "text-white" : "text-slate-900"
            }`}
          >
            Notifications
          </h3>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p
                className={`text-sm ${
                  mode === "dark" ? "text-slate-300" : "text-slate-600"
                }`}
              >
                Desktop alerts when a site looks risky.
              </p>
              <p
                className={`text-xs mt-1 ${
                  mode === "dark" ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {isChecking
                  ? "Checking notification status…"
                  : notificationsEnabled
                  ? "Notifications are enabled."
                  : "Notifications are turned off."}
              </p>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              onClick={handleToggleNotifications}
              disabled={isChecking}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition
                ${notificationsEnabled ? "bg-brand-500" : "bg-slate-400/60"}
                ${isChecking ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition
                  ${notificationsEnabled ? "translate-x-5" : "translate-x-1"}
                `}
              />
            </button>
          </div>
        </div>



        <div
          className={`border rounded-2xl p-5 ${mode === "dark" ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"}`}
        >
          <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
            Privacy
          </h3>
          <p className={`text-sm ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
            Control your privacy and data settings
          </p>
        </div>
      </div>
    </div>
  )
}

