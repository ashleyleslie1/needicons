import { useState } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useRemoveBackground, useColorAdjust, useEdgeCleanup, useUpscale, useDenoise } from "@/hooks/api/use-generate-v2";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImageEditorModalProps {
  record: GenerationRecord;
  variationIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
    </svg>
  );
}

const cacheBust = (r: GenerationRecord) =>
  `${r.bg_removal_level}-${r.denoise_strength}-${r.color_brightness}-${r.edge_feather}-${r.upscale_factor}`;

type ToolId = "bg" | "color" | "edge" | "upscale" | "denoise" | null;

export function ImageEditorModal({ record, variationIndex, open, onOpenChange }: ImageEditorModalProps) {
  const variation = record.variations.find((v) => v.index === variationIndex);
  const pickVariation = usePickVariation();
  const unpickVariation = useUnpickVariation();
  const removeBackground = useRemoveBackground();
  const colorAdjust = useColorAdjust();
  const edgeCleanup = useEdgeCleanup();
  const upscaleHook = useUpscale();
  const denoiseHook = useDenoise();

  const [activeTool, setActiveTool] = useState<ToolId>(null);
  const [bgLevel, setBgLevel] = useState(record.bg_removal_level);
  const [brightness, setBrightness] = useState(record.color_brightness);
  const [contrast, setContrast] = useState(record.color_contrast);
  const [saturation, setSaturation] = useState(record.color_saturation);
  const [feather, setFeather] = useState(record.edge_feather);
  const [denoiseStr, setDenoiseStr] = useState(record.denoise_strength);

  const anyProcessing = removeBackground.isPending || colorAdjust.isPending || edgeCleanup.isPending || upscaleHook.isPending || denoiseHook.isPending;

  if (!variation) return null;

  function handlePick() {
    if (variation!.picked) unpickVariation.mutate(record.id);
    else pickVariation.mutate({ generationId: record.id, variationIndex });
  }

  function getLevelLabel(level: number) {
    if (level === 0) return "Off";
    if (level <= 3) return "Lite";
    if (level <= 7) return "Medium";
    return "Heavy";
  }

  const tools: { id: ToolId; label: string; active: boolean }[] = [
    { id: "bg", label: "BG Remove", active: record.bg_removal_level > 0 },
    { id: "denoise", label: "Denoise", active: record.denoise_strength > 0 },
    { id: "color", label: "Color", active: record.color_brightness !== 0 || record.color_contrast !== 0 || record.color_saturation !== 0 },
    { id: "edge", label: "Edges", active: record.edge_feather > 0 },
    { id: "upscale", label: "Upscale", active: record.upscale_factor > 1 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <div className="flex min-h-[480px]">
          {/* Left: Image preview */}
          <div className="flex-1 flex flex-col items-center justify-center bg-muted/20 p-6 relative">
            {anyProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <Spinner className="h-6 w-6 text-accent" />
              </div>
            )}
            <img
              src={`/api/images/${variation.preview_path}?t=${cacheBust(record)}`}
              alt={`${record.name} v${variationIndex + 1}`}
              className="max-h-[380px] max-w-full object-contain rounded-lg"
            />
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant={variation.picked ? "default" : "outline"}
                size="sm"
                onClick={handlePick}
                disabled={pickVariation.isPending || unpickVariation.isPending}
              >
                {variation.picked ? "Picked" : "Pick for Project"}
              </Button>
              <span className="text-xs text-muted-foreground">
                {record.name} — Variation {variationIndex + 1}
              </span>
            </div>
          </div>

          {/* Right: Tools sidebar */}
          <div className="w-[220px] shrink-0 border-l border-border flex flex-col bg-card/60">
            <DialogHeader className="p-4 pb-3">
              <DialogTitle className="text-sm">Edit Image</DialogTitle>
            </DialogHeader>

            {/* Tool buttons */}
            <div className="px-3 space-y-1">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left",
                    activeTool === tool.id
                      ? "bg-accent/15 text-accent"
                      : "text-foreground/70 hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  {tool.label}
                  {tool.active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>
              ))}
            </div>

            {/* Active tool controls */}
            <div className="flex-1 px-3 pt-3">
              {activeTool === "bg" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Level</span>
                    <span className="text-[11px] font-semibold text-foreground">{bgLevel === 0 ? "Off" : `${bgLevel} — ${getLevelLabel(bgLevel)}`}</span>
                  </div>
                  <Slider
                    value={[bgLevel]}
                    onValueChange={([v]) => { setBgLevel(v); removeBackground.mutate(record.id, v); }}
                    min={0} max={10} step={1}
                  />
                </div>
              )}

              {activeTool === "denoise" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Strength</span>
                    <span className="text-[11px] font-semibold text-foreground">{denoiseStr === 0 ? "Off" : denoiseStr}</span>
                  </div>
                  <Slider
                    value={[denoiseStr]}
                    onValueChange={([v]) => { setDenoiseStr(v); denoiseHook.mutate(record.id, v); }}
                    min={0} max={10} step={1}
                  />
                </div>
              )}

              {activeTool === "color" && (
                <div className="space-y-3">
                  {([
                    ["Brightness", brightness, (v: number) => { setBrightness(v); colorAdjust.mutate(record.id, v, contrast, saturation); }],
                    ["Contrast", contrast, (v: number) => { setContrast(v); colorAdjust.mutate(record.id, brightness, v, saturation); }],
                    ["Saturation", saturation, (v: number) => { setSaturation(v); colorAdjust.mutate(record.id, brightness, contrast, v); }],
                  ] as const).map(([label, value, onChange]) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-muted-foreground">{label}</span>
                        <span className="text-[11px] font-semibold text-foreground">{value}</span>
                      </div>
                      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={-100} max={100} step={5} />
                    </div>
                  ))}
                </div>
              )}

              {activeTool === "edge" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Feather</span>
                    <span className="text-[11px] font-semibold text-foreground">{feather === 0 ? "Off" : feather}</span>
                  </div>
                  <Slider
                    value={[feather]}
                    onValueChange={([v]) => { setFeather(v); edgeCleanup.mutate(record.id, v); }}
                    min={0} max={10} step={1}
                  />
                </div>
              )}

              {activeTool === "upscale" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">Scale factor</p>
                  <div className="flex gap-2">
                    {[2, 4].map((f) => (
                      <Button
                        key={f}
                        variant={record.upscale_factor === f ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => upscaleHook.mutate({ generationId: record.id, factor: f })}
                        disabled={anyProcessing}
                      >
                        {f}x
                      </Button>
                    ))}
                  </div>
                  {record.upscale_factor > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => upscaleHook.mutate({ generationId: record.id, factor: 1 })}
                      disabled={anyProcessing}
                    >
                      Reset
                    </Button>
                  )}
                </div>
              )}

              {activeTool === null && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Select a tool to edit this image. Changes apply in real-time.
                </p>
              )}
            </div>

            {/* Info section at bottom */}
            <div className="mt-auto border-t border-border p-3 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Style</span>
                <span className="text-foreground">{record.style}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Model</span>
                <span className="text-foreground">{record.model || "default"}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">Prompt</span>
                <span className="text-foreground truncate ml-4">{record.prompt}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
