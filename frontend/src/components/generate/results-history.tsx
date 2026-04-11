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
  duplicateNameCount?: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  totalCount?: number;
}

export function ResultsHistory({ records, pendingCard, onRegenerate, showUnpickedOnly, onToggleUnpicked, showDuplicatesOnly, onToggleDuplicates, duplicateNameCount, searchQuery, onSearchChange, totalCount }: ResultsHistoryProps) {
  const [layout, setLayout] = useState<"list" | "grid">("list");

  if (records.length === 0 && !pendingCard && !showUnpickedOnly && !showDuplicatesOnly && !searchQuery) return null;

  return (
    <div>
      {/* View toggle + filter */}
      <div className="mb-4 flex items-center gap-2">
        {/* Result count */}
        <span className="text-[11px] text-muted-foreground shrink-0">
          {records.length} of {totalCount ?? records.length}
        </span>

        {/* Search */}
        {onSearchChange && (
          <div className="relative">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="h-7 w-40 rounded-lg border border-border/50 bg-input pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20 transition-all"
            />
          </div>
        )}

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
            {showDuplicatesOnly
              ? `Duplicates — ${duplicateNameCount ?? 0} names, ${records.length} entries`
              : "Show duplicates"}
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
          records.map((record, i) => {
            // Show name group header when duplicates filter is active and name changes
            const prevName = i > 0 ? records[i - 1].name.toLowerCase() : null;
            const showGroupHeader = showDuplicatesOnly && record.name.toLowerCase() !== prevName;
            const groupCount = showDuplicatesOnly
              ? records.filter((r) => r.name.toLowerCase() === record.name.toLowerCase()).length
              : 0;

            return (
              <div key={record.id}>
                {showGroupHeader && (
                  <div className="flex items-center gap-2 mb-1 mt-3 first:mt-0">
                    <span className="text-[11px] font-semibold text-accent">{record.name}</span>
                    <span className="text-[10px] text-muted-foreground">({groupCount}x)</span>
                    <div className="flex-1 h-px bg-border/30" />
                  </div>
                )}
                <GenerationRow
                  record={record}
                  layout={layout}
                  onRegenerate={onRegenerate}
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
