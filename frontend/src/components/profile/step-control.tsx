import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface StepControlProps {
  label: string;
  enabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  showToggle?: boolean;
  children?: React.ReactNode;
}

export function StepControl({
  label,
  enabled,
  onEnabledChange,
  showToggle = true,
  children,
}: StepControlProps) {
  const [expanded, setExpanded] = useState(false);

  const isEnabled = showToggle ? (enabled ?? false) : true;
  const showContent = expanded && isEnabled;

  function handleLabelClick() {
    if (!isEnabled) return;
    setExpanded((prev) => !prev);
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleLabelClick}
          className={cn(
            "text-xs font-semibold text-left flex-1 transition-colors",
            isEnabled ? "text-foreground hover:text-foreground/80" : "text-muted-foreground"
          )}
        >
          {label}
        </button>
        {showToggle && onEnabledChange && (
          <Switch
            checked={enabled ?? false}
            onCheckedChange={onEnabledChange}
          />
        )}
      </div>
      {showContent && children && (
        <div className="bg-muted rounded-md p-2">
          {children}
        </div>
      )}
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}

export function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
}: SliderFieldProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs text-foreground font-medium">
          {value}{unit}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}
