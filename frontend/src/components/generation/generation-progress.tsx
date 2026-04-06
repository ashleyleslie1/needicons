import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Requirement } from "@/lib/types";

interface GenerationProgressProps {
  requirements: Requirement[];
  completedIds: Set<string>;
  activeId: string | null;
  totalCount: number;
  onCancel: () => void;
}

export function GenerationProgress({
  requirements,
  completedIds,
  activeId,
  totalCount,
  onCancel,
}: GenerationProgressProps) {
  const completedCount = completedIds.size;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Generating {totalCount} icons</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <Progress value={progressPercent} />
        <p className="text-xs text-muted-foreground">
          {completedCount} of {totalCount} complete
        </p>
      </div>

      {/* Icon status tiles */}
      <div className="grid grid-cols-5 gap-2">
        {requirements.map((req) => {
          const isDone = completedIds.has(req.id);
          const isActive = req.id === activeId;

          return (
            <div
              key={req.id}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-md border text-xs text-center",
                isDone
                  ? "border-green-500/40 bg-green-500/10 text-green-600"
                  : isActive
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-border bg-muted/30 text-muted-foreground"
              )}
            >
              <span className="text-base leading-none">
                {isDone ? "✓" : isActive ? (
                  <span className="inline-block animate-spin">⟳</span>
                ) : "⏳"}
              </span>
              <span className="truncate w-full">{req.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
