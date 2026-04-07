import { useState } from "react";
import type { GenerationRecord } from "@/lib/types";
import { GenerationRow } from "./generation-row";
import { cn } from "@/lib/utils";

interface ResultsHistoryProps {
  records: GenerationRecord[];
  onRegenerate?: (record: GenerationRecord) => void;
}

export function ResultsHistory({ records, onRegenerate }: ResultsHistoryProps) {
  const [layout, setLayout] = useState<"list" | "grid">("list");

  if (records.length === 0) return null;

  return (
    <div>
      {/* View toggle */}
      <div className="mb-4 flex items-center justify-end gap-1">
        <button
          onClick={() => setLayout("list")}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            layout === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          title="List view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor" />
            <rect x="1" y="7" width="14" height="3" rx="1" fill="currentColor" opacity="0.6" />
            <rect x="1" y="12" width="14" height="3" rx="1" fill="currentColor" opacity="0.3" />
          </svg>
        </button>
        <button
          onClick={() => setLayout("grid")}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            layout === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          title="Grid view"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1" fill="currentColor" />
            <rect x="9" y="1" width="6" height="6" rx="1" fill="currentColor" opacity="0.6" />
            <rect x="1" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.6" />
            <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.3" />
          </svg>
        </button>
      </div>

      <div className={cn(
        layout === "list"
          ? "flex flex-col gap-4"
          : "grid grid-cols-3 gap-4",
      )}>
        {records.map((record) => (
          <GenerationRow
            key={record.id}
            record={record}
            layout={layout}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>
    </div>
  );
}
