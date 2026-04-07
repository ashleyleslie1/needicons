import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateProviderSettings } from "@/hooks/api/use-settings";
import { useEdition } from "@/hooks/use-edition";

const ALL_MODELS = [
  { id: "gpt-image-1.5", label: "GPT Image 1.5", desc: "Best quality" },
  { id: "gpt-image-1-mini", label: "GPT Image Mini", desc: "Fast & cheap" },
  { id: "dall-e-3", label: "DALL-E 3", desc: "Classic" },
] as const;

function ModelSelector({ currentModel, onSelect }: { currentModel: string; onSelect: (model: string) => void }) {
  const { showAllModels, showDalle3Warning } = useEdition();

  const models = showAllModels
    ? ALL_MODELS
    : ALL_MODELS.filter((m) => m.id !== "dall-e-3");

  return (
    <div className="flex flex-wrap gap-2">
      {models.map((model) => {
        const isDalle3 = model.id === "dall-e-3";
        return (
          <button
            key={model.id}
            type="button"
            onClick={() => onSelect(model.id)}
            className={`flex flex-col items-start px-3 py-2 rounded-md border text-sm transition-colors ${
              currentModel === model.id
                ? "border-accent bg-accent/10 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="font-medium">
              {model.label}
              {isDalle3 && showDalle3Warning && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                  Legacy
                </span>
              )}
            </span>
            <span className="text-[10px] opacity-60">
              {isDalle3 && showDalle3Warning ? "Inconsistent results for icons" : model.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">API Key</h2>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1">
                {provider?.api_key ?? "Not set"}
              </code>
              {provider?.api_key_set && (
                <span className="text-xs text-green-500 flex items-center gap-1">
                  <span>&#10003;</span><span>key verified</span>
                </span>
              )}
            </div>
            {!editingKey ? (
              <Button variant="outline" size="sm" onClick={() => setEditingKey(true)}>Change</Button>
            ) : (
              <div className="space-y-2">
                <Input type="password" placeholder="sk-..." value={newKey} onChange={(e) => setNewKey(e.target.value)} className="text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveKey} disabled={!newKey || updateProvider.isPending}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => { setEditingKey(false); setNewKey(""); }}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Image Model</h2>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : (
          <ModelSelector
            currentModel={provider?.default_model ?? "gpt-image-1.5"}
            onSelect={(model) => updateProvider.mutate({ default_model: model })}
          />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          GPT Image models support transparent backgrounds. HQ mode uses 4x more API calls.
        </p>
      </div>
    </div>
  );
}
