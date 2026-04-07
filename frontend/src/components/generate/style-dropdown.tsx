import type { IconStyle } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: {
  value: IconStyle;
  label: string;
  desc: string;
  preview: React.CSSProperties;
}[] = [
  { value: "solid", label: "Solid", desc: "Bold filled silhouette", preview: { background: "currentColor", borderRadius: "2px" } },
  { value: "outline", label: "Outline", desc: "Clean line art", preview: { border: "2px solid currentColor", borderRadius: "2px", background: "transparent" } },
  { value: "colorful", label: "Colorful", desc: "Rich colors, polished", preview: { background: "linear-gradient(135deg, #e74c3c, #3498db)", borderRadius: "2px" } },
  { value: "flat", label: "Flat", desc: "Minimal, limited palette", preview: { background: "#3498db", borderRadius: "2px" } },
  { value: "sticker", label: "Sticker", desc: "Playful 3D, rounded", preview: { background: "#f39c12", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" } },
];

interface StyleDropdownProps {
  value: IconStyle;
  onChange: (value: IconStyle) => void;
}

export function StyleDropdown({ value, onChange }: StyleDropdownProps) {
  const selected = STYLES.find((s) => s.value === value) || STYLES[0];

  return (
    <div className="relative">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block font-medium">
        Style
      </label>
      <div className="relative">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={selected.preview} />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as IconStyle)}
          className={cn(
            "w-full appearance-none rounded-lg border border-border bg-card/80 backdrop-blur-sm",
            "pl-9 pr-8 py-2 text-sm text-foreground",
            "cursor-pointer transition-colors",
            "hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
          )}
        >
          {STYLES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} — {s.desc}
            </option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
