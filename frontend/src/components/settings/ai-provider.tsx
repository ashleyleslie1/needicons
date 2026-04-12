import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings, useUpdateProviderSettings, useUpdateStabilitySettings } from "@/hooks/api/use-settings";
import { Check } from "lucide-react";

function ProviderCard({
  name,
  description,
  color,
  icon,
  connected,
  maskedKey,
  isLoading,
  onSave,
  onRemove,
  isSaving,
}: {
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  connected: boolean;
  maskedKey: string;
  isLoading: boolean;
  onSave: (key: string) => Promise<void>;
  onRemove: () => Promise<void>;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [newKey, setNewKey] = useState("");

  async function handleSave() {
    await onSave(newKey);
    setNewKey("");
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color} shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{name}</h3>
            {connected && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                <Check className="h-3 w-3" />
                Connected
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 h-8 rounded-lg bg-surface animate-pulse" />
      ) : (
        <div className="mt-4 space-y-3">
          {connected && (
            <code className="block text-[11px] font-mono bg-surface px-3 py-2 rounded-lg text-muted-foreground">
              {maskedKey}
            </code>
          )}
          {!editing ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                {connected ? "Change key" : "Add key"}
              </Button>
              {connected && (
                <Button variant="destructive" size="sm" onClick={onRemove}>
                  Remove
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Paste your API key..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="text-xs"
                onKeyDown={(e) => { if (e.key === "Enter" && newKey) handleSave(); }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={!newKey || isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); setNewKey(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function maskKey(key: string | undefined) {
  if (!key) return "";
  const start = key.slice(0, Math.min(10, key.length));
  const end = key.slice(-3);
  const midLen = Math.max(0, key.length - 13);
  return `${start}${"*".repeat(midLen)}${end}`;
}

export function AiProviderSettings() {
  const { data: settings, isLoading } = useSettings();
  const updateProvider = useUpdateProviderSettings();
  const updateStability = useUpdateStabilitySettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your AI providers. Models appear in the Create tab based on which keys are active.
        </p>
      </div>

      <ProviderCard
        name="OpenAI"
        description="GPT Image 1.5, GPT Image Mini, AI Enhance, AI Refine"
        color="bg-emerald-500/10"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>}
        connected={!!settings?.provider?.api_key_set}
        maskedKey={maskKey(settings?.provider?.api_key)}
        isLoading={isLoading}
        onSave={async (key) => { await updateProvider.mutateAsync({ api_key: key }); }}
        onRemove={async () => { if (confirm("Remove OpenAI API key?")) await updateProvider.mutateAsync({ api_key: "" } as any); }}
        isSaving={updateProvider.isPending}
      />

      <ProviderCard
        name="Stability AI"
        description="SD 3.5 Flash, Medium, Large Turbo, Large + Background Removal"
        color="bg-violet-500/10"
        icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-violet-500"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>}
        connected={!!settings?.stability?.api_key_set}
        maskedKey={maskKey(settings?.stability?.api_key)}
        isLoading={isLoading}
        onSave={async (key) => { await updateStability.mutateAsync({ api_key: key }); }}
        onRemove={async () => { if (confirm("Remove Stability AI API key?")) await updateStability.mutateAsync({ api_key: "" }); }}
        isSaving={updateStability.isPending}
      />
    </div>
  );
}
