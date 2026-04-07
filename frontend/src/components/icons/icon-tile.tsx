import { cn } from "@/lib/utils";
import type { Requirement } from "@/lib/types";

interface IconTileProps {
  requirement: Requirement;
  selected: boolean;
  onSelect: (id: string) => void;
  onClick: (id: string) => void;
}

export function IconTile({ requirement, selected, onSelect, onClick }: IconTileProps) {
  const acceptedCandidate = requirement.candidates.find((c) => c.selected);
  const firstCandidate = requirement.candidates[0];
  const hasCandidate = requirement.candidates.length > 0;
  const isAccepted = requirement.status === "accepted" && !!acceptedCandidate;
  const needsPick = hasCandidate && !isAccepted;

  const displayCandidate = acceptedCandidate ?? firstCandidate;

  return (
    <div
      className={cn(
        "relative aspect-square rounded-lg cursor-pointer overflow-hidden flex flex-col items-center justify-center bg-card transition-all",
        selected
          ? "border-2 border-accent ring-2 ring-accent/30"
          : hasCandidate
          ? "border border-border hover:border-accent/40"
          : "border border-dashed border-border/60 hover:border-muted-foreground/40",
      )}
      onClick={() => onClick(requirement.id)}
    >
      {/* Checkbox button top-left */}
      <button
        className={cn(
          "absolute top-2 left-2 z-10 w-6 h-6 rounded flex items-center justify-center transition-colors",
          selected
            ? "bg-accent text-accent-foreground"
            : "bg-background/80 hover:bg-muted border border-border"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(requirement.id);
        }}
        aria-label={selected ? "Deselect" : "Select"}
      >
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Accepted badge top-right */}
      {isAccepted && (
        <div className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-success text-white flex items-center justify-center text-xs font-bold">
          ✓
        </div>
      )}

      {/* Center content */}
      <div className="flex-1 flex items-center justify-center w-full px-2">
        {displayCandidate && (
          <img
            src={displayCandidate.preview_path || displayCandidate.source_path}
            alt={requirement.name}
            className="w-full h-full object-contain"
          />
        )}
      </div>

      {/* Bottom name label */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 text-center bg-gradient-to-t from-background/60 to-transparent pt-4">
        <span className="text-xs text-muted-foreground truncate block font-medium">
          {requirement.name}
        </span>
      </div>

      {/* "Pick one" badge for generated but not accepted */}
      {needsPick && (
        <div className="absolute bottom-7 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[10px] font-semibold bg-amber-500/90 text-white px-2 py-0.5 rounded-md">
            pick one
          </span>
        </div>
      )}
    </div>
  );
}
