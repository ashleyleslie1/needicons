import { IconTile } from "./icon-tile";
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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-5">
      {pack.requirements.map((req) => (
        <IconTile
          key={req.id}
          requirement={req}
          selected={selectedIds.has(req.id)}
          onSelect={onSelectionChange}
          onClick={onRequirementClick}
        />
      ))}
    </div>
  );
}
