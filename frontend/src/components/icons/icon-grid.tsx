import { IconTile } from "./icon-tile";
import { AddRequirement } from "./add-requirement";
import type { Pack } from "@/lib/types";

interface IconGridProps {
  pack: Pack;
  onRequirementClick: (id: string) => void;
  selectedIds: Set<string>;
  onSelectionChange: (id: string) => void;
}

export function IconGrid({
  pack,
  onRequirementClick,
  selectedIds,
  onSelectionChange,
}: IconGridProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2.5 p-4">
      {pack.requirements.map((req) => (
        <IconTile
          key={req.id}
          requirement={req}
          selected={selectedIds.has(req.id)}
          onSelect={onSelectionChange}
          onClick={onRequirementClick}
        />
      ))}
      <AddRequirement packId={pack.id} />
    </div>
  );
}
