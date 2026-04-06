import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePickCandidate } from "@/hooks/api/use-candidates";
import { useGenerate } from "@/hooks/api/use-generate";
import { cn } from "@/lib/utils";
import type { Requirement } from "@/lib/types";

interface CandidateRowProps {
  requirement: Requirement;
}

export function CandidateRow({ requirement }: CandidateRowProps) {
  const pickCandidate = usePickCandidate();
  const generate = useGenerate();

  const { candidates } = requirement;
  const selectedCandidate = candidates.find((c) => c.selected);
  const hasSelected = !!selectedCandidate;
  const isAutoAccepted = candidates.length === 1 && hasSelected;

  const statusVariant = hasSelected ? "success" : "default";
  const statusLabel = hasSelected ? "accepted" : "pick one";

  function handleRegenerate() {
    generate.mutate({ requirementId: requirement.id, mode: "precision" });
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm">{requirement.name}</span>
        <Badge
          variant={statusVariant}
          className={cn(
            !hasSelected && "bg-amber-500/20 text-amber-600 border-amber-500/30"
          )}
        >
          {statusLabel}
        </Badge>
        {candidates.length > 0 && (
          <span className="text-xs text-muted-foreground ml-auto">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Candidates */}
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">No candidates yet</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              onClick={() => pickCandidate.mutate(candidate.id)}
              className={cn(
                "relative w-14 h-14 rounded-md border-2 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                candidate.selected
                  ? "border-accent"
                  : "border-border hover:border-accent/50"
              )}
              aria-label={`Select candidate ${candidate.id}`}
            >
              {candidate.preview_path ? (
                <img
                  src={candidate.preview_path}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-muted" />
              )}
              {candidate.selected && (
                <span className="absolute top-0.5 right-0.5 text-accent text-xs leading-none font-bold">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Auto-accepted notice */}
      {isAutoAccepted && (
        <p className="text-xs text-muted-foreground">
          Auto-accepted.{" "}
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs text-accent underline"
            onClick={handleRegenerate}
            disabled={generate.isPending}
          >
            Regenerate?
          </Button>
        </p>
      )}
    </div>
  );
}
