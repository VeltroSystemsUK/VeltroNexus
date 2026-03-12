import { Card, CardContent } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { usePageTitle } from "@/context/LayoutContext";

export default function AIStudio() {
  usePageTitle("AI Studio", "AI-powered underwriting workspace");

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border-white/10 bg-white/[0.02]">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-violet-500/10">
            <Brain className="h-7 w-7 text-violet-500" />
          </div>
          <h2 className="text-xl font-semibold text-white">AI Studio</h2>
          <p className="text-sm text-white/50 text-center max-w-xs">
            The AI-powered underwriting workspace is coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
