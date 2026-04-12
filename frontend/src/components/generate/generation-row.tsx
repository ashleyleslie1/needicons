import { useState, useRef, useEffect, memo } from "react";
import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useDeleteGeneration } from "@/hooks/api/use-generate-v2";
import { ImageEditorModal } from "@/components/generate/image-editor-modal";

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
    return <div ref={ref} className={cn("rounded-xl border border-border/50 bg-card/40", isGrid ? "aspect-square" : "h-[140px]")} />;
  }

  return (
    <>
      <div ref={ref} className="rounded-xl border border-border bg-card p-4 space-y-3 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground truncate">{record.name}</span>
          <span className="pill pill-inactive !py-0.5 !px-2 !text-[10px]">{record.style}</span>
          {record.model && <span className="pill pill-inactive !py-0.5 !px-2 !text-[10px]">{record.model}</span>}
          {record.ai_enhance && <span className="pill !py-0.5 !px-2 !text-[10px] bg-accent/10 text-accent">AI</span>}
          <span className="ml-auto text-[11px] text-muted-foreground shrink-0">{getTimeAgo(record.created_at)}</span>
          <button
            className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
            onClick={() => deleteGeneration.mutate(record.id)}
            disabled={deleteGeneration.isPending}
            title="Delete"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>

        {/* AI prompt */}
        {record.ai_enhance && record.prompt !== record.name && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 break-words" title={record.prompt}>
            <span className="text-accent font-medium mr-1">AI:</span>{record.prompt}
          </p>
        )}

        {/* Variations */}
        <div className={cn("gap-2", isGrid ? "grid grid-cols-2" : "flex flex-wrap")}>
          {record.variations.map((variation) => (
            <button
              key={variation.index}
              onClick={() => handlePick(undefined, variation.index)}
              className={cn(
                "group relative overflow-hidden rounded-xl transition-all cursor-pointer checkerboard",
                isGrid ? "aspect-square" : "aspect-square w-[110px] shrink-0",
                variation.picked
                  ? "ring-2 ring-accent ring-offset-2 ring-offset-background shadow-lg shadow-accent/10"
                  : "ring-1 ring-border hover:ring-accent/40 hover:shadow-md",
              )}
            >
              <img
                src={`/api/images/${variation.preview_path}?t=${cacheBust(record)}`}
                alt={`${record.name} v${variation.index + 1}`}
                className="h-full w-full object-contain p-1.5"
                loading="lazy"
                decoding="async"
                width={110}
                height={110}
              />
              {variation.picked && (
                <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white shadow-md">
                  {"\u2713"}
                </div>
              )}
              {/* View/refine button */}
              <div
                className="absolute left-1.5 bottom-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); setEditorVariation(variation.index); }}
              >
                <div className="flex items-center gap-1 rounded-lg bg-card border border-border px-2 py-1 text-[10px] font-medium text-foreground shadow-lg transition-all hover:bg-accent hover:text-white hover:border-accent">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  View
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
