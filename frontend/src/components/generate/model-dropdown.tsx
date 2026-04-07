import { useModelCapabilities, useSettings } from "@/hooks/api/use-settings";
import { cn } from "@/lib/utils";

interface ModelDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function ModelDropdown({ value, onChange }: ModelDropdownProps) {
  const { data: settings } = useSettings();
  const { data: capabilities } = useModelCapabilities();

  const currentModel = value || settings?.provider?.default_model || "gpt-image-1";
  const availableModels = capabilities ? Object.keys(capabilities) : [currentModel];

  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block font-medium">
        Model
      </label>
      <div className="relative">
        <select
          value={currentModel}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none rounded-lg border border-border bg-card/80 backdrop-blur-sm",
            "px-3 pr-8 py-2 text-sm text-foreground",
            "cursor-pointer transition-colors",
            "hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
          )}
        >
          {availableModels.map((modelId) => (
            <option key={modelId} value={modelId}>
              {capabilities?.[modelId]?.label ?? modelId}
            </option>
          ))}
        </select>
        <svg
          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
