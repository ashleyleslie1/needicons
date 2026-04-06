interface CostEstimateProps {
  iconCount: number;
  quality: "normal" | "hq";
  variations: number;
}

function calcApiCalls(
  iconCount: number,
  quality: "normal" | "hq",
  variations: number
): number {
  if (quality === "hq") {
    return iconCount * variations;
  }
  // normal
  if (variations > 1) {
    return iconCount * Math.ceil(variations / 4);
  }
  return Math.ceil(iconCount / 4);
}

export function CostEstimate({ iconCount, quality, variations }: CostEstimateProps) {
  const apiCalls = calcApiCalls(iconCount, quality, variations);
  const totalCandidates = iconCount * variations;
  const estimatedCost = apiCalls * 0.04;

  const hqCost = iconCount * variations * 0.04;
  const savings = hqCost - estimatedCost;
  const showSavings = quality === "normal" && savings > 0;

  return (
    <div className="bg-muted rounded-lg p-3 space-y-1.5 text-xs">
      <div className="flex justify-between">
        <span className="text-muted-foreground">API calls</span>
        <span className="font-medium">{apiCalls}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Total candidates</span>
        <span className="font-medium">{totalCandidates}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Est. cost</span>
        <span className="font-medium">${estimatedCost.toFixed(2)}</span>
      </div>
      {showSavings && (
        <div className="flex justify-between border-t border-border pt-1.5">
          <span className="text-muted-foreground">vs HQ savings</span>
          <span className="font-medium text-green-500">${savings.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
