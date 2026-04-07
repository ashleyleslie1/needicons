import type { PostProcessingSettings } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ControlsBarProps {
  settings: PostProcessingSettings;
  onChange: (settings: PostProcessingSettings) => void;
  onExport: () => void;
  iconCount: number;
}

const SHAPES = [
  { value: "none", label: "\u2014", title: "None" },
  { value: "circle", label: "\u25CB", title: "Circle" },
  { value: "rounded_rect", label: "\u25A2", title: "Rounded" },
  { value: "square", label: "\u25A1", title: "Square" },
] as const;

export function ControlsBar({ settings, onChange, onExport, iconCount }: ControlsBarProps) {
  function updateStroke(updates: Partial<typeof settings.stroke>) {
    onChange({ ...settings, stroke: { ...settings.stroke, ...updates } });
  }
  function updateShadow(updates: Partial<typeof settings.shadow>) {
    onChange({ ...settings, shadow: { ...settings.shadow, ...updates } });
  }
  function updateMask(updates: Partial<typeof settings.mask>) {
    onChange({ ...settings, mask: { ...settings.mask, ...updates } });
  }
  function updatePadding(updates: Partial<typeof settings.padding>) {
    onChange({ ...settings, padding: { ...settings.padding, ...updates } });
  }

  return (
    <div className="border-b border-border bg-card/50 px-8 py-5">
      <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Outline</span>
          <Switch
            checked={settings.stroke.enabled}
            onCheckedChange={(checked) => updateStroke({ enabled: checked })}
          />
          {settings.stroke.enabled && (
            <>
              <span className="text-[11px] text-muted-foreground">Thickness</span>
              <Slider
                value={[settings.stroke.width]}
                onValueChange={([v]) => updateStroke({ width: v })}
                min={1} max={20} step={1} className="w-24"
              />
              <span className="text-[11px] text-muted-foreground">{settings.stroke.width}px</span>
              <span className="text-[11px] text-muted-foreground">Color</span>
              <input
                type="color"
                value={settings.stroke.color}
                onChange={(e) => updateStroke({ color: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border border-border"
              />
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Shadow</span>
          <Switch
            checked={settings.shadow.enabled}
            onCheckedChange={(checked) => updateShadow({ enabled: checked })}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Shape</span>
          <div className="flex gap-1">
            {SHAPES.map((shape) => (
              <button
                key={shape.value}
                onClick={() => updateMask({ shape: shape.value })}
                title={shape.title}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded border text-sm transition-colors",
                  settings.mask.shape === shape.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground hover:border-muted-foreground",
                )}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Padding</span>
          <Slider
            value={[settings.padding.percent ?? 10]}
            onValueChange={([v]) => updatePadding({ percent: v })}
            min={0} max={30} step={1} className="w-20"
          />
          <span className="text-[11px] text-muted-foreground">{settings.padding.percent ?? 10}%</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={onExport}
            disabled={iconCount === 0}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
