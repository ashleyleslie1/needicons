import type { PostProcessingSettings } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";

interface ControlsBarProps {
  settings: PostProcessingSettings;
  onChange: (settings: PostProcessingSettings) => void;
  onExport: () => void;
  iconCount: number;
  selectedCount?: number;
  onAutoFitSelected?: () => void;
  onRotateSelected?: (degrees: number) => void;
  isBulkProcessing?: boolean;
}

export function ControlsBar({ settings, onChange, selectedCount, onAutoFitSelected, onRotateSelected, isBulkProcessing }: ControlsBarProps) {
  function updateStroke(updates: Partial<typeof settings.stroke>) {
    onChange({ ...settings, stroke: { ...settings.stroke, ...updates } });
  }
  function updateShadow(updates: Partial<typeof settings.shadow>) {
    onChange({ ...settings, shadow: { ...settings.shadow, ...updates } });
  }
  function updateFill(updates: Partial<typeof settings.fill>) {
    onChange({ ...settings, fill: { ...settings.fill, ...updates } });
  }
  function updateMask(updates: Partial<typeof settings.mask>) {
    onChange({ ...settings, mask: { ...settings.mask, ...updates } });
  }

  const hasBg = settings.fill.type !== "none";

  return (
    <div className="border-b border-border/50 bg-card/20 backdrop-blur-sm px-8 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Outline */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Outline</span>
          <Switch
            checked={settings.stroke.enabled}
            onCheckedChange={(checked) => updateStroke({ enabled: checked })}
          />
          {settings.stroke.enabled && (
            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border/50">
              <Slider
                value={[settings.stroke.width]}
                onValueChange={([v]) => updateStroke({ width: v })}
                min={1} max={20} step={1} className="w-20"
              />
              <span className="text-[10px] text-muted-foreground tabular-nums w-5">{settings.stroke.width}</span>
              <input
                type="color"
                value={settings.stroke.color}
                onChange={(e) => updateStroke({ color: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border border-border/50"
              />
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border/50" />

        {/* Shadow */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Shadow</span>
          <Switch
            checked={settings.shadow.enabled}
            onCheckedChange={(checked) => updateShadow({ enabled: checked })}
          />
          {settings.shadow.enabled && (
            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border/50">
              <input
                type="color"
                value={settings.shadow.color.slice(0, 7)}
                onChange={(e) => updateShadow({ color: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border border-border/50"
              />
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border/50" />

        {/* Background */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Background</span>
          {hasBg ? (
            <button
              onClick={() => updateFill({ type: "none" })}
              className="h-5 w-5 rounded border border-border/50 cursor-pointer"
              style={{ backgroundColor: settings.fill.color }}
              title="Click to remove background"
            />
          ) : (
            <button
              onClick={() => updateFill({ type: "solid", color: "#FFFFFF" })}
              className="h-5 w-5 rounded border border-border/50 cursor-pointer"
              style={{
                backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                backgroundSize: "6px 6px",
                backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
              }}
              title="Transparent — click to add background"
            />
          )}
          {hasBg && (
            <div className="flex items-center gap-2 ml-1 pl-2 border-l border-border/50">
              <input
                type="color"
                value={settings.fill.color}
                onChange={(e) => updateFill({ color: e.target.value })}
                className="h-5 w-5 cursor-pointer rounded border border-border/50"
              />
              <span className="text-[10px] text-muted-foreground">Radius</span>
              <Slider
                value={[settings.mask.corner_radius]}
                onValueChange={([v]) => updateMask({ shape: v > 0 ? "rounded_rect" : "square", corner_radius: v })}
                min={0} max={50} step={2} className="w-16"
              />
              <span className="text-[10px] text-muted-foreground tabular-nums w-5">{settings.mask.corner_radius}</span>
            </div>
          )}
        </div>

        {/* Bulk adjust */}
        <div className={`flex items-center gap-2 transition-opacity ${(selectedCount ?? 0) > 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <div className="h-4 w-px bg-border/50" />
          <div className="flex items-center gap-2">
              {onAutoFitSelected && (
                <button
                  onClick={onAutoFitSelected}
                  disabled={isBulkProcessing}
                  className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-all hover:bg-accent hover:text-white hover:border-accent disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isBulkProcessing ? "Fitting..." : "Auto fit"}
                </button>
              )}
              {onRotateSelected && (
                <>
                  <button
                    onClick={() => onRotateSelected(-15)}
                    disabled={isBulkProcessing}
                    className="flex items-center justify-center h-6 w-6 rounded-md border border-border/50 bg-background text-[11px] font-bold text-foreground transition-all hover:bg-accent hover:text-white hover:border-accent disabled:opacity-50"
                    title="Rotate selected -15°"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => onRotateSelected(15)}
                    disabled={isBulkProcessing}
                    className="flex items-center justify-center h-6 w-6 rounded-md border border-border/50 bg-background text-[11px] font-bold text-foreground transition-all hover:bg-accent hover:text-white hover:border-accent disabled:opacity-50"
                    title="Rotate selected +15°"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                    </svg>
                  </button>
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
