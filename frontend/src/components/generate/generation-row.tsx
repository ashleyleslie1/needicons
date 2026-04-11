import { useState, useRef, useEffect, memo } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useDeleteGeneration } from "@/hooks/api/use-generate-v2";
import { ImageEditorModal } from "@/components/generate/image-editor-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface GenerationRowProps {
  record: GenerationRecord;
  layout: "list" | "grid";
  onRegenerate?: (record: GenerationRecord) => void;
}

function getTimeAgo(isoDate: string): string {
  const dateStr = isoDate.endsWith("Z") ? isoDate : isoDate + "Z";
  const diff = Date.now() - new Date(dateStr).getTime();
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

const cacheBust = (r: GenerationRecord) =>
  `${r.bg_removal_level}-${r.denoise_strength}-${r.color_brightness}-${r.edge_feather}-${r.upscale_factor}-${r.lasso_masks.length}-${r.refine_version ?? 0}`;

export const GenerationRow = memo(function GenerationRow({ record, layout, onRegenerate: _onRegenerate }: GenerationRowProps) {
  const pickVariation = usePickVariation();
  const unpickVariation = useUnpickVariation();
  const deleteGeneration = useDeleteGeneration();

  const [editorVariation, setEditorVariation] = useState<number | null>(null);
  const { ref, visible } = useLazyVisible();

  const isGrid = layout === "grid";

  function handlePick(e: React.MouseEvent | undefined, variationIndex: number) {
    e?.stopPropagation();
    const variation = record.variations.find((v) => v.index === variationIndex);
    if (variation?.picked) unpickVariation.mutate(record.id);
    else pickVariation.mutate({ generationId: record.id, variationIndex });
  }

  if (!visible) {
    return <div ref={ref} className={cn("rounded-xl border border-border/50 bg-card/40", isGrid ? "aspect-square" : "h-[120px]")} />;
  }

  return (
    <>
      <div ref={ref} className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-md p-3 space-y-2 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{record.name}</span>
          <Badge variant="outline" className="text-[10px] py-0 h-5">{record.style}</Badge>
          {record.model && <Badge variant="outline" className="text-[10px] py-0 h-5">{record.model}</Badge>}
          {record.ai_enhance && <Badge variant="outline" className="text-[10px] py-0 h-5 text-accent border-accent/30">AI</Badge>}
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">{getTimeAgo(record.created_at)}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteGeneration.mutate(record.id)} disabled={deleteGeneration.isPending} title="Delete">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </Button>
        </div>

        {/* Enhanced prompt (shown when AI enhance produced a different prompt) */}
        {record.ai_enhance && record.prompt !== record.name && (
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 break-words" title={record.prompt}>
            <span className="text-accent/70 mr-1">AI:</span>{record.prompt}
          </p>
        )}

        {/* Image grid — click picks, hover button opens refine */}
        <div className={cn("gap-2", isGrid ? "grid grid-cols-2" : "flex flex-wrap")}>
          {record.variations.map((variation) => (
            <button
              key={variation.index}
              onClick={() => handlePick(undefined, variation.index)}
              className={cn(
                "group relative overflow-hidden rounded-lg transition-all cursor-pointer",
                isGrid ? "aspect-square" : "aspect-square w-[100px] shrink-0",
                variation.picked
                  ? "ring-2 ring-accent ring-offset-1 ring-offset-background shadow-md shadow-accent/10"
                  : "ring-1 ring-border hover:ring-accent/50",
              )}
            >
              <img
                src={`/api/images/${variation.preview_path}?t=${cacheBust(record)}`}
                alt={`${record.name} v${variation.index + 1}`}
                className="h-full w-full object-contain p-1 transition-colors group-hover:bg-muted/30"
                loading="lazy"
                decoding="async"
              />
              {variation.picked && (
                <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] text-white shadow">
                  {"\u2713"}
                </div>
              )}
              {/* Refine button on hover */}
              <div
                className="absolute left-1 bottom-1 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setEditorVariation(variation.index); }}
              >
                <div className="flex items-center gap-0.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground shadow transition-colors hover:bg-accent hover:text-white">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Refine
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Image editor modal */}
      {editorVariation !== null && (
        <ImageEditorModal
          record={record}
          variationIndex={editorVariation}
          open={true}
          onOpenChange={(open) => { if (!open) setEditorVariation(null); }}
          onVariationChange={setEditorVariation}
        />
      )}
    </>
  );
});
