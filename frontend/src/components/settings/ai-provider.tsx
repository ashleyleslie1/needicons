import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateProviderSettings } from "@/hooks/api/use-settings";
import { Brain, Plus, Check } from "lucide-react";

export function AiProviderSettings() {
  const { data: settings, isLoading } = useSettings();
  const updateProvider = useUpdateProviderSettings();
  const [editingKey, setEditingKey] = useState(false);
  const [newKey, setNewKey] = useState("");

  const provider = settings?.provider;

  async function handleSaveKey() {
    await updateProvider.mutateAsync({ api_key: newKey });
    setNewKey("");
    setEditingKey(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Connect your AI providers. Model selection is done per-generation in the Generate tab.
        </p>
      </div>

      {/* OpenAI */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <Brain className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">OpenAI</h2>
            <p className="text-[10px] text-muted-foreground">GPT Image 1.5, GPT Image Mini</p>
          </div>
          {provider?.api_key_set && (
            <span className="flex items-center gap-1 text-xs text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" />
              Connected
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <code className="text-xs font-mono bg-input px-3 py-1.5 rounded-lg flex-1 text-muted-foreground">
                {provider?.api_key_set && provider.api_key
                  ? (() => {
                      const key = provider.api_key;
                      const start = key.slice(0, Math.min(10, key.length));
                      const end = key.slice(-3);
                      const midLen = Math.max(0, key.length - 13);
                      return `${start}${"*".repeat(midLen)}${end}`;
                    })()
                  : "Not configured"}
              </code>
            </div>
            {!editingKey ? (
              <Button variant="outline" size="sm" onClick={() => setEditingKey(true)}>
                {provider?.api_key_set ? "Change Key" : "Add Key"}
              </Button>
            ) : (
              <div className="space-y-2">
                <Input type="password" placeholder="sk-..." value={newKey} onChange={(e) => setNewKey(e.target.value)} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveKey} disabled={!newKey || updateProvider.isPending}>Save</Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingKey(false); setNewKey(""); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Future providers */}
      <div className="rounded-xl border border-border/50 border-dashed bg-card/10 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Plus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">More providers coming soon</h2>
            <p className="text-[10px] text-muted-foreground">Google Gemini, Stability AI, and more</p>
          </div>
        </div>
      </div>
    </div>
  );
}
