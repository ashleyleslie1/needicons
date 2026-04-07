import { Button } from "@/components/ui/button";

interface GenerateButtonProps {
  iconCount: number;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function GenerateButton({ iconCount, onClick, disabled, loading }: GenerateButtonProps) {
  const label = iconCount <= 1 ? "\u2726 Generate icon" : `\u2726 Generate ${iconCount} icons`;

  return (
    <Button onClick={onClick} disabled={disabled || loading}>
      {loading ? "Generating..." : label}
    </Button>
  );
}
