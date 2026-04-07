import { useModelCapabilities } from "@/hooks/api/use-settings";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface QualityToggleProps {
  model: string;
  value: string;
  onChange: (value: string) => void;
}

export function QualityToggle({ model, value, onChange }: QualityToggleProps) {
  const { data: capabilities } = useModelCapabilities();
  const modelCaps = capabilities?.[model];
  const qualities = modelCaps?.qualities ?? ["standard"];

  const currentValue = value || qualities[Math.floor(qualities.length / 2)] || qualities[0];

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Quality
        </label>
      </div>
      <ToggleGroup
        type="single"
        value={currentValue}
        onValueChange={(v) => v && onChange(v)}
        className="border border-border rounded-lg bg-muted/30 p-0.5 w-full"
      >
        {qualities.map((q) => (
          <ToggleGroupItem
            key={q}
            value={q}
            className="flex-1 rounded-md px-3 py-1 text-xs font-medium data-[state=on]:bg-accent/15 data-[state=on]:text-accent"
          >
            {q.charAt(0).toUpperCase() + q.slice(1)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
