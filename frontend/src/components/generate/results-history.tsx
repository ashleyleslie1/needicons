import type { GenerationRecord } from "@/lib/types";
import { GenerationRow } from "./generation-row";

interface ResultsHistoryProps {
  records: GenerationRecord[];
}

export function ResultsHistory({ records }: ResultsHistoryProps) {
  if (records.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {records.map((record) => (
        <GenerationRow key={record.id} record={record} />
      ))}
    </div>
  );
}
