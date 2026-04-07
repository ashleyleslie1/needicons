import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation, useUnpickVariation, useDeleteGeneration } from "@/hooks/api/use-generate-v2";
import { Badge } from "@/components/ui/badge";

interface GenerationRowProps {
  record: GenerationRecord;
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

export function GenerationRow({ record }: GenerationRowProps) {
  const pickVariation = usePickVariation();
  const unpickVariation = useUnpickVariation();
  const deleteGeneration = useDeleteGeneration();
  const timeAgo = getTimeAgo(record.created_at);
  const hasPicked = record.variations.some((v) => v.picked);

  function handleClick(variationIndex: number) {
    const variation = record.variations.find((v) => v.index === variationIndex);
    if (variation?.picked) {
      // Clicking a picked variation deselects it
      unpickVariation.mutate(record.id);
    } else {
      pickVariation.mutate({ generationId: record.id, variationIndex });
    }
  }

  function handleDelete() {
    deleteGeneration.mutate(record.id);
  }

  const busy = pickVariation.isPending || unpickVariation.isPending || deleteGeneration.isPending;

  return (
    <div className="group/row rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{record.name}</span>
        <Badge variant="secondary" className="text-[10px]">{record.style}</Badge>
        <Badge variant="secondary" className="text-[10px]">{record.quality.toUpperCase()}</Badge>
        {hasPicked && (
          <button
            onClick={() => unpickVariation.mutate(record.id)}
            disabled={busy}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Deselect"
          >
            Deselect
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo}</span>
        <button
          onClick={handleDelete}
          disabled={busy}
          className="text-xs text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/row:opacity-100"
          title="Delete generation"
        >
          {"\u00D7"}
        </button>
      </div>
      <div className="flex gap-3">
        {record.variations.map((variation) => (
          <button
            key={variation.index}
            onClick={() => handleClick(variation.index)}
            disabled={busy}
            className={cn(
              "group relative aspect-square w-24 overflow-hidden rounded-lg border-2 transition-all",
              variation.picked
                ? "border-accent ring-2 ring-accent/30"
                : "border-transparent hover:border-accent/40",
            )}
          >
            <img
              src={`/api/images/${variation.preview_path}`}
              alt={`${record.name} v${variation.index + 1}`}
              className="h-full w-full object-contain bg-muted/30"
              loading="lazy"
            />
            {variation.picked && (
              <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                {"\u2713"}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
