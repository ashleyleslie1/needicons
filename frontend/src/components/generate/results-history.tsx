import { useState } from "react";
import type { GenerationRecord } from "@/lib/types";
import { GenerationRow } from "./generation-row";
import { cn } from "@/lib/utils";
import { List, LayoutGrid } from "lucide-react";

interface ResultsHistoryProps {
  records: GenerationRecord[];
  pendingCard?: React.ReactNode;
  onRegenerate?: (record: GenerationRecord) => void;
}

export function ResultsHistory({ records, pendingCard, onRegenerate }: ResultsHistoryProps) {
  const [layout, setLayout] = useState<"list" | "grid">("list");

  if (records.length === 0 && !pendingCard) return null;

  return (
    <div>
      {/* View toggle */}
      <div className="mb-4 flex items-center justify-end gap-1">
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

      <div className={cn(
        layout === "list"
          ? "flex flex-col gap-4"
          : "grid grid-cols-3 gap-4",
      )}>
        {/* Pending generation card — first in the list */}
        {pendingCard}

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
