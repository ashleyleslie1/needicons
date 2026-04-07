import { useState, useRef } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useRemoveBackground, useColorAdjust, useEdgeCleanup, useUpscale, useDenoise, useAddLassoMask, useDeleteLassoMask, useLassoStrategies } from "@/hooks/api/use-generate-v2";
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
  `${r.bg_removal_level}-${r.denoise_strength}-${r.color_brightness}-${r.edge_feather}-${r.upscale_factor}-${r.lasso_masks.length}`;

type ToolId = "bg" | "color" | "edge" | "upscale" | "denoise" | "lasso" | null;

export function ImageEditorModal({ record, variationIndex, open, onOpenChange }: ImageEditorModalProps) {
  const variation = record.variations.find((v) => v.index === variationIndex);
  const pickVariation = usePickVariation();
  const unpickVariation = useUnpickVariation();
  const removeBackground = useRemoveBackground();
  const colorAdjust = useColorAdjust();
  const edgeCleanup = useEdgeCleanup();
  const upscaleHook = useUpscale();
  const denoiseHook = useDenoise();
  const addLassoMask = useAddLassoMask();
  const deleteLassoMask = useDeleteLassoMask();
  const { data: strategiesData } = useLassoStrategies();
  const availableStrategies = strategiesData?.strategies ?? ["grabcut"];

  const [activeTool, setActiveTool] = useState<ToolId>(null);
  const [bgLevel, setBgLevel] = useState(record.bg_removal_level);
  const [brightness, setBrightness] = useState(record.color_brightness);
  const [contrast, setContrast] = useState(record.color_contrast);
  const [saturation, setSaturation] = useState(record.color_saturation);
  const [feather, setFeather] = useState(record.edge_feather);
  const [denoiseStr, setDenoiseStr] = useState(record.denoise_strength);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const [lassoMode, setLassoMode] = useState<"remove" | "protect">("remove");
  const [lassoStrategy, setLassoStrategy] = useState("grabcut");
  const [lassoTolerance, setLassoTolerance] = useState(32);

  const anyProcessing = removeBackground.isPending || colorAdjust.isPending || edgeCleanup.isPending || upscaleHook.isPending || denoiseHook.isPending || addLassoMask.isPending || deleteLassoMask.isPending;

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

  const toolIcons: Record<string, React.ReactNode> = {
    bg: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18"/></svg>,
    denoise: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"/><path d="M8 7v10"/><path d="M16 7v10"/><path d="M4 11v2"/><path d="M20 11v2"/></svg>,
    color: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2"/><path d="M12 21v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M1 12h2"/><path d="M21 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>,
    edge: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z"/></svg>,
    upscale: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>,
    lasso: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="10" rx="9" ry="7"/><path d="M21 10c0 2.5-1.5 5-3 6.5"/><circle cx="18" cy="18" r="3"/></svg>,
  };

  const tools: { id: Exclude<ToolId, null>; label: string; desc: string; active: boolean }[] = [
    { id: "bg", label: "BG Remove", desc: "Remove background", active: record.bg_removal_level > 0 },
    { id: "denoise", label: "Denoise", desc: "Reduce noise", active: record.denoise_strength > 0 },
    { id: "color", label: "Color", desc: "Adjust colors", active: record.color_brightness !== 0 || record.color_contrast !== 0 || record.color_saturation !== 0 },
    { id: "edge", label: "Edges", desc: "Clean edges", active: record.edge_feather > 0 },
    { id: "upscale", label: "Upscale", desc: "Increase resolution", active: record.upscale_factor > 1 },
    { id: "lasso", label: "Lasso", desc: "Manual selection", active: record.lasso_masks.length > 0 },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden border-border bg-background">
        <div className="flex" style={{ height: "540px" }}>
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
            <div
              className="flex-1 flex items-center justify-center p-6 overflow-hidden"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, var(--muted) 25%, transparent 25%),
                  linear-gradient(-45deg, var(--muted) 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, var(--muted) 75%),
                  linear-gradient(-45deg, transparent 75%, var(--muted) 75%)
                `,
                backgroundSize: "16px 16px",
                backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                cursor: isPanning ? "grabbing" : zoom > 1 ? "grab" : "default",
              }}
              onWheel={(e) => {
                e.preventDefault();
                setZoom((z) => {
                  const next = Math.min(3, Math.max(0.5, z + (e.deltaY > 0 ? -0.1 : 0.1)));
                  if (next <= 1) { setPanX(0); setPanY(0); }
                  return next;
                });
              }}
              onMouseDown={(e) => {
                if (zoom <= 1 || activeTool === "lasso") return;
                e.preventDefault();
                setIsPanning(true);
                panStart.current = { x: e.clientX, y: e.clientY, panX, panY };
              }}
              onMouseMove={(e) => {
                if (!isPanning) return;
                const maxPan = 50;
                const dx = e.clientX - panStart.current.x;
                const dy = e.clientY - panStart.current.y;
                setPanX(Math.max(-maxPan, Math.min(maxPan, panStart.current.panX + dx * 0.5)));
                setPanY(Math.max(-maxPan, Math.min(maxPan, panStart.current.panY + dy * 0.5)));
              }}
              onMouseUp={() => setIsPanning(false)}
              onMouseLeave={() => setIsPanning(false)}
            >
              <img
                src={`/api/images/${variation.preview_path}?t=${cacheBust(record)}`}
                alt={`${record.name} v${variationIndex + 1}`}
                draggable={false}
                className={cn(
                  "max-h-[420px] max-w-full object-contain drop-shadow-lg transition-transform duration-100 select-none",
                  activeTool === "lasso" && "cursor-crosshair",
                )}
                style={{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)` }}
                onClick={(e) => {
                  if (activeTool !== "lasso" || anyProcessing) return;
                  const img = e.currentTarget;
                  const rect = img.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width;
                  const y = (e.clientY - rect.top) / rect.height;
                  addLassoMask.mutate({
                    generationId: record.id,
                    point: [x, y],
                    mode: lassoMode,
                    strategy: lassoStrategy,
                    tolerance: lassoTolerance,
                  });
                }}
              />
            </div>

            {/* Zoom indicator */}
            {zoom !== 1 && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border px-2 py-1 shadow-sm">
                <span className="text-[10px] font-semibold text-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
                <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Reset</button>
              </div>
            )}

            {/* Bottom bar */}
            <div className="flex items-center gap-3 border-t border-border px-4 py-3 bg-background">
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
          <div className="w-[240px] shrink-0 border-l border-border flex flex-col bg-background">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Edit</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">{record.style} / {record.model || "default"}</p>
            </div>

            {/* Tool buttons — 3x2 grid */}
            <div className="grid grid-cols-3 gap-1 p-2 border-b border-border">
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(activeTool === tool.id ? null : tool.id)}
                  title={tool.desc}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 rounded-lg py-2.5 transition-colors",
                    activeTool === tool.id
                      ? "bg-accent/10 border border-accent/30 text-accent"
                      : "bg-muted/30 border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {toolIcons[tool.id]}
                  <span className="text-[9px] font-medium leading-none">{tool.label}</span>
                  {tool.active && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>
              ))}
            </div>

            {/* Active tool controls — fixed area */}
            <div className="flex-1 px-3 py-3 overflow-hidden">
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

              {activeTool === "lasso" && (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-3">
                  <p className="text-[10px] text-muted-foreground">Click on the area you want to select. It auto-expands to find the region.</p>

                  {/* Mode toggle */}
                  <div>
                    <span className="text-[11px] text-muted-foreground mb-1.5 block">Mode</span>
                    <div className="flex gap-1.5">
                      <Button
                        variant={lassoMode === "remove" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setLassoMode("remove")}
                      >
                        Remove
                      </Button>
                      <Button
                        variant={lassoMode === "protect" ? "default" : "outline"}
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => setLassoMode("protect")}
                      >
                        Protect
                      </Button>
                    </div>
                  </div>

                  {/* Tolerance slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] text-muted-foreground">Tolerance</span>
                      <span className="text-[11px] font-semibold text-foreground">{lassoTolerance}</span>
                    </div>
                    <Slider
                      value={[lassoTolerance]}
                      onValueChange={([v]) => setLassoTolerance(v)}
                      min={1} max={128} step={1}
                    />
                  </div>

                  {/* Strategy picker */}
                  <div>
                    <span className="text-[11px] text-muted-foreground mb-1.5 block">Strategy</span>
                    <select
                      value={lassoStrategy}
                      onChange={(e) => setLassoStrategy(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                    >
                      {["grabcut", "sam", "cascadepsp"].map((s) => (
                        <option key={s} value={s} disabled={!availableStrategies.includes(s)}>
                          {s === "grabcut" ? "GrabCut" : s === "sam" ? "SAM" : "CascadePSP"}
                          {!availableStrategies.includes(s) ? " (not installed)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Selection list */}
                  {record.lasso_masks.length > 0 && (
                    <div>
                      <span className="text-[11px] text-muted-foreground mb-1.5 block">
                        Selections ({record.lasso_masks.length})
                      </span>
                      <div className="space-y-1">
                        {record.lasso_masks.map((mask) => (
                          <div
                            key={mask.id}
                            className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1"
                          >
                            <span className={`text-[10px] font-medium ${mask.mode === "remove" ? "text-red-400" : "text-blue-400"}`}>
                              {mask.mode === "remove" ? "Remove" : "Protect"}
                            </span>
                            <button
                              onClick={() => deleteLassoMask.mutate({ generationId: record.id, maskId: mask.id })}
                              disabled={anyProcessing}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M1 1l8 8M9 1l-8 8" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-7 text-xs text-muted-foreground mt-1.5"
                        disabled={anyProcessing}
                        onClick={() => {
                          for (const mask of record.lasso_masks) {
                            deleteLassoMask.mutate({ generationId: record.id, maskId: mask.id });
                          }
                        }}
                      >
                        Clear all
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Info footer */}
            <div className="shrink-0 border-t border-border px-4 py-3 space-y-1.5">
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
