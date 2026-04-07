import { useSidebar } from "@/hooks/ui/use-sidebar";
import { Button } from "@/components/ui/button";
import type { Pack } from "@/lib/types";

interface PackHeaderProps {
  pack: Pack;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function PackHeader({
  pack,
  selectedCount,
  onSelectAll,
  onClearSelection,
}: PackHeaderProps) {
  const { setRightPanel } = useSidebar();

  const totalIcons = pack.requirements.length;
  const acceptedCount = pack.requirements.filter((r) => r.status === "accepted").length;

  return (
    <div className="flex items-center justify-between shrink-0">
      {/* Left: pack name + subtitle */}
      <div className="flex flex-col gap-1 min-w-0">
        <h2 className="text-2xl font-bold truncate">{pack.name}</h2>
        <p className="text-sm text-muted-foreground">
          {totalIcons} icon{totalIcons !== 1 ? "s" : ""} &middot;{" "}
          {acceptedCount} accepted
          {selectedCount > 0 && (
            <>
              {" "}&middot;{" "}
              <span className="text-accent font-medium">
                {selectedCount} selected
              </span>
            </>
          )}
        </p>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {selectedCount > 0 ? (
          <>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              Clear
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setRightPanel("generation")}
            >
              Generate {selectedCount} &rarr;
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onSelectAll}>
              Select All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRightPanel("profile")}
            >
              Profile
            </Button>
            <Button variant="default" size="sm">
              Export
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
