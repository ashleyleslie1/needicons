import { useState } from "react";
import { Slider } from "@/components/ui/slider";
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

const TOOLS = [
  { id: "color" as const, icon: "🎨", label: "Color" },
  { id: "edge" as const, icon: "✂️", label: "Edge" },
  { id: "upscale" as const, icon: "🔍", label: "Upscale" },
  { id: "denoise" as const, icon: "🧹", label: "Denoise" },
];

function hasToolApplied(record: GenerationRecord, toolId: string): boolean {
  switch (toolId) {
    case "color": return record.color_brightness !== 0 || record.color_contrast !== 0 || record.color_saturation !== 0;
    case "edge": return record.edge_feather > 0;
    case "upscale": return record.upscale_factor > 1;
    case "denoise": return record.denoise_strength > 0;
    default: return false;
  }
}

export function ToolPanel({ record, onColorAdjust, onEdgeCleanup, onUpscale, onDenoise, isProcessing }: ToolPanelProps) {
  const [expanded, setExpanded] = useState<ToolId>(null);
  const [brightness, setBrightness] = useState(record.color_brightness);
  const [contrast, setContrast] = useState(record.color_contrast);
  const [saturation, setSaturation] = useState(record.color_saturation);
  const [feather, setFeather] = useState(record.edge_feather);
  const [denoiseStr, setDenoiseStr] = useState(record.denoise_strength);

  return (
    <div className="space-y-1">
      {/* Toolbar */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground mr-1">Tools</span>
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setExpanded(expanded === tool.id ? null : tool.id)}
            className={cn(
              "relative px-2 py-1 rounded text-xs transition-colors",
              expanded === tool.id ? "bg-accent text-accent-foreground" : "bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{tool.icon}</span>
            {hasToolApplied(record, tool.id) && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent" />
            )}
          </button>
        ))}
        {isProcessing && (
          <svg className="h-3 w-3 animate-spin text-muted-foreground ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
          </svg>
        )}
      </div>

      {/* Expanded tool controls */}
      {expanded === "color" && (
        <div className="bg-muted/30 rounded-md p-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16">Brightness</span>
            <Slider value={[brightness]} onValueChange={([v]) => { setBrightness(v); onColorAdjust(v, contrast, saturation); }} min={-100} max={100} step={5} className="flex-1" />
            <span className="text-[10px] tabular-nums w-8 text-right">{brightness}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16">Contrast</span>
            <Slider value={[contrast]} onValueChange={([v]) => { setContrast(v); onColorAdjust(brightness, v, saturation); }} min={-100} max={100} step={5} className="flex-1" />
            <span className="text-[10px] tabular-nums w-8 text-right">{contrast}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16">Saturation</span>
            <Slider value={[saturation]} onValueChange={([v]) => { setSaturation(v); onColorAdjust(brightness, contrast, v); }} min={-100} max={100} step={5} className="flex-1" />
            <span className="text-[10px] tabular-nums w-8 text-right">{saturation}</span>
          </div>
        </div>
      )}

      {expanded === "edge" && (
        <div className="bg-muted/30 rounded-md p-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16">Feather</span>
            <Slider value={[feather]} onValueChange={([v]) => { setFeather(v); onEdgeCleanup(v); }} min={0} max={10} step={1} className="flex-1" />
            <span className="text-[10px] tabular-nums w-8 text-right">{feather}</span>
          </div>
        </div>
      )}

      {expanded === "upscale" && (
        <div className="bg-muted/30 rounded-md p-2 flex gap-2">
          <button
            onClick={() => onUpscale(2)}
            className={cn("px-3 py-1 rounded text-xs", record.upscale_factor === 2 ? "bg-accent text-accent-foreground" : "bg-muted/60 text-muted-foreground")}
          >
            2x
          </button>
          <button
            onClick={() => onUpscale(4)}
            className={cn("px-3 py-1 rounded text-xs", record.upscale_factor === 4 ? "bg-accent text-accent-foreground" : "bg-muted/60 text-muted-foreground")}
          >
            4x
          </button>
          {record.upscale_factor > 1 && (
            <button onClick={() => onUpscale(1)} className="px-3 py-1 rounded text-xs text-muted-foreground hover:text-foreground">
              Reset
            </button>
          )}
        </div>
      )}

      {expanded === "denoise" && (
        <div className="bg-muted/30 rounded-md p-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-16">Strength</span>
            <Slider value={[denoiseStr]} onValueChange={([v]) => { setDenoiseStr(v); onDenoise(v); }} min={0} max={10} step={1} className="flex-1" />
            <span className="text-[10px] tabular-nums w-8 text-right">{denoiseStr}</span>
          </div>
        </div>
      )}
    </div>
  );
}
