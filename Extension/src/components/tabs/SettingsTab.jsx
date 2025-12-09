/* global chrome */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import * as Switch from "@radix-ui/react-switch";

/**
 * @file SettingsTab.jsx
 * @description Settings UI for NetSTAR focusing on Chrome-level notifications only.
 * - Toggle ON: requests Chrome notifications permission if needed, then sends one test notification.
 * - Toggle OFF: disables notifications via a soft setting (does not revoke permission).
 * - Revoke button: removes the Chrome notifications permission for this extension.
 * The notifications helper text is static to avoid layout shift.
 */

/** Read soft toggle from storage. */
function readSoftToggle() {
  return new Promise((resolve) => {
    chrome.storage.local.get("notificationsEnabledSoft", (res) => {
      resolve(Boolean(res && res.notificationsEnabledSoft));
    });
  });
}

/** Write soft toggle to storage. */
function writeSoftToggle(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ notificationsEnabledSoft: Boolean(value) }, () => resolve());
  });
}

/** Check if Chrome notifications permission is granted. */
function hasNotificationsPermission() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.permissions) return resolve(false);
    chrome.permissions.contains({ permissions: ["notifications"] }, (has) => resolve(Boolean(has)));
  });
}

/** Request Chrome notifications permission (must be from a user gesture). */
function requestNotificationsPermission() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.permissions || !chrome.permissions.request) return resolve(false);
    chrome.permissions.request({ permissions: ["notifications"] }, (granted) => resolve(Boolean(granted)));
  });
}

/** Revoke Chrome notifications permission. */
function revokeNotificationsPermission() {
  return new Promise((resolve) => {
    if (!chrome || !chrome.permissions || !chrome.permissions.remove) return resolve(false);
    chrome.permissions.remove({ permissions: ["notifications"] }, (removed) => resolve(Boolean(removed)));
  });
}

/** Build a packaged icon URL for notifications. */
function resolveIconUrl() {
  const manifest = chrome.runtime.getManifest();
  const iconPath =
    (manifest.icons && (manifest.icons["128"] || manifest.icons["48"] || manifest.icons["16"])) ||
    "src/icons/icon-safe-128.png";
  return chrome.runtime.getURL(iconPath);
}

/** Verify a chrome-extension URL exists. */
async function checkUrlExists(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fire a single test notification. Assumes permission is already granted. */
async function showTestNotification() {
  if (!(chrome && chrome.notifications)) return;
  const iconUrl = resolveIconUrl();
  if (!(await checkUrlExists(iconUrl))) return;

  chrome.notifications.create(
    {
      type: "basic",
      iconUrl,
      title: "Notifications enabled",
      message: "You will see alerts when a site looks risky.",
      priority: 2
    },
    () => {
      if (chrome.runtime && chrome.runtime.lastError) {
        console.warn("notifications.create error:", chrome.runtime.lastError.message);
      }
    }
  );
}

/**
 * SettingsTab component
 * @param {Object} props
 * @param {"light"|"dark"} [props.mode="light"]
 * @param {Function} props.onBack
 * @param {Function} props.onStartTour
 * @returns {JSX.Element}
 */
export function SettingsTab({ mode = "light", onBack, onStartTour }) {
  const [softEnabled, setSoftEnabled] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [soft, perm] = await Promise.all([readSoftToggle(), hasNotificationsPermission()]);
      if (!mounted) return;
      setSoftEnabled(soft);
      setHasPermission(perm);
      setIsChecking(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Toggle soft setting. If turning ON and permission is missing, request it.
   * After enabling, send a single test notification.
   */
  const handleToggleSoft = async (nextChecked) => {
    if (isChecking) return;
    setIsChecking(true);

    if (nextChecked) {
      // Turning ON
      let perm = await hasNotificationsPermission();
      if (!perm) {
        const granted = await requestNotificationsPermission();
        if (!granted) {
          await writeSoftToggle(false);
          setSoftEnabled(false);
          setHasPermission(false);
          setIsChecking(false);
          return;
        }
        perm = true;
      }

      await writeSoftToggle(true);
      setSoftEnabled(true);
      setHasPermission(true);
      setIsChecking(false);

      await showTestNotification();
      return;
    }

    // Turning OFF (soft only; keep browser permission intact)
    await writeSoftToggle(false);
    setSoftEnabled(false);
    setHasPermission(await hasNotificationsPermission());
    setIsChecking(false);
  };

  /** Full revoke of browser permission. Soft flag is also turned off. */
  const handleRevokePermission = async () => {
    setIsChecking(true);
    await revokeNotificationsPermission();
    await writeSoftToggle(false);
    setSoftEnabled(false);
    setHasPermission(false);
    setIsChecking(false);
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

      <h2 className={`font-bold text-lg mb-4 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>Settings</h2>

      <div className="space-y-4">
        {/* Help and Tutorial */}
        <div
          className={`border-2 rounded-2xl p-5 ${
            mode === "dark"
              ? "border-brand-700 bg-gradient-to-br from-brand-900/30 to-slate-800/30"
              : "border-brand-300 bg-gradient-to-br from-brand-50 to-white"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>Help and Tutorial</h3>
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

        {/* General */}
        <div className={`border rounded-2xl p-5 ${mode === "dark" ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"}`}>
          <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>General</h3>
          <p className={`text-sm ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>Configure general settings for NetSTAR</p>
        </div>

        {/* Notifications */}
        <div className={`border rounded-2xl p-5 ${mode === "dark" ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>Notifications</h3>
              <p className={`text-sm ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
                Turn desktop alerts on or off for risky sites. When enabled, we will notify you if a page looks unsafe.
              </p>
              {/* No dynamic status text here to prevent layout shift */}
            </div>

            {/* Radix Switch */}
            <div className="flex items-center gap-2">
              <label htmlFor="notif-switch" className="sr-only">
                Notifications
              </label>
              <Switch.Root
                id="notif-switch"
                checked={softEnabled}
                disabled={isChecking}
                onCheckedChange={handleToggleSoft}
                className={`
                  group inline-flex h-6 w-11 items-center rounded-full p-1 outline-none transition
                  ${softEnabled ? "bg-brand-500" : "bg-slate-400/60"}
                  ${isChecking ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                  data-[state=checked]:bg-brand-500
                  data-[state=unchecked]:bg-slate-400/60
                `}
                aria-label="Toggle notifications"
              >
                <Switch.Thumb
                  className={`
                    block h-4 w-4 rounded-full bg-white shadow transition-transform
                    data-[state=checked]:translate-x-5
                    data-[state=unchecked]:translate-x-0
                  `}
                />
              </Switch.Root>
            </div>
          </div>

          {/* Revoke permission section with explanation */}
          <div className="mt-4 border-t pt-3">
            <h4 className={`text-sm font-medium mb-1 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
              Revoke browser permission
            </h4>
            <p className={`text-xs mb-2 ${mode === "dark" ? "text-slate-400" : "text-slate-500"}`}>
              This turns off all desktop notifications from this extension at the browser level. You can re-enable
              notifications later, but Chrome will ask you to grant permission again.
            </p>
            <Button
              size="sm"
              className="bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-600 hover:to-brand-700"
              onClick={handleRevokePermission}
            >
              Revoke permission
            </Button>
          </div>
        </div>

        {/* Privacy */}
        <div className={`border rounded-2xl p-5 ${mode === "dark" ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"}`}>
          <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>Privacy</h3>
          <p className={`text-sm ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>Control your privacy and data settings</p>
        </div>
      </div>
    </div>
  );
}
