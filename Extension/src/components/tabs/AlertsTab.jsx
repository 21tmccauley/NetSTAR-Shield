import { Button } from "@/components/ui/button"

export function AlertsTab({ mode }) {
  return (
    <div className="p-6 space-y-4">
      {/* High Priority - Friendly but urgent */}
      <div className="bg-gradient-to-br from-red-500 to-pink-500 text-white p-5 rounded-2xl shadow-lg">
        <div className="text-center mb-4">
          <div className="text-5xl mb-2 animate-bounce">⚠️</div>
          <div className="font-bold text-xl mb-2">Hold On!</div>
          <div className="text-sm opacity-90">This website might not be safe</div>
        </div>
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 mb-4">
          <div className="text-sm">
            We found signs of phishing and malware. We recommend leaving this site to protect your information.
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 bg-white text-red-600 hover:bg-red-50">
            Take Me Back
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/20">
            Tell Me More
          </Button>
        </div>
      </div>
    </div>
  )
}
