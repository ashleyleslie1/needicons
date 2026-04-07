import { useGpuStatus, useUpdateGpuProvider } from "@/hooks/api/use-settings";
import { cn } from "@/lib/utils";

const PROVIDER_LABELS: Record<string, { label: string; desc: string }> = {
  auto: { label: "Auto", desc: "Use best available backend" },
  directml: { label: "DirectML", desc: "DirectX 12 GPU (Windows)" },
  cuda: { label: "CUDA", desc: "NVIDIA GPU (Linux/Windows)" },
  rocm: { label: "ROCm", desc: "AMD GPU (Linux)" },
  cpu: { label: "CPU", desc: "No GPU acceleration" },
};

export function GpuSettings() {
  const { data: gpu, isLoading } = useGpuStatus();
  const updateProvider = useUpdateGpuProvider();

  if (isLoading || !gpu) {
    return <div className="text-sm text-muted-foreground">Detecting hardware...</div>;
  }

  const preference = gpu.preference || "auto";

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">GPU Acceleration</h3>
        <p className="text-sm text-muted-foreground">
          Controls which backend is used for background removal and image processing.
        </p>
      </div>

      <div className="rounded-lg bg-muted/50 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Active backend</span>
          <span className="font-medium text-foreground">{gpu.detail}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Available providers</span>
          <span className="text-foreground">
            {gpu.available_providers.map((p) => p.name).join(", ")}
          </span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Provider preference</h4>
        <div className="grid gap-2">
          {["auto", ...gpu.available_providers.map((p) => p.id)].filter(
            (v, i, a) => a.indexOf(v) === i
          ).map((id) => {
            const info = PROVIDER_LABELS[id] || { label: id, desc: "" };
            const isAvailable = id === "auto" || gpu.available_providers.some((p) => p.id === id);
            const isSelected = preference === id;

            return (
              <button
                key={id}
                onClick={() => updateProvider.mutate(id)}
                disabled={!isAvailable || updateProvider.isPending}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                  isSelected
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/40",
                  !isAvailable && "opacity-40 cursor-not-allowed",
                )}
              >
                <div className={cn(
                  "h-3 w-3 shrink-0 rounded-full border-2",
                  isSelected ? "border-accent bg-accent" : "border-muted-foreground/40",
                )} />
                <div>
                  <div className="text-sm font-medium text-foreground">{info.label}</div>
                  <div className="text-xs text-muted-foreground">{info.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {gpu.available_providers.length === 1 && gpu.available_providers[0].id === "cpu" && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">No GPU detected</p>
          <p>Install a GPU-accelerated ONNX Runtime to speed up background removal:</p>
          <div className="space-y-1 font-mono text-xs">
            <p>Windows (DirectX 12): <code className="bg-muted px-1.5 py-0.5 rounded">pip install onnxruntime-directml</code></p>
            <p>NVIDIA (CUDA): <code className="bg-muted px-1.5 py-0.5 rounded">pip install onnxruntime-gpu</code></p>
          </div>
        </div>
      )}
    </div>
  );
}
