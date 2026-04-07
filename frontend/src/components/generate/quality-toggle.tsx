import type { QualityMode } from "@/lib/types";
import { cn } from "@/lib/utils";

interface QualityToggleProps {
  value: QualityMode;
  onChange: (quality: QualityMode) => void;
}

export function QualityToggle({ value, onChange }: QualityToggleProps) {
  return (
    <div className="flex rounded-lg bg-muted p-1">
      <button
        onClick={() => onChange("normal")}
        className={cn(
          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
          value === "normal"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Normal
      </button>
      <button
        onClick={() => onChange("hq")}
        className={cn(
          "rounded-md px-3 py-1 text-xs font-medium transition-colors",
          value === "hq"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        HQ
      </button>
    </div>
  );
}
