import { useState, useRef, useEffect } from "react";
import { useGpuStatus, useUpdateGpuProvider, useProcessingLog } from "@/hooks/api/use-settings";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const PROVIDER_LABELS: Record<string, { label: string; desc: string }> = {
  auto: { label: "Auto", desc: "Use best available backend" },
  directml: { label: "DirectML", desc: "DirectX 12 GPU (Windows)" },
  cuda: { label: "CUDA", desc: "NVIDIA GPU (Linux/Windows)" },
  rocm: { label: "ROCm", desc: "AMD GPU (Linux)" },
  cpu: { label: "CPU", desc: "No GPU acceleration" },
};

const INSTALLABLE_PACKAGES: Array<{ id: string; package: string; label: string; desc: string }> = [
  { id: "directml", package: "onnxruntime-directml", label: "DirectML", desc: "Windows (DirectX 12 GPU)" },
  { id: "cuda", package: "onnxruntime-gpu", label: "CUDA", desc: "NVIDIA GPU (Linux/Windows)" },
];

export function GpuSettings() {
  const { data: gpu, isLoading, refetch } = useGpuStatus();
  const updateProvider = useUpdateGpuProvider();
  const { data: logData } = useProcessingLog();

  const [installing, setInstalling] = useState<string | null>(null);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [installResult, setInstallResult] = useState<{ success: boolean; error?: string } | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  function handleInstall(packageName: string) {
    setInstalling(packageName);
    setTerminalLines([`$ pip install --user ${packageName}`]);
    setInstallResult(null);

    const es = new EventSource(`/api/settings/gpu/install/stream?package=${encodeURIComponent(packageName)}`);
    es.addEventListener("start", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setTerminalLines((prev) => [...prev, data.message]);
    });
    es.addEventListener("output", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      setTerminalLines((prev) => [...prev, data.line]);
    });
    es.addEventListener("complete", (e) => {
      const data = JSON.parse((e as MessageEvent).data);
      es.close();
      setInstallResult(data);
      if (data.success) {
        setTerminalLines((prev) => [...prev, "", "Installation complete. GPU providers refreshed."]);
        refetch();
      } else {
        setTerminalLines((prev) => [...prev, "", `Error: ${data.error}`]);
      }
    });
    es.onerror = () => {
      es.close();
      setInstallResult({ success: false, error: "Connection lost" });
    };
  }

  if (isLoading || !gpu) {
    return <div className="text-sm text-muted-foreground">Detecting hardware...</div>;
  }

  const preference = gpu.preference || "auto";
  const hasGpu = gpu.available_providers.some((p) => p.id !== "cpu");
  const recentLog = logData?.entries?.slice(0, 10) ?? [];

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
          <span className="text-muted-foreground">Providers</span>
          <span className="text-foreground">{gpu.available_providers.map((p) => p.name).join(", ")}</span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Provider preference</h4>
        <div className="grid gap-2">
          {["auto", ...gpu.available_providers.map((p) => p.id)].filter((v, i, a) => a.indexOf(v) === i).map((id) => {
            const info = PROVIDER_LABELS[id] || { label: id, desc: "" };
            const isAvailable = id === "auto" || gpu.available_providers.some((p) => p.id === id);
            return (
              <button
                key={id}
                onClick={() => updateProvider.mutate(id)}
                disabled={!isAvailable || updateProvider.isPending}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                  preference === id ? "border-accent bg-accent/5" : "border-border hover:border-accent/40",
                  !isAvailable && "opacity-40 cursor-not-allowed",
                )}
              >
                <div className={cn("h-3 w-3 shrink-0 rounded-full border-2", preference === id ? "border-accent bg-accent" : "border-muted-foreground/40")} />
                <div>
                  <div className="text-sm font-medium text-foreground">{info.label}</div>
                  <div className="text-xs text-muted-foreground">{info.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {!hasGpu && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div>
            <p className="font-medium text-foreground text-sm">No GPU detected</p>
            <p className="text-sm text-muted-foreground mt-1">Install a GPU-accelerated ONNX Runtime:</p>
          </div>
          <div className="grid gap-2">
            {INSTALLABLE_PACKAGES.map((pkg) => (
              <div key={pkg.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{pkg.label}</div>
                  <div className="text-xs text-muted-foreground">{pkg.desc}</div>
                  <code className="mt-1 block text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded w-fit">{pkg.package}</code>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleInstall(pkg.package)} disabled={!!installing}>
                  Install
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing History */}
      {recentLog.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-foreground">Processing History</h4>
            <button onClick={() => api.clearProcessingLog()} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {recentLog.map((entry, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "inline-flex h-5 items-center rounded-full px-2 font-medium",
                    entry.backend === "runpod" ? "bg-purple-500/10 text-purple-500" :
                    entry.backend === "local_gpu" ? "bg-green-500/10 text-green-500" :
                    "bg-muted text-muted-foreground",
                  )}>
                    {entry.backend === "runpod" ? "RunPod" : entry.backend === "local_gpu" ? "GPU" : "CPU"}
                  </span>
                  <span className="text-foreground">{entry.operation}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{entry.duration_ms.toFixed(0)}ms</span>
                  <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terminal Modal */}
      <Dialog open={!!installing} onOpenChange={() => installResult && setInstalling(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Installing {installing}</DialogTitle></DialogHeader>
          <div ref={terminalRef} className="h-64 overflow-y-auto rounded-lg bg-zinc-900 p-3 font-mono text-xs text-zinc-200 leading-relaxed">
            {terminalLines.map((line, i) => (<div key={i} className={cn(line === "" && "h-2")}>{line}</div>))}
            {!installResult && <div className="inline-block h-3 w-1.5 animate-pulse bg-zinc-400" />}
          </div>
          {installResult && (
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-medium", installResult.success ? "text-green-500" : "text-red-500")}>
                {installResult.success ? "Installation successful" : `Failed: ${installResult.error}`}
              </span>
              <Button size="sm" onClick={() => setInstalling(null)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
