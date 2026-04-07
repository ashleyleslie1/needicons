import type { SavedIcon } from "@/lib/types";
import { ProjectIconTile } from "./project-icon-tile";

interface ProjectIconGridProps {
  icons: SavedIcon[];
  onRemoveIcon: (iconId: string) => void;
}

export function ProjectIconGrid({ icons, onRemoveIcon }: ProjectIconGridProps) {
  if (icons.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-2xl">
          {"\uD83D\uDCE6"}
        </div>
        <h3 className="text-lg font-semibold text-foreground">No icons yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Switch to the Generate tab to create icons. Pick your favorites and they'll appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
      {icons.map((icon) => (
        <ProjectIconTile
          key={icon.id}
          icon={icon}
          onRemove={() => onRemoveIcon(icon.id)}
        />
      ))}
    </div>
  );
}
