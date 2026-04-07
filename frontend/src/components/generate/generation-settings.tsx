import { useModelCapabilities, useSettings } from "@/hooks/api/use-settings";
import { useEdition } from "@/hooks/use-edition";
import { Button } from "@/components/ui/button";
import type { QualityMode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GenerationSettingsProps {
  quality: QualityMode;
  onQualityChange: (quality: QualityMode) => void;
  apiQuality: string;
  onApiQualityChange: (apiQuality: string) => void;
  aiEnhance: boolean;
  onAiEnhanceChange: (value: boolean) => void;
}

export function GenerationSettings({
  quality,
  onQualityChange,
  apiQuality,
  onApiQualityChange,
  aiEnhance,
  onAiEnhanceChange,
}: GenerationSettingsProps) {
  const { data: capabilities } = useModelCapabilities();
  const { data: settings } = useSettings();
  const { showAllQualityOptions } = useEdition();
  const currentModel = settings?.provider?.default_model ?? "gpt-image-1.5";
  const modelCaps = capabilities?.[currentModel];
  const qualities = modelCaps?.qualities ?? [];

  return (
    <div className="flex items-center gap-2">
      {/* Quality toggle */}
      <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
        {(["normal", "hq"] as const).map((q) => (
          <button
            key={q}
            onClick={() => onQualityChange(q)}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-all",
              quality === q
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {q === "hq" ? "HQ" : "Normal"}
          </button>
        ))}
      </div>

      {/* API Quality */}
      {showAllQualityOptions && qualities.length > 0 && (
        <select
          value={apiQuality || qualities[qualities.length - 1]}
          onChange={(e) => onApiQualityChange(e.target.value)}
          className="h-7 rounded-lg border border-border bg-card/80 px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
        >
          {qualities.map((q) => (
            <option key={q} value={q}>{q.charAt(0).toUpperCase() + q.slice(1)}</option>
          ))}
        </select>
      )}

      {/* AI Enhance */}
      <Button
        variant={aiEnhance ? "default" : "outline"}
        size="sm"
        className={cn("h-7 px-3 text-xs gap-1.5", !aiEnhance && "text-muted-foreground")}
        onClick={() => onAiEnhanceChange(!aiEnhance)}
      >
        AI Enhance
      </Button>
    </div>
  );
}
