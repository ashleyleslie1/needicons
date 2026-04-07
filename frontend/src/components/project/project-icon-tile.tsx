import type { SavedIcon } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProjectIconTileProps {
  icon: SavedIcon;
  projectId: string;
  previewVersion: number;
  isPreview: boolean;
  onRemove: () => void;
  onSetPreview: () => void;
}

export function ProjectIconTile({
  icon, projectId, previewVersion, isPreview, onRemove, onSetPreview,
}: ProjectIconTileProps) {
  // All icons show processed state via the preview endpoint.
  // Falls back to static generation preview if no settings have been applied yet.
  const src = previewVersion > 0
    ? `/api/projects/${projectId}/icons/${icon.id}/preview?v=${previewVersion}`
    : `/api/images/${icon.preview_path}`;

  return (
    <div className="group relative text-center">
      <div
        onClick={onSetPreview}
        className={cn(
          "aspect-square cursor-pointer overflow-hidden rounded-xl border p-3 transition-all",
          isPreview
            ? "border-accent ring-2 ring-accent/20 bg-muted/30"
            : "border-border bg-muted/30 hover:border-muted-foreground/40",
        )}
      >
        <img
          src={src}
          alt={icon.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
          title="Remove from project"
        >
          {"\u00D7"}
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-1">
        <span className="truncate text-xs text-muted-foreground">{icon.name}</span>
        {isPreview && (
          <span className="shrink-0 text-[9px] text-accent">PREVIEW</span>
        )}
      </div>
    </div>
  );
}
