import { useState, useRef, useEffect } from "react";
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
  onDeleteDuplicates?: () => void;
  onDeleteGroupDuplicates?: (name: string, mode: "keep_picked" | "keep_newest_only") => void;
  isDeleting?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  totalCount?: number;
}

const MIN_CARD_WIDTH = 480;

export function ResultsHistory({ records, pendingCard, onRegenerate, showUnpickedOnly, onToggleUnpicked, showDuplicatesOnly, onToggleDuplicates, onDeleteDuplicates, onDeleteGroupDuplicates, isDeleting, searchQuery, onSearchChange, totalCount }: ResultsHistoryProps) {
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isGrid = layout === "grid";

  // Responsive grid columns
  const [gridCols, setGridCols] = useState(2);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isGrid) return;
    const update = () => {
      const w = el.clientWidth - 16;
      setGridCols(Math.max(1, Math.floor(w / MIN_CARD_WIDTH)));
    };
    update();
    const obs = new ResizeObserver(update);
    obs.observe(el);
    return () => obs.disconnect();
  }, [isGrid]);

  if (records.length === 0 && !pendingCard && !showUnpickedOnly && !showDuplicatesOnly && !searchQuery) return null;

  // Build grouped structure for duplicate view
  const groups: Array<{ name: string; count: number; records: GenerationRecord[] }> = [];
  if (showDuplicatesOnly) {
    let i = 0;
    while (i < records.length) {
      const name = records[i].name.toLowerCase();
      const start = i;
      while (i < records.length && records[i].name.toLowerCase() === name) i++;
      groups.push({ name: records[start].name, count: i - start, records: records.slice(start, i) });
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="mb-4 flex items-center gap-2 shrink-0">
        <span className="text-[11px] text-muted-foreground shrink-0">
          {records.length} of {totalCount ?? records.length}
        </span>

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
            {showDuplicatesOnly ? "Duplicates" : "Show duplicates"}
          </button>
        )}

        {showDuplicatesOnly && onDeleteDuplicates && records.length > 0 && (
          <button
            onClick={onDeleteDuplicates}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            {isDeleting ? "Deleting..." : "Delete all duplicates"}
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

      {/* Scrollable content */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {records.length === 0 && (showUnpickedOnly || showDuplicatesOnly) ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            {showUnpickedOnly ? "All icons have been picked" : "No duplicate names found"}
          </div>
        ) : showDuplicatesOnly ? (
          /* Grouped duplicate view */
          <div className="space-y-2">
            {pendingCard}
            {groups.map((group) => (
              <div key={group.name}>
                <div className="flex items-center gap-2 py-1 mb-2">
                  <span className="text-sm font-bold text-accent">{group.name}</span>
                  <span className="text-xs text-muted-foreground font-medium">({group.count}x)</span>
                  {onDeleteGroupDuplicates && group.count > 1 && (
                    <button
                      onClick={() => onDeleteGroupDuplicates(group.name, "keep_picked")}
                      disabled={isDeleting}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-destructive bg-destructive/5 border border-destructive/20 hover:bg-destructive/15 hover:border-destructive/40 transition-all disabled:opacity-50"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                      Delete duplicates
                    </button>
                  )}
                  {onDeleteGroupDuplicates && group.count > 1 && (
                    <button
                      onClick={() => onDeleteGroupDuplicates(group.name, "keep_newest_only")}
                      disabled={isDeleting}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground border border-border/50 hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all disabled:opacity-50"
                    >
                      Delete all
                    </button>
                  )}
                  <div className="flex-1 h-px bg-border/30" />
                </div>
                {isGrid ? (
                  <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
                    {group.records.map((record) => (
                      <GenerationRow key={record.id} record={record} layout="grid" onRegenerate={onRegenerate} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 mb-4">
                    {group.records.map((record) => (
                      <GenerationRow key={record.id} record={record} layout="list" onRegenerate={onRegenerate} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Normal list/grid view */
          <div className={cn(
            isGrid
              ? "grid gap-4"
              : "flex flex-col gap-4",
            isGrid && { style: { gridTemplateColumns: `repeat(${gridCols}, 1fr)` } },
          )} style={isGrid ? { gridTemplateColumns: `repeat(${gridCols}, 1fr)` } : undefined}>
            {pendingCard}
            {records.map((record) => (
              <GenerationRow key={record.id} record={record} layout={layout} onRegenerate={onRegenerate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
