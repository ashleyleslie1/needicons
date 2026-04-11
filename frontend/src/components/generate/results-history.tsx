import { useState } from "react";
import type { GenerationRecord } from "@/lib/types";
import { GenerationRow } from "./generation-row";
import { cn } from "@/lib/utils";
import { List, LayoutGrid } from "lucide-react";

interface ResultsHistoryProps {
  records: GenerationRecord[];
  pendingCard?: React.ReactNode;
  onRegenerate?: (record: GenerationRecord) => void;
  showUnpickedOnly?: boolean;
  onToggleUnpicked?: () => void;
  showDuplicatesOnly?: boolean;
  onToggleDuplicates?: () => void;
  totalCount?: number;
}

export function ResultsHistory({ records, pendingCard, onRegenerate, showUnpickedOnly, onToggleUnpicked, showDuplicatesOnly, onToggleDuplicates, totalCount }: ResultsHistoryProps) {
  const [layout, setLayout] = useState<"list" | "grid">("list");

  if (records.length === 0 && !pendingCard && !showUnpickedOnly && !showDuplicatesOnly) return null;

  return (
    <div>
      {/* View toggle + filter */}
      <div className="mb-4 flex items-center gap-2">
        {/* Unpicked filter */}
        {onToggleUnpicked && (
          <button
            onClick={onToggleUnpicked}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all",
              showUnpickedOnly
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60",
            )}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              {!showUnpickedOnly && <path d="M8 12l3 3 5-5" />}
            </svg>
            {showUnpickedOnly ? `Unpicked (${records.length})` : "Show unpicked"}
          </button>
        )}

        {/* Duplicates filter */}
        {onToggleDuplicates && (
          <button
            onClick={onToggleDuplicates}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all",
              showDuplicatesOnly
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60",
            )}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
            </svg>
            {showDuplicatesOnly ? `Duplicates (${records.length})` : "Show duplicates"}
          </button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setLayout("list")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              layout === "list" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground",
            )}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setLayout("grid")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              layout === "grid" ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground",
            )}
            title="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Active filter indicator */}
      {(showUnpickedOnly || showDuplicatesOnly) && records.length > 0 && (
        <p className="text-[11px] text-muted-foreground mb-2">
          Showing {records.length} of {totalCount ?? records.length} results
        </p>
      )}

      <div className={cn(
        layout === "list"
          ? "flex flex-col gap-4"
          : "grid grid-cols-3 gap-4",
      )}>
        {pendingCard}

        {records.length === 0 && (showUnpickedOnly || showDuplicatesOnly) ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {showUnpickedOnly ? "All icons have been picked" : "No duplicate names found"}
          </div>
        ) : (
          records.map((record) => (
            <GenerationRow
              key={record.id}
              record={record}
              layout={layout}
              onRegenerate={onRegenerate}
            />
          ))
        )}
      </div>
    </div>
  );
}
