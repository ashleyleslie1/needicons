import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidateRow } from "./candidate-row";
import type { Pack, Requirement } from "@/lib/types";

type FilterTab = "all" | "needs-pick" | "accepted";

interface CandidateReviewProps {
  pack: Pack;
}

function filterRequirements(requirements: Requirement[], tab: FilterTab): Requirement[] {
  switch (tab) {
    case "all":
      return requirements.filter((r) => r.candidates.length > 0);
    case "needs-pick":
      return requirements.filter(
        (r) => r.candidates.length > 0 && !r.candidates.some((c) => c.selected)
      );
    case "accepted":
      return requirements.filter((r) => r.candidates.some((c) => c.selected));
    default:
      return requirements;
  }
}

const emptyMessages: Record<FilterTab, string> = {
  all: "No icons with candidates yet. Generate some icons to get started.",
  "needs-pick": "All icons with candidates have a selection. Great work!",
  accepted: "No accepted icons yet. Pick a candidate for each icon.",
};

export function CandidateReview({ pack }: CandidateReviewProps) {
  const [tab, setTab] = useState<FilterTab>("all");

  const filtered = filterRequirements(pack.requirements, tab);

  return (
    <div className="space-y-4">
      {/* Header + tabs */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-semibold">Review Candidates</h3>
        <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="needs-pick">Needs Pick</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Requirement rows */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {emptyMessages[tab]}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <CandidateRow key={req.id} requirement={req} />
          ))}
        </div>
      )}
    </div>
  );
}
