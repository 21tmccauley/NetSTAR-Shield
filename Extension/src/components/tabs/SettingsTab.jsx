import { Button } from "@/components/ui/button"

export function SettingsTab({ mode, onBack, onStartTour }) {
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
          className={`border rounded-2xl p-5 ${mode === "dark" ? "border-slate-700 bg-slate-800/30" : "border-slate-200 bg-slate-50"}`}
        >
          <h3 className={`font-medium mb-2 ${mode === "dark" ? "text-white" : "text-slate-900"}`}>
            Notifications
          </h3>
          <p className={`text-sm ${mode === "dark" ? "text-slate-300" : "text-slate-600"}`}>
            Manage alert and notification preferences
          </p>
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

