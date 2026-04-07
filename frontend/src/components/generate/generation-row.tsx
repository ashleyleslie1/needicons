import { useState, useRef, useEffect, memo } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useDeleteGeneration, useRemoveBackground, useColorAdjust, useEdgeCleanup, useUpscale, useDenoise } from "@/hooks/api/use-generate-v2";
import { ToolPanel } from "@/components/generate/tool-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GenerationRowProps {
  record: GenerationRecord;
  layout: "list" | "grid";
  onRegenerate?: (record: GenerationRecord) => void;
}

function getTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function useLazyVisible() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
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

export const GenerationRow = memo(function GenerationRow({ record, layout, onRegenerate }: GenerationRowProps) {
  const pickVariation = usePickVariation();
  const unpickVariation = useUnpickVariation();
  const deleteGeneration = useDeleteGeneration();
  const removeBackground = useRemoveBackground();
  const colorAdjust = useColorAdjust();
  const edgeCleanup = useEdgeCleanup();
  const upscale = useUpscale();
  const denoise = useDenoise();

  const toolProcessing = colorAdjust.isPending || edgeCleanup.isPending || upscale.isPending || denoise.isPending;
  const bgProcessing = removeBackground.isPending;
  const anyProcessing = toolProcessing || bgProcessing;

  const [bgLevel, setBgLevel] = useState(record.bg_removal_level);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const { ref, visible } = useLazyVisible();

  const isGrid = layout === "grid";

  function handleClick(variationIndex: number) {
    const variation = record.variations.find((v) => v.index === variationIndex);
    if (variation?.picked) unpickVariation.mutate(record.id);
    else pickVariation.mutate({ generationId: record.id, variationIndex });
  }

  function handleBgLevelChange(value: number[]) {
    const level = value[0];
    setBgLevel(level);
    removeBackground.mutate(record.id, level);
  }

  function getLevelLabel(level: number) {
    if (level === 0) return "Off";
    if (level <= 3) return "Lite";
    if (level <= 7) return "Med";
    return "Heavy";
  }

  function getLevelColor(level: number) {
    if (level === 0) return "text-muted-foreground";
    if (level <= 3) return "text-emerald-400";
    if (level <= 7) return "text-amber-400";
    return "text-red-400";
  }

  const hasActiveTools = record.denoise_strength > 0 || record.color_brightness !== 0 || record.color_contrast !== 0 || record.color_saturation !== 0 || record.edge_feather > 0 || record.upscale_factor > 1;

  if (!visible) {
    return <div ref={ref} className={cn("rounded-xl border border-border bg-card", isGrid ? "aspect-square" : "h-[140px]")} />;
  }

  return (
    <>
      <div ref={ref} className="rounded-xl border border-border bg-card/80 backdrop-blur-md p-3 space-y-2.5 shadow-lg shadow-black/20">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{record.name}</span>
          <Badge variant="outline" className="text-[10px] py-0 h-5">{record.style}</Badge>
          <Badge variant="outline" className="text-[10px] py-0 h-5">{record.quality.toUpperCase()}</Badge>
          {record.model && <Badge variant="outline" className="text-[10px] py-0 h-5">{record.model}</Badge>}
          <span className="ml-auto text-[11px] text-muted-foreground">{getTimeAgo(record.created_at)}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setInspectOpen(true)} title="Details">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <path d="M8 7v4M8 5.5v-.01" strokeLinecap="round" />
            </svg>
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteGeneration.mutate(record.id)} disabled={deleteGeneration.isPending} title="Delete">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </Button>
        </div>

        {/* Controls: BG slider (compact) + Tools toggle */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-1.5">
          <span className="text-[10px] font-medium text-muted-foreground">BG</span>
          <Slider
            value={[bgLevel]}
            onValueChange={handleBgLevelChange}
            min={0} max={10} step={1}
            disabled={bgProcessing}
            className="w-28 shrink-0"
          />
          <span className={cn("text-[10px] font-semibold tabular-nums w-14 shrink-0", getLevelColor(bgLevel))}>
            {bgLevel === 0 ? "Off" : `${bgLevel} ${getLevelLabel(bgLevel)}`}
          </span>

          <div className="w-px h-4 bg-border mx-1 shrink-0" />

          <Button
            variant={toolsOpen ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-6 px-2 text-[10px] gap-1", toolsOpen && "bg-accent/15 text-accent")}
            onClick={() => setToolsOpen(!toolsOpen)}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14.3 2.3L9 7.6 8.4 7 13.7 1.7M14.3 2.3L13.7 1.7M5.5 7.8L2.7 10.6a1 1 0 000 1.4l1.3 1.3a1 1 0 001.4 0l2.8-2.8" />
            </svg>
            Tools
            {hasActiveTools && <span className="w-1.5 h-1.5 rounded-full bg-accent" />}
          </Button>

          {anyProcessing && <Spinner className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />}
        </div>

        {/* Expandable tool panel */}
        {toolsOpen && (
          <ToolPanel
            record={record}
            onColorAdjust={(b, c, s) => colorAdjust.mutate(record.id, b, c, s)}
            onEdgeCleanup={(f) => edgeCleanup.mutate(record.id, f)}
            onUpscale={(f) => upscale.mutate({ generationId: record.id, factor: f })}
            onDenoise={(s) => denoise.mutate(record.id, s)}
            isProcessing={toolProcessing}
          />
        )}

        {/* Image grid */}
        <div className={cn("gap-2", isGrid ? "grid grid-cols-2" : "flex")}>
          {record.variations.map((variation) => (
            <button
              key={variation.index}
              onClick={() => handleClick(variation.index)}
              disabled={pickVariation.isPending || unpickVariation.isPending}
              className={cn(
                "group relative overflow-hidden rounded-lg transition-all",
                isGrid ? "aspect-square" : "aspect-square w-[88px] shrink-0",
                variation.picked
                  ? "ring-2 ring-accent ring-offset-1 ring-offset-background shadow-md shadow-accent/10"
                  : "ring-1 ring-border hover:ring-accent/50",
              )}
            >
              <img
                src={`/api/images/${variation.preview_path}?t=${cacheBust(record)}`}
                alt={`${record.name} v${variation.index + 1}`}
                className="h-full w-full object-contain bg-surface"
                loading="lazy"
                decoding="async"
              />
              {variation.picked && (
                <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-white shadow">
                  {"\u2713"}
                </div>
              )}
              {anyProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                  <Spinner className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {record.name}
              <Badge variant="outline" className="text-[10px] py-0">{record.style}</Badge>
              <Badge variant="outline" className="text-[10px] py-0">{record.quality.toUpperCase()}</Badge>
              {record.model && <Badge variant="outline" className="text-[10px] py-0">{record.model}</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
            {[
              ["Prompt", record.prompt],
              ["Model", record.model],
              ["Style", record.style],
              ["Mood", record.mood || "none"],
              ["Quality", record.quality.toUpperCase()],
              ["Created", new Date(record.created_at).toLocaleString()],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span className="max-w-[60%] text-right text-foreground">{value}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Variations</div>
            <div className="flex gap-3">
              {record.variations.map((variation) => (
                <div key={variation.index} className="relative">
                  <img
                    src={`/api/images/${variation.preview_path}?t=${cacheBust(record)}`}
                    alt={`v${variation.index + 1}`}
                    className={cn(
                      "h-28 w-28 rounded-lg object-contain bg-surface",
                      variation.picked ? "ring-2 ring-accent" : "ring-1 ring-border",
                    )}
                  />
                  {variation.picked && (
                    <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-white">{"\u2713"}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {onRegenerate && (
              <Button variant="outline" size="sm" onClick={() => { setInspectOpen(false); onRegenerate(record); }}>
                Regenerate
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setInspectOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
