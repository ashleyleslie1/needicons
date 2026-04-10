import type { IconStyle } from "@/lib/types";
import { Square, PenTool, Sparkles, Layers, Sticker } from "lucide-react";
import { cn } from "@/lib/utils";

const STYLES: {
  value: IconStyle;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "solid", label: "Solid", Icon: Square },
  { value: "outline", label: "Outline", Icon: PenTool },
  { value: "colorful", label: "Colorful", Icon: Sparkles },
  { value: "flat", label: "Flat", Icon: Layers },
  { value: "sticker", label: "Sticker", Icon: Sticker },
];

interface StyleDropdownProps {
  value: IconStyle;
  onChange: (value: IconStyle) => void;
}

export function StyleDropdown({ value, onChange }: StyleDropdownProps) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">
        Style
      </label>
      <div className="grid grid-cols-5 gap-1">
        {STYLES.map((s) => (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            title={s.label}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg py-2 px-1 transition-all text-center",
              value === s.value
                ? "bg-accent/15 ring-1 ring-accent/30 text-accent"
                : "bg-input hover:bg-card/80 text-muted-foreground hover:text-foreground",
            )}
          >
            <s.Icon className="h-4 w-4" />
            <span className="text-[9px] font-medium leading-none">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
