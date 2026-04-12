import type { SavedIcon } from "@/lib/types";
import { ProjectIconTile } from "./project-icon-tile";

interface ProjectIconGridProps {
  icons: SavedIcon[];
  projectId: string;
  previewVersion: number;
  onRemoveIcon: (iconId: string) => void;
  onCropSave?: (iconId: string, crop: { crop_x: number; crop_y: number; crop_zoom: number }) => void;
}

export function ProjectIconGrid({ icons, projectId, previewVersion, onRemoveIcon, onCropSave }: ProjectIconGridProps) {

  if (icons.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-accent/10 backdrop-blur-sm">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent">
            <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="8" x2="12" y2="16" strokeLinecap="round"/><line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round"/>
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">Start building your pack</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
          Switch to the Generate tab to create icons. Pick your favorites and they'll appear here ready for export.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
      {icons.map((icon) => (
        <ProjectIconTile
          key={icon.id}
          icon={icon}
          projectId={projectId}
          previewVersion={previewVersion}
          isPreview={false}
          onRemove={() => onRemoveIcon(icon.id)}
          onSetPreview={() => {}}
          onCropSave={(crop) => onCropSave?.(icon.id, crop)}
        />
      ))}
    </div>
  );
}
