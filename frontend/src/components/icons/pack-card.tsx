import { Link, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Pack } from "@/lib/types";

interface PackCardProps {
  pack: Pack;
}

export function PackCard({ pack }: PackCardProps) {
  const { packId } = useParams();
  const isActive = packId === pack.id;

  const total = pack.requirements.length;
  const accepted = pack.requirements.filter((r) => r.status === "accepted").length;
  const fillPercent = total > 0 ? Math.round((accepted / total) * 100) : 0;

  return (
    <Link
      to={`/packs/${pack.id}`}
      className={cn(
        "block rounded-md px-2 py-2 mb-1 transition-colors",
        isActive
          ? "bg-muted border border-accent/20"
          : "hover:bg-muted/50 border border-transparent"
      )}
    >
      <p className="font-semibold text-sm truncate">{pack.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {accepted}/{total} accepted
      </p>
      <div className="mt-1.5 h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </Link>
  );
}
