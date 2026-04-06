import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateProviderSettings } from "@/hooks/api/use-settings";

interface ApiKeyModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Model = "gpt-4o" | "dall-e-3";

const MODEL_LABELS: Record<Model, string> = {
  "gpt-4o": "GPT-4o",
  "dall-e-3": "DALL-E 3",
};

export function ApiKeyModal({ open, onClose, onSaved }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState<Model>("gpt-4o");

  const updateSettings = useUpdateProviderSettings();

  async function handleSave() {
    await updateSettings.mutateAsync({
      api_key: apiKey,
      default_model: selectedModel,
    });
    onSaved();
  }

  const isSaving = updateSettings.isPending;
  const isDisabled = !apiKey.trim() || isSaving;

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center text-2xl">
              🔑
            </div>
          </div>
          <DialogTitle className="text-center">API Key Required</DialogTitle>
          <p className="text-sm text-muted-foreground text-center mt-1">
            Enter your OpenAI API key to start generating icons. Your key is
            used only to make requests to OpenAI on your behalf.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* API Key input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              API Key
            </label>
            <Input
              type="password"
              placeholder="sk-paste-your-key-here"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
          </div>

          {/* Model picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Model
            </label>
            <div className="flex gap-2">
              {(Object.keys(MODEL_LABELS) as Model[]).map((model) => (
                <button
                  key={model}
                  type="button"
                  onClick={() => setSelectedModel(model)}
                  className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                    selectedModel === model
                      ? "border-accent bg-accent/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-accent/50"
                  }`}
                >
                  {MODEL_LABELS[model]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-col">
          <Button
            className="w-full"
            disabled={isDisabled}
            onClick={handleSave}
          >
            {isSaving ? "Saving…" : "Save & Generate"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your key is stored locally.{" "}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              Get an OpenAI API key
            </a>
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
