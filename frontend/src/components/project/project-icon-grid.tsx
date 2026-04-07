import { useState } from "react";
import type { SavedIcon } from "@/lib/types";
import { ProjectIconTile } from "./project-icon-tile";


interface ProjectIconGridProps {
  icons: SavedIcon[];
  projectId: string;
  previewVersion: number;
  onRemoveIcon: (iconId: string) => void;
}

export function ProjectIconGrid({ icons, projectId, previewVersion, onRemoveIcon }: ProjectIconGridProps) {
  const [previewIconId, setPreviewIconId] = useState<string | null>(null);

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

  // Default preview icon: first icon or user-selected
  const activePreviewId = previewIconId ?? icons[0]?.id;

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
      {icons.map((icon) => {
        const isPreview = icon.id === activePreviewId;
        return (
          <ProjectIconTile
            key={icon.id}
            icon={icon}
            projectId={projectId}
            previewVersion={previewVersion}
            isPreview={isPreview}
            onRemove={() => onRemoveIcon(icon.id)}
            onSetPreview={() => setPreviewIconId(icon.id)}
          />
        );
      })}
    </div>
  );
}
