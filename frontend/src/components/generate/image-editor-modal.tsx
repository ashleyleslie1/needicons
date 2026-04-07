import { useState } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useRemoveBackground, useColorAdjust, useEdgeCleanup, useUpscale, useDenoise } from "@/hooks/api/use-generate-v2";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
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

  const tools: { id: Exclude<ToolId, null>; label: string; desc: string; active: boolean }[] = [
    { id: "bg", label: "BG Remove", desc: "Remove background", active: record.bg_removal_level > 0 },
    { id: "denoise", label: "Denoise", desc: "Reduce noise", active: record.denoise_strength > 0 },
    { id: "color", label: "Color", desc: "Adjust colors", active: record.color_brightness !== 0 || record.color_contrast !== 0 || record.color_saturation !== 0 },
    { id: "edge", label: "Edges", desc: "Clean edges", active: record.edge_feather > 0 },
    { id: "upscale", label: "Upscale", desc: "Increase resolution", active: record.upscale_factor > 1 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden border-border">
        <div className="flex" style={{ minHeight: "540px" }}>
          {/* Left: Image preview with checkerboard */}
          <div className="flex-1 flex flex-col relative">
            {/* Processing overlay */}
            {anyProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 shadow-lg border border-border">
                  <Spinner className="h-4 w-4 text-accent" />
                  <span className="text-sm text-foreground">Processing...</span>
                </div>
              </div>
            )}

            {/* Checkerboard + image */}
            <div className="flex-1 flex items-center justify-center p-8"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, var(--muted) 25%, transparent 25%),
                  linear-gradient(-45deg, var(--muted) 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, var(--muted) 75%),
                  linear-gradient(-45deg, transparent 75%, var(--muted) 75%)
                `,
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
              }}
            >
              <img
                src={`/api/images/${variation.preview_path}?t=${cacheBust(record)}`}
                alt={`${record.name} v${variationIndex + 1}`}
                className="max-h-[420px] max-w-full object-contain drop-shadow-lg"
                style={{ imageRendering: "auto" }}
              />
            </div>

            {/* Bottom bar */}
            <div className="flex items-center gap-3 border-t border-border px-4 py-3 bg-card/50">
              <Button
                variant={variation.picked ? "default" : "outline"}
                size="sm"
                onClick={handlePick}
                disabled={pickVariation.isPending || unpickVariation.isPending}
                className="gap-1.5"
              >
                {variation.picked ? (
                  <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg> Picked</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 2v8M2 6h8"/></svg> Pick for Project</>
                )}
              </Button>
              <div className="flex items-center gap-2 ml-auto text-[11px] text-muted-foreground">
                <span>{record.name}</span>
                <span>Variation {variationIndex + 1} of {record.variations.length}</span>
              </div>
            </div>
          </div>

          {/* Right: Tools sidebar */}
          <div className="w-[240px] shrink-0 border-l border-border flex flex-col bg-card/80">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Edit</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">{record.style} / {record.model || "default"}</p>
            </div>

            {/* Tool buttons */}
            <div className="p-2 space-y-1">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    activeTool === tool.id
                      ? "bg-accent/10 border border-accent/20"
                      : "hover:bg-muted/50 border border-transparent",
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-xs font-medium",
                      activeTool === tool.id ? "text-accent" : "text-foreground",
                    )}>
                      {tool.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{tool.desc}</div>
                  </div>
                  {tool.active && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                </button>
              ))}
            </div>

            {/* Active tool controls */}
            <div className="px-3 pb-3 flex-1">
              {activeTool === "bg" && (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Level</span>
                    <span className={cn("text-[11px] font-semibold", bgLevel === 0 ? "text-muted-foreground" : "text-foreground")}>
                      {bgLevel === 0 ? "Off" : `${bgLevel} — ${getLevelLabel(bgLevel)}`}
                    </span>
                  </div>
                  <Slider
                    value={[bgLevel]}
                    onValueChange={([v]) => { setBgLevel(v); removeBackground.mutate(record.id, v); }}
                    min={0} max={10} step={1}
                  />
                </div>
              )}

              {activeTool === "denoise" && (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-3">
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
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-3">
                  {([
                    ["Brightness", brightness, (v: number) => { setBrightness(v); colorAdjust.mutate(record.id, v, contrast, saturation); }],
                    ["Contrast", contrast, (v: number) => { setContrast(v); colorAdjust.mutate(record.id, brightness, v, saturation); }],
                    ["Saturation", saturation, (v: number) => { setSaturation(v); colorAdjust.mutate(record.id, brightness, contrast, v); }],
                  ] as const).map(([label, value, onChange]) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-muted-foreground">{label}</span>
                        <span className="text-[11px] font-semibold text-foreground">{value}</span>
                      </div>
                      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={-100} max={100} step={5} />
                    </div>
                  ))}
                </div>
              )}

              {activeTool === "edge" && (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-3">
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
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground mb-1">Scale factor</p>
                  <div className="flex gap-2">
                    {[2, 4].map((f) => (
                      <Button
                        key={f}
                        variant={record.upscale_factor === f ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => upscaleHook.mutate({ generationId: record.id, factor: f })}
                        disabled={anyProcessing}
                      >
                        {f}x
                      </Button>
                    ))}
                  </div>
                  {record.upscale_factor > 1 && (
                    <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground" onClick={() => upscaleHook.mutate({ generationId: record.id, factor: 1 })} disabled={anyProcessing}>
                      Reset to original
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Info footer */}
            <div className="mt-auto border-t border-border px-4 py-3 space-y-1.5">
              {[
                ["Prompt", record.prompt],
                ["Style", record.style],
                ["Model", record.model || "default"],
                ["Mood", record.mood && record.mood !== "none" ? record.mood : null],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label as string} className="flex justify-between gap-3 text-[10px]">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="text-foreground truncate text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
