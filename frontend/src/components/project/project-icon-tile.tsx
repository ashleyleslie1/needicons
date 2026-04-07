import type { SavedIcon } from "@/lib/types";

interface ProjectIconTileProps {
  icon: SavedIcon;
  onRemove: () => void;
}

export function ProjectIconTile({ icon, onRemove }: ProjectIconTileProps) {
  return (
    <div className="group relative text-center">
      <div className="aspect-square overflow-hidden rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-muted-foreground/40">
        <img
          src={`/api/images/${icon.preview_path}`}
          alt={icon.name}
          className="h-full w-full object-contain"
          loading="lazy"
        />
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-card/80 text-xs text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
          title="Remove from project"
        >
          {"\u00D7"}
        </button>
      </div>
      <div className="mt-1.5 truncate text-xs text-muted-foreground">{icon.name}</div>
    </div>
  );
}
