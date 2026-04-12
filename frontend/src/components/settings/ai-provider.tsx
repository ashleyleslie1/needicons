import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateProviderSettings, useUpdateStabilitySettings } from "@/hooks/api/use-settings";
import { Brain, Zap, Check } from "lucide-react";

export function AiProviderSettings() {
  const { data: settings, isLoading } = useSettings();
  const updateProvider = useUpdateProviderSettings();
  const updateStability = useUpdateStabilitySettings();

  const [editingOpenAI, setEditingOpenAI] = useState(false);
  const [newOpenAIKey, setNewOpenAIKey] = useState("");
  const [editingStability, setEditingStability] = useState(false);
  const [newStabilityKey, setNewStabilityKey] = useState("");

  const provider = settings?.provider;
  const stability = settings?.stability;

  async function handleSaveOpenAI() {
    await updateProvider.mutateAsync({ api_key: newOpenAIKey });
    setNewOpenAIKey("");
    setEditingOpenAI(false);
  }

  async function handleSaveStability() {
    await updateStability.mutateAsync({ api_key: newStabilityKey });
    setNewStabilityKey("");
    setEditingStability(false);
  }

  function maskKey(key: string | undefined) {
    if (!key) return "Not configured";
    const start = key.slice(0, Math.min(10, key.length));
    const end = key.slice(-3);
    const midLen = Math.max(0, key.length - 13);
    return `${start}${"*".repeat(midLen)}${end}`;
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
            <p className="text-[10px] text-muted-foreground">GPT Image 1.5, GPT Image Mini, AI Enhance, AI Refine</p>
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
            <code className="text-xs font-mono bg-input px-3 py-1.5 rounded-lg block text-muted-foreground">
              {provider?.api_key_set ? maskKey(provider.api_key) : "Not configured"}
            </code>
            {!editingOpenAI ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingOpenAI(true)}>
                  {provider?.api_key_set ? "Change Key" : "Add Key"}
                </Button>
                {provider?.api_key_set && (
                  <Button variant="destructive" size="sm" onClick={async () => {
                    if (confirm("Remove OpenAI API key?")) {
                      await updateProvider.mutateAsync({ api_key: "" } as any);
                    }
                  }}>Remove</Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input type="password" placeholder="sk-..." value={newOpenAIKey} onChange={(e) => setNewOpenAIKey(e.target.value)} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveOpenAI} disabled={!newOpenAIKey || updateProvider.isPending}>Save</Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingOpenAI(false); setNewOpenAIKey(""); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stability AI */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <Zap className="h-4 w-4 text-violet-500" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Stability AI</h2>
            <p className="text-[10px] text-muted-foreground">SD 3.5 Flash, Medium, Large Turbo, Large + Background Removal</p>
          </div>
          {stability?.api_key_set && (
            <span className="flex items-center gap-1 text-xs text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full">
              <Check className="h-3 w-3" />
              Connected
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            <code className="text-xs font-mono bg-input px-3 py-1.5 rounded-lg block text-muted-foreground">
              {stability?.api_key_set ? maskKey(stability.api_key) : "Not configured"}
            </code>
            {!editingStability ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingStability(true)}>
                  {stability?.api_key_set ? "Change Key" : "Add Key"}
                </Button>
                {stability?.api_key_set && (
                  <Button variant="destructive" size="sm" onClick={async () => {
                    if (confirm("Remove Stability AI API key?")) {
                      await updateStability.mutateAsync({ api_key: "" });
                    }
                  }}>Remove</Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Input type="password" placeholder="sk-..." value={newStabilityKey} onChange={(e) => setNewStabilityKey(e.target.value)} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveStability} disabled={!newStabilityKey || updateStability.isPending}>Save</Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditingStability(false); setNewStabilityKey(""); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
