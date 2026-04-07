import { useModelCapabilities, useSettings } from "@/hooks/api/use-settings";
import type { QualityMode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GenerationSettingsProps {
  quality: QualityMode;
  onQualityChange: (quality: QualityMode) => void;
  apiQuality: string;
  onApiQualityChange: (apiQuality: string) => void;
}

export function GenerationSettings({
  quality,
  onQualityChange,
  apiQuality,
  onApiQualityChange,
}: GenerationSettingsProps) {
  const { data: capabilities } = useModelCapabilities();
  const { data: settings } = useSettings();

  const currentModel = settings?.provider?.default_model ?? "gpt-image-1.5";
  const modelCaps = capabilities?.[currentModel];
  const qualities = modelCaps?.qualities ?? [];

  return (
    <div className="flex items-center gap-3">
      {/* Mode toggle: Normal / HQ */}
      <div className="flex rounded-lg bg-muted p-1">
        <button
          onClick={() => onQualityChange("normal")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            quality === "normal"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Normal
        </button>
        <button
          onClick={() => onQualityChange("hq")}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            quality === "hq"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          HQ
        </button>
      </div>

      {/* API Quality dropdown (model-specific) */}
      {qualities.length > 0 && (
        <select
          value={apiQuality || qualities[qualities.length - 1]}
          onChange={(e) => onApiQualityChange(e.target.value)}
          className="h-8 rounded-lg border border-border bg-muted px-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {qualities.map((q) => (
            <option key={q} value={q}>
              {q.charAt(0).toUpperCase() + q.slice(1)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
