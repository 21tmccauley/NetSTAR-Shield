import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, Shield, Sparkles } from "lucide-react"

export function ScanTab({ mode, onScanComplete }) {
  const [scanUrl, setScanUrl] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [recentScans, setRecentScans] = useState([]);

  useEffect(() => {
    chrome.storage.local.get("recentScans", (data) => {
      if (data.recentScans) {
        setRecentScans(data.recentScans);
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.recentScans) {
        setRecentScans(changes.recentScans.newValue || []);
      }
    });
  }, []);
  
  const handleScan = () => {
    if (!scanUrl || isScanning) return
    setIsScanning(true)

    chrome.runtime.sendMessage(
      { action: "scanUrl", url:scanUrl },
      (result) => {
        setIsScanning(false);

        if (onScanComplete) {
          onScanComplete(scanUrl);
        }
      }
    );
    //setTimeout(() => {
      //setIsScanning(false)
      //if (onScanComplete) {
        //onScanComplete(scanUrl)
      //}
    //}, 2000)
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleScan()
    }
  }

  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-accent-400 mb-3">
          <Search className="h-8 w-8 text-white" />
        </div>
        <h2 className={`font-bold text-xl mb-1 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
          Let's Check a Website
        </h2>
        <p className={`text-sm ${mode === "dark" ? "text-slate-200" : "text-brand-600"}`}>
          We'll help you stay safe online
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            className={`text-sm font-medium mb-2 block ${mode === "dark" ? "text-white" : "text-brand-800"}`}
          >
            Website address
          </label>
          <Input
            type="text"
            placeholder="https://example.com"
            value={scanUrl}
            onChange={(e) => setScanUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`rounded-xl ${mode === "dark" ? "bg-slate-800 border-slate-700 text-white" : "border-brand-200 text-slate-900"}`}
          />
          <p className={`text-xs mt-2 ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
            Tip: You can paste any URL or IP address
          </p>
        </div>

        {!isScanning ? (
          <Button
            className="w-full bg-gradient-to-r from-brand-500 to-brand-accent-500 hover:from-brand-600 hover:to-brand-accent-500 text-white rounded-xl"
            onClick={handleScan}
            disabled={!scanUrl}
          >
            <Shield className="h-4 w-4 mr-2" />
            Check This Site
          </Button>
        ) : (
          <div
            className={`p-8 rounded-2xl ${mode === "dark" ? "bg-gradient-to-br from-brand-900/30 to-brand-accent-500/20" : "bg-gradient-to-br from-brand-100 to-brand-accent-400/20"}`}
          >
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-accent-500 rounded-full opacity-20 animate-ping"></div>
                <div className="absolute inset-0 bg-gradient-to-r from-brand-500 to-brand-accent-500 rounded-full opacity-75 animate-pulse"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="text-center">
                <div className={`font-medium ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
                  Checking security...
                </div>
                <div className={`text-sm ${mode === "dark" ? "text-slate-200" : "text-brand-600"}`}>
                  This will just take a moment
                </div>
              </div>
            </div>
          </div>
        )}

{/* Recently checked sites dynamically from storage */}
<div className="mt-6">
  <h3
    className={`text-sm font-semibold mb-3 ${
      mode === "dark" ? "text-white" : "text-brand-800"
    }`}
  >
    Recently Checked
  </h3>

  {recentScans.length === 0 ? (
    <p
      className={`text-sm italic ${
        mode === "dark" ? "text-slate-400" : "text-slate-600"
      }`}
    >
      No sites checked yet
    </p>
  ) : (
    <div className="space-y-2">
      {recentScans.reverse().map((site) => (
        <button
          key={site.url}
          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] ${
            mode === "dark"
              ? "bg-slate-800/50 hover:bg-slate-800"
              : "bg-white hover:shadow-md"
          }`}
          onClick={() => setScanUrl(site.url.startsWith("http") ? site.url : `https://${site.url}`)}
        >
          <span
            className={`text-sm flex-1 text-left ${
              mode === "dark" ? "text-white" : "text-slate-900"
            }`}
          >
            {site.url.match(/^(?:https?:\/\/)?([^\/]+)/)?.[1] || site.url}
          </span>
          <Badge
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              site.safe === "safe"
                ? "bg-green-100 text-green-800 border-green-300"
                : site.safe === "warning"
                ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                : "bg-red-100 text-red-800 border-red-300"
            }`}
          >
            {site.safe === "safe"
              ? "Safe"
              : site.safe === "warning"
              ? "Warning"
              : "Danger"}
          </Badge>
        </button>
      ))}
    </div>
  )}
</div>

      </div>
    </div>
  )
}

