import { useState, useRef, useEffect, memo } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useDeleteGeneration } from "@/hooks/api/use-generate-v2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

/** Only render when visible in viewport */
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

export const GenerationRow = memo(function GenerationRow({ record, layout, onRegenerate }: GenerationRowProps) {
  const pickVariation = usePickVariation();
  const unpickVariation = useUnpickVariation();
  const deleteGeneration = useDeleteGeneration();
  const timeAgo = getTimeAgo(record.created_at);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const { ref, visible } = useLazyVisible();

  function handleClick(variationIndex: number) {
    const variation = record.variations.find((v) => v.index === variationIndex);
    if (variation?.picked) {
      unpickVariation.mutate(record.id);
    } else {
      pickVariation.mutate({ generationId: record.id, variationIndex });
    }
  }

  function handleDelete() {
    deleteGeneration.mutate(record.id);
  }

  const busy = pickVariation.isPending || unpickVariation.isPending || deleteGeneration.isPending;
  const hasOriginals = record.original_count > 0;
  const isGrid = layout === "grid";

  // Placeholder before visible
  if (!visible) {
    return <div ref={ref} className={cn("rounded-xl border border-border bg-card", isGrid ? "aspect-square" : "h-[140px]")} />;
  }

  return (
    <>
      <div
        ref={ref}
        className="group/row relative rounded-xl border border-border bg-card p-4"
        onMouseEnter={() => hasOriginals && setShowDebug(true)}
        onMouseLeave={() => setShowDebug(false)}
      >
        <div className={cn("flex items-center gap-2", isGrid ? "mb-2" : "mb-3")}>
          <button
            onClick={() => setInspectOpen(true)}
            className="text-sm font-semibold text-foreground hover:text-accent transition-colors truncate"
          >
            {record.name}
          </button>
          {!isGrid && (
            <>
              <Badge variant="secondary" className="text-[10px]">{record.style}</Badge>
              <Badge variant="secondary" className="text-[10px]">{record.quality.toUpperCase()}</Badge>
              {record.model && <Badge variant="secondary" className="text-[10px]">{record.model}</Badge>}
            </>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{timeAgo}</span>
          <button
            onClick={handleDelete}
            disabled={deleteGeneration.isPending}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete generation"
          >
            {"\u00D7"}
          </button>
        </div>

        <div className={cn(
          "gap-2",
          isGrid ? "grid grid-cols-2" : "flex gap-3",
        )}>
          {record.variations.map((variation) => (
            <button
              key={variation.index}
              onClick={() => handleClick(variation.index)}
              disabled={busy}
              className={cn(
                "group relative overflow-hidden rounded-lg border-2 transition-all",
                isGrid ? "aspect-square" : "aspect-square w-24",
                variation.picked
                  ? "border-accent ring-2 ring-accent/30 scale-[1.02] shadow-md shadow-accent/10"
                  : "border-transparent hover:border-accent/40 hover:scale-[1.01]",
              )}
            >
              <img
                src={`/api/images/${variation.preview_path}`}
                alt={`${record.name} v${variation.index + 1}`}
                className="h-full w-full object-contain bg-muted/30"
                loading="lazy"
                decoding="async"
              />
              {variation.picked && (
                <div className="absolute inset-0 bg-accent/5" />
              )}
              {variation.picked && (
                <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white shadow-sm">
                  {"\u2713"}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Debug tooltip */}
        {showDebug && hasOriginals && (
          <div className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-border bg-card p-3 shadow-xl">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Original API response
            </div>
            <div className="flex gap-2">
              {Array.from({ length: record.original_count }, (_, i) => (
                <div key={i} className="relative">
                  <img
                    src={`/api/images/images/${record.id}/original/r${i}.png`}
                    alt={`Original ${i}`}
                    className="h-48 w-48 rounded-lg border border-border object-contain bg-muted/30"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      const label = img.nextElementSibling;
                      if (label) label.textContent = `${img.naturalWidth}\u00D7${img.naturalHeight}`;
                    }}
                  />
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={inspectOpen} onOpenChange={setInspectOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {record.name}
              <Badge variant="secondary" className="text-[10px]">{record.style}</Badge>
              <Badge variant="secondary" className="text-[10px]">{record.quality.toUpperCase()}</Badge>
              {record.model && <Badge variant="secondary" className="text-[10px]">{record.model}</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prompt</span>
              <span className="max-w-[60%] text-right text-foreground">{record.prompt}</span>
            </div>
            {record.model && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="text-foreground">{record.model}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Style</span>
              <span className="text-foreground">{record.style}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quality</span>
              <span className="text-foreground">{record.quality.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span className="text-foreground">{new Date(record.created_at).toLocaleString()}</span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Variations
            </div>
            <div className="flex gap-3">
              {record.variations.map((variation) => (
                <div key={variation.index} className="relative">
                  <img
                    src={`/api/images/${variation.preview_path}`}
                    alt={`v${variation.index + 1}`}
                    className={cn(
                      "h-32 w-32 rounded-lg border-2 object-contain bg-muted/30",
                      variation.picked ? "border-accent" : "border-border",
                    )}
                  />
                  {variation.picked && (
                    <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                      {"\u2713"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {onRegenerate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setInspectOpen(false); onRegenerate(record); }}
              >
                Regenerate
              </Button>
            )}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setInspectOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
