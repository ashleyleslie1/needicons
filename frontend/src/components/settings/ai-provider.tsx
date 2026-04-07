import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateProviderSettings } from "@/hooks/api/use-settings";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">AI Provider</h1>
        <p className="text-sm text-muted-foreground">
          Configure your OpenAI API key and default generation model.
        </p>
      </div>

      {/* API Key Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">API Key</h2>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1">
                {provider?.api_key ?? "Not set"}
              </code>
              {provider?.api_key_set && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <span>✓</span>
                  <span>key verified</span>
                </span>
              )}
            </div>
            {!editingKey ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingKey(true)}
              >
                Change
              </Button>
            ) : (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveKey}
                    disabled={!newKey || updateProvider.isPending}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setEditingKey(false); setNewKey(""); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Default Model */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Image Model</h2>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {([
              { id: "gpt-image-1.5", label: "GPT Image 1.5", desc: "Best quality" },
              { id: "gpt-image-1-mini", label: "GPT Image Mini", desc: "Fast & cheap" },
              { id: "dall-e-3", label: "DALL-E 3", desc: "Classic" },
            ] as const).map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => updateProvider.mutate({ default_model: model.id })}
                className={`flex flex-col items-start px-3 py-2 rounded-md border text-sm transition-colors ${
                  provider?.default_model === model.id
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="font-medium">{model.label}</span>
                <span className="text-[10px] opacity-60">{model.desc}</span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          GPT Image models support transparent backgrounds. HQ mode uses 4x more API calls.
        </p>
      </div>
    </div>
  );
}
