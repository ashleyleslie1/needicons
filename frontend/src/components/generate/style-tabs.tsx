import type { IconStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: { value: IconStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "outline", label: "Outline" },
  { value: "colorful", label: "Colorful" },
  { value: "flat", label: "Flat" },
  { value: "sticker", label: "Sticker" },
];

interface StyleTabsProps {
  value: IconStyle;
  onChange: (style: IconStyle) => void;
}

export function StyleTabs({ value, onChange }: StyleTabsProps) {
  return (
    <div className="flex gap-2">
      {STYLES.map((style) => (
        <button
          key={style.value}
          onClick={() => onChange(style.value)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            value === style.value
              ? "bg-accent/15 text-accent ring-1 ring-accent"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          )}
        >
          {style.label}
        </button>
      ))}
    </div>
  );
}
