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
        "block rounded-lg px-3 py-3 transition-colors",
        isActive
          ? "bg-card border border-accent/30"
          : "hover:bg-card/60 border border-transparent"
      )}
    >
      <p className="font-semibold text-sm truncate">{pack.name}</p>
      <p className="text-xs text-muted-foreground mt-1">
        {accepted}/{total} accepted
      </p>
      <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </Link>
  );
}
