import { useGpuStatus } from "@/hooks/api/use-settings";

export function GpuPerformanceSettings() {
  const { data: gpu, isLoading } = useGpuStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">GPU &amp; Performance</h1>
        <p className="text-sm text-muted-foreground">
          Hardware acceleration status for image processing pipelines.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">GPU Detection</h2>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Detecting…</p>
        ) : (
          <div className="border border-border rounded-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${gpu?.available ? "bg-green-500" : "bg-muted-foreground"}`}
              />
              <span className="text-sm font-medium">
                {gpu?.available ? "GPU available" : "No GPU detected"}
              </span>
            </div>
            {gpu && (
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex gap-2">
                  <span className="w-16 shrink-0">Backend</span>
                  <span className="font-mono">{gpu.backend}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 shrink-0">Detail</span>
                  <span>{gpu.detail}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
