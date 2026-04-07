import type { GenerationRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePickVariation } from "@/hooks/api/use-generate-v2";
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
  const timeAgo = getTimeAgo(record.created_at);

  function handlePick(variationIndex: number) {
    pickVariation.mutate({ generationId: record.id, variationIndex });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{record.name}</span>
        <Badge variant="secondary" className="text-[10px]">{record.style}</Badge>
        <Badge variant="secondary" className="text-[10px]">{record.quality.toUpperCase()}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">{timeAgo}</span>
      </div>
      <div className="flex gap-3">
        {record.variations.map((variation) => (
          <button
            key={variation.index}
            onClick={() => handlePick(variation.index)}
            disabled={pickVariation.isPending}
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
