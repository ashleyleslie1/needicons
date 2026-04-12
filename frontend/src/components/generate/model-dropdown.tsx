import { useEffect, useMemo } from "react";
import { useModelCapabilities } from "@/hooks/api/use-settings";
import { FancySelect } from "@/components/ui/fancy-select";
import { Cpu, Zap } from "lucide-react";

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
      const isStability = caps?.provider === "stability";
      const desc = isStability ? "Stability AI" : "OpenAI";
      return {
        value: modelId,
        label: label + (caps?.legacy ? " (Legacy)" : ""),
        desc,
        icon: isStability
          ? <Zap className="h-3.5 w-3.5" />
          : <Cpu className="h-3.5 w-3.5" />,
      };
    });
  }, [availableModels, capabilities]);

  return <FancySelect label="Model" options={options} value={value || availableModels[0] || ""} onChange={onChange} />;
}
