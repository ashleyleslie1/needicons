import { useState, useRef, useEffect, useCallback } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useRefineVariation } from "@/hooks/api/use-generate-v2";
import { useRecreate } from "@/hooks/api/use-recreate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

interface ImageEditorModalProps {
  record: GenerationRecord;
  variationIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVariationChange?: (index: number) => void;
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
    </svg>
  );
}

const cacheBust = (r: GenerationRecord, extra = 0) =>
  `${r.bg_removal_level}-${r.denoise_strength}-${r.color_brightness}-${r.edge_feather}-${r.upscale_factor}-${r.lasso_masks.length}-${extra}`;

export function ImageEditorModal({ record, variationIndex, open, onOpenChange, onVariationChange }: ImageEditorModalProps) {
  const variation = record.variations.find((v) => v.index === variationIndex);
  const pickVariation = usePickVariation();
  const unpickVariation = useUnpickVariation();
  const refineVariation = useRefineVariation();
  const recreate = useRecreate(record.id);

  const [refinePrompt, setRefinePrompt] = useState("");
  const [refineVersion, setRefineVersion] = useState(0);
  const [partialImage, setPartialImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const isRecreating = recreate.isPending;
  const recreatePartial = recreate.partial;
  const isProcessing = refineVariation.isPending || isRecreating;

  const goNext = useCallback(() => {
    if (!onVariationChange) return;
    const nextIdx = record.variations.findIndex((v) => v.index === variationIndex);
    if (nextIdx < record.variations.length - 1) {
      onVariationChange(record.variations[nextIdx + 1].index);
    }
  }, [onVariationChange, record.variations, variationIndex]);

  const goPrev = useCallback(() => {
    if (!onVariationChange) return;
    const prevIdx = record.variations.findIndex((v) => v.index === variationIndex);
    if (prevIdx > 0) {
      onVariationChange(record.variations[prevIdx - 1].index);
    }
  }, [onVariationChange, record.variations, variationIndex]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, goNext, goPrev]);

  if (!variation) return null;

  function handlePick() {
    if (variation!.picked) unpickVariation.mutate(record.id);
    else pickVariation.mutate({ generationId: record.id, variationIndex });
  }

  function handleRecreate() {
    if (isProcessing) return;
    // Hand off to the global pool: the request lives outside this modal's
    // lifecycle, so the user can close this dialog or navigate away while
    // the new variation finishes generating. The icon's row in the results
    // grid will show a ghost thumbnail while it's in flight.
    recreate.start();
  }

  function handleRefine() {
    if (!refinePrompt.trim() || isProcessing) return;
    setPartialImage(null);
    refineVariation.mutate({
      generationId: record.id,
      variationIndex,
      prompt: refinePrompt.trim(),
      onPartial: (b64) => setPartialImage(`data:image/png;base64,${b64}`),
    }, {
      onSuccess: () => {
        setRefinePrompt("");
        setRefineVersion((v) => v + 1);
        setPartialImage(null);
      },
      onError: () => setPartialImage(null),
    });
  }

  const quickPrompts = [
    "Remove all background, keep only the icon with transparent background",
    "Clean up edges, make the icon crisp and sharp",
    "Make the background fully transparent, remove any artifacts",
    "Simplify the icon, reduce detail for cleaner look",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden border-border/50 bg-background">
        <div className="flex" style={{ height: "650px" }}>
          {/* Left: Image preview with checkerboard */}
          <div className="flex-1 flex flex-col relative">
            {/* Processing overlay — only for Refine. Recreate keeps the
                 existing image visible and shows its progress in the sidebar. */}
            {refineVariation.isPending && !partialImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 shadow-lg border border-border/50">
                  <Spinner className="h-4 w-4 text-accent" />
                  <span className="text-sm text-foreground">Refining with AI...</span>
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
                if (zoom <= 1) return;
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
                src={partialImage || `/api/images/${variation.preview_path}?t=${cacheBust(record, refineVersion)}`}
                alt={`${record.name} v${variationIndex + 1}`}
                draggable={false}
                className="max-h-[520px] max-w-full object-contain drop-shadow-lg transition-transform duration-100 select-none"
                style={{ transform: `scale(${zoom}) translate(${panX}px, ${panY}px)` }}
              />
            </div>

            {/* Zoom indicator */}
            {zoom !== 1 && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-md bg-card/80 backdrop-blur-sm border border-border/50 px-2 py-1 shadow-sm">
                <span className="text-[10px] font-semibold text-foreground tabular-nums">{Math.round(zoom * 100)}%</span>
                <button onClick={() => { setZoom(1); setPanX(0); setPanY(0); }} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Reset</button>
              </div>
            )}

            {/* Bottom bar */}
            <div className="flex items-center gap-3 border-t border-border/50 px-4 py-3 bg-background">
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
                {record.variations.length > 1 && onVariationChange && (
                  <>
                    <button onClick={goPrev} disabled={variationIndex === 0} className="h-5 w-5 flex items-center justify-center rounded hover:bg-card/60 disabled:opacity-30 transition-colors">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 2L3 5l3 3"/></svg>
                    </button>
                    <span className="tabular-nums">{variationIndex + 1}/{record.variations.length}</span>
                    <button onClick={goNext} disabled={variationIndex === record.variations.length - 1} className="h-5 w-5 flex items-center justify-center rounded hover:bg-card/60 disabled:opacity-30 transition-colors">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 2l3 3-3 3"/></svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Refine sidebar */}
          <div className="w-[260px] shrink-0 border-l border-border/50/50 flex flex-col bg-background">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border/50/50">
              {record.model?.startsWith("sd3") ? (
                <>
                  <h3 className="text-sm font-semibold text-foreground">Details</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Generated with <span className="text-foreground font-medium">{record.model}</span> via Stability AI
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Refine
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Using <span className="text-foreground font-medium">gpt-5.4-nano</span> via OpenAI Responses API
                  </p>
                </>
              )}
            </div>

            {/* Recreate — generates a new variation in-place using the
                 record's original model/style/prompt. Available for every
                 provider, including Stability where Refine isn't. */}
            <div className="px-3 pt-3 pb-3 border-b border-border/50/50">
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-1.5"
                onClick={handleRecreate}
                disabled={isProcessing}
              >
                {isRecreating ? (
                  <><Spinner className="h-3 w-3" /> Adding variation...</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg> Recreate</>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-snug">
                {isRecreating
                  ? "You can close this dialog — the new variation will keep generating in the background."
                  : "Adds a new variation with the same settings — keeps the existing image."}
              </p>
              {isRecreating && recreatePartial && (
                <div className="mt-2 aspect-square w-full overflow-hidden rounded-md ring-1 ring-border/50 bg-muted/20">
                  <img src={recreatePartial} alt="New variation preview" className="h-full w-full object-contain p-1 animate-pulse" />
                </div>
              )}
            </div>

            {/* Refine prompt */}
            <div className="flex-1 px-3 py-3 flex flex-col gap-3 overflow-y-auto">
              {record.model?.startsWith("sd3") ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                  <p className="text-sm text-muted-foreground">AI refine is not available for Stability AI models.</p>
                  <p className="text-[10px] text-muted-foreground mt-2">Use Recreate above to add another variation, or navigate between existing ones using the arrows below.</p>
                </div>
              ) : <>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block">What should the AI change?</label>
                <textarea
                  value={refinePrompt}
                  onChange={(e) => setRefinePrompt(e.target.value)}
                  placeholder="e.g. Remove background, clean up edges..."
                  className="w-full rounded-md border border-border/50 bg-input px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent/50 transition-all"
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleRefine();
                    }
                  }}
                />
              </div>

              <Button
                size="sm"
                className="w-full gap-1.5"
                onClick={handleRefine}
                disabled={!refinePrompt.trim() || isProcessing}
              >
                {refineVariation.isPending ? (
                  <><Spinner className="h-3 w-3" /> Refining...</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Refine</>
                )}
              </Button>

              {/* Quick prompts */}
              <div>
                <span className="text-[11px] text-muted-foreground mb-1.5 block">Quick actions</span>
                <div className="space-y-1">
                  {quickPrompts.map((qp) => (
                    <button
                      key={qp}
                      onClick={() => {
                        setRefinePrompt(qp);
                      }}
                      className="w-full text-left rounded-md bg-muted/30 border border-transparent hover:border-border/50 px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors leading-snug"
                    >
                      {qp}
                    </button>
                  ))}
                </div>
              </div>

              {refineVariation.isError && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-[10px] text-destructive">
                  {refineVariation.error?.message || "Refinement failed"}
                </div>
              )}
              </>}
            </div>

            {/* Info footer */}
            <div className="shrink-0 border-t border-border/50 px-4 py-3 space-y-1.5">
              {/* Show full prompt if it differs from name (AI enhanced) */}
              {record.prompt !== record.name && (
                <div className="text-[10px]">
                  <span className="text-muted-foreground block mb-0.5">AI Prompt</span>
                  <span className="text-foreground/80 leading-relaxed block">{record.prompt}</span>
                </div>
              )}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                <span className="text-muted-foreground">{record.style}</span>
                <span className="text-muted-foreground">{record.model || "default"}</span>
                {record.mood && record.mood !== "none" && (
                  <span className="text-muted-foreground">{record.mood}</span>
                )}
                {record.ai_enhance && (
                  <span className="text-accent/70">AI Enhanced</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
