import { useEffect, useMemo } from "react";
import { useModelCapabilities } from "@/hooks/api/use-settings";
import { FancySelect } from "@/components/ui/fancy-select";
import { Cpu, Zap, Globe } from "lucide-react";

interface ModelDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function ModelDropdown({ value, onChange }: ModelDropdownProps) {
  const { data: capabilities } = useModelCapabilities();

  const availableModels = capabilities ? Object.keys(capabilities) : [];

  useEffect(() => {
    if (availableModels.length > 0 && (!value || !availableModels.includes(value))) {
      onChange(availableModels[0]);
    }
  }, [availableModels.join(","), value]);

  const options = useMemo(() => {
    return availableModels.map((modelId) => {
      const caps = capabilities?.[modelId];
      const label = caps?.label ?? modelId;
      const provider = caps?.provider;
      const isStability = provider === "stability";
      const isOpenRouter = provider === "openrouter";
      const desc = isStability ? "Stability AI" : isOpenRouter ? "OpenRouter" : "OpenAI";
      const icon = isOpenRouter
        ? <Globe className="h-3.5 w-3.5" />
        : isStability
          ? <Zap className="h-3.5 w-3.5" />
          : <Cpu className="h-3.5 w-3.5" />;
      return {
        value: modelId,
        label: label + (caps?.legacy ? " (Legacy)" : ""),
        desc,
        icon,
      };
    });
  }, [availableModels, capabilities]);

  return <FancySelect label="Model" options={options} value={value || availableModels[0] || ""} onChange={onChange} />;
}
