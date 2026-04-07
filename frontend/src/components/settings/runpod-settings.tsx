import { useState } from "react";
import { useRunPodConfig, useUpdateRunPodConfig, useTestRunPodConnection } from "@/hooks/api/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function RunPodSettings() {
  const { data: config, isLoading } = useRunPodConfig();
  const updateConfig = useUpdateRunPodConfig();
  const testConnection = useTestRunPodConnection();

  const [editingKey, setEditingKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [endpointId, setEndpointId] = useState("");
  const [endpointDirty, setEndpointDirty] = useState(false);

  if (isLoading || !config) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">RunPod Serverless</h3>
        <p className="text-sm text-muted-foreground">
          Offload heavy ML processing (background removal) to RunPod serverless GPUs.
          Pay per second (~$0.00016/s). Optional — disable to use local processing only.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={config.enabled}
          onCheckedChange={(checked) => updateConfig.mutate({ enabled: checked })}
          disabled={updateConfig.isPending}
        />
        <span className="text-sm font-medium text-foreground">
          {config.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {config.enabled && (
        <>
          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">API Key</label>
            <div className="flex items-center gap-3">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1">
                {config.api_key || "Not set"}
              </code>
              {config.api_key_set && (
                <span className="text-xs text-green-500">Set</span>
              )}
            </div>
            {!editingKey ? (
              <Button variant="outline" size="sm" onClick={() => setEditingKey(true)}>
                {config.api_key_set ? "Change" : "Set Key"}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="rp_..."
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    updateConfig.mutate({ api_key: newKey });
                    setNewKey("");
                    setEditingKey(false);
                  }}
                  disabled={!newKey}
                >
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEditingKey(false); setNewKey(""); }}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Endpoint ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Endpoint ID</label>
            <div className="flex gap-2">
              <Input
                placeholder="abc123def456"
                value={endpointDirty ? endpointId : config.endpoint_id}
                onChange={(e) => { setEndpointId(e.target.value); setEndpointDirty(true); }}
                className="text-sm font-mono"
              />
              {endpointDirty && (
                <Button
                  size="sm"
                  onClick={() => {
                    updateConfig.mutate({ endpoint_id: endpointId });
                    setEndpointDirty(false);
                  }}
                >
                  Save
                </Button>
              )}
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending || !config.api_key_set || !config.endpoint_id}
            >
              {testConnection.isPending ? "Testing..." : "Test Connection"}
            </Button>
            {testConnection.data && (
              <span className={cn(
                "text-xs font-medium",
                testConnection.data.status === "connected" ? "text-green-500" : "text-red-500",
              )}>
                {testConnection.data.status === "connected" ? "Connected" : `Error: ${testConnection.data.error}`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
