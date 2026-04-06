import { useParams } from "react-router-dom";

export function PackDetailPage() {
  const { packId } = useParams<{ packId: string }>();

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">{packId ?? "Pack"}</h2>
      <p className="text-sm text-muted-foreground">
        Icon grid will be implemented in Task 7.
      </p>
    </div>
  );
}
