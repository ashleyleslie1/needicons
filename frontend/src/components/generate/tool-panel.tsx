import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GenerationRecord } from "@/lib/types";

interface ToolPanelProps {
  record: GenerationRecord;
  onColorAdjust: (brightness: number, contrast: number, saturation: number) => void;
  onEdgeCleanup: (feather: number) => void;
  onUpscale: (factor: number) => void;
  onDenoise: (strength: number) => void;
  isProcessing: boolean;
}

type ToolId = "color" | "edge" | "upscale" | "denoise" | null;

export function ToolPanel({ record, onColorAdjust, onEdgeCleanup, onUpscale, onDenoise, isProcessing }: ToolPanelProps) {
  const [expanded, setExpanded] = useState<ToolId>(null);
  const [brightness, setBrightness] = useState(record.color_brightness);
  const [contrast, setContrast] = useState(record.color_contrast);
  const [saturation, setSaturation] = useState(record.color_saturation);
  const [feather, setFeather] = useState(record.edge_feather);
  const [denoiseStr, setDenoiseStr] = useState(record.denoise_strength);

  const tools: { id: Exclude<ToolId, null>; label: string; active: boolean }[] = [
    { id: "color", label: "Color", active: record.color_brightness !== 0 || record.color_contrast !== 0 || record.color_saturation !== 0 },
    { id: "edge", label: "Edges", active: record.edge_feather > 0 },
    { id: "upscale", label: "Upscale", active: record.upscale_factor > 1 },
    { id: "denoise", label: "Denoise", active: record.denoise_strength > 0 },
  ];

  return (
    <div className="rounded-lg bg-muted/30 border border-border p-2 space-y-2">
      {/* Tool tabs */}
      <div className="flex gap-1">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant={expanded === tool.id ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "h-6 px-2.5 text-[10px] font-medium relative",
              expanded === tool.id && "bg-accent/15 text-accent",
            )}
            onClick={() => setExpanded(expanded === tool.id ? null : tool.id)}
          >
            {tool.label}
            {tool.active && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </Button>
        ))}
      </div>

      {/* Color controls */}
      {expanded === "color" && (
        <div className="space-y-1.5 pt-1">
          {([
            ["Brightness", brightness, (v: number) => { setBrightness(v); onColorAdjust(v, contrast, saturation); }],
            ["Contrast", contrast, (v: number) => { setContrast(v); onColorAdjust(brightness, v, saturation); }],
            ["Saturation", saturation, (v: number) => { setSaturation(v); onColorAdjust(brightness, contrast, v); }],
          ] as const).map(([label, value, onChange]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-14 shrink-0">{label}</span>
              <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={-100} max={100} step={5} className="flex-1" />
              <span className="text-[10px] tabular-nums w-8 text-right text-muted-foreground">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Edge controls */}
      {expanded === "edge" && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">Feather</span>
          <Slider value={[feather]} onValueChange={([v]) => { setFeather(v); onEdgeCleanup(v); }} min={0} max={10} step={1} className="flex-1" />
          <span className="text-[10px] tabular-nums w-8 text-right text-muted-foreground">{feather}</span>
        </div>
      )}

      {/* Upscale controls */}
      {expanded === "upscale" && (
        <div className="flex gap-1.5 pt-1">
          {[2, 4].map((f) => (
            <Button
              key={f}
              variant={record.upscale_factor === f ? "default" : "outline"}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onUpscale(f)}
              disabled={isProcessing}
            >
              {f}x
            </Button>
          ))}
          {record.upscale_factor > 1 && (
            <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={() => onUpscale(1)} disabled={isProcessing}>
              Reset
            </Button>
          )}
        </div>
      )}

      {/* Denoise controls */}
      {expanded === "denoise" && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-muted-foreground w-14 shrink-0">Strength</span>
          <Slider value={[denoiseStr]} onValueChange={([v]) => { setDenoiseStr(v); onDenoise(v); }} min={0} max={10} step={1} className="flex-1" />
          <span className="text-[10px] tabular-nums w-8 text-right text-muted-foreground">{denoiseStr}</span>
        </div>
      )}
    </div>
  );
}
