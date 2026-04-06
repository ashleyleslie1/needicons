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
        "relative aspect-square rounded-lg cursor-pointer overflow-hidden flex flex-col items-center justify-center bg-muted/30",
        selected
          ? "border-2 border-accent ring-2 ring-accent/30"
          : hasCandidate
          ? "border border-border"
          : "border border-dashed border-border/60",
      )}
      onClick={() => onClick(requirement.id)}
    >
      {/* Checkbox button top-left */}
      <button
        className={cn(
          "absolute top-1 left-1 z-10 w-5 h-5 rounded flex items-center justify-center transition-colors",
          selected
            ? "bg-accent text-accent-foreground"
            : "bg-background/70 hover:bg-muted border border-border"
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
        <div className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold">
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
      <div className="absolute bottom-0 left-0 right-0 px-1 pb-0.5 text-center">
        <span className="text-[10px] text-muted-foreground truncate block leading-tight">
          {requirement.name}
        </span>
      </div>

      {/* "Pick one" badge for generated but not accepted */}
      {needsPick && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[9px] font-semibold bg-amber-500/90 text-white px-1 py-0.5 rounded">
            pick one
          </span>
        </div>
      )}
    </div>
  );
}
