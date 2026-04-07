import type { IconStyle } from "@/lib/types";

const STYLES: {
  value: IconStyle;
  label: string;
  desc: string;
  preview: React.CSSProperties;
}[] = [
  {
    value: "solid",
    label: "Solid",
    desc: "Bold filled silhouette",
    preview: { background: "#fff", borderRadius: "3px" },
  },
  {
    value: "outline",
    label: "Outline",
    desc: "Clean line art",
    preview: { border: "2px solid #fff", borderRadius: "3px", background: "transparent" },
  },
  {
    value: "colorful",
    label: "Colorful",
    desc: "Rich colors, polished",
    preview: { background: "linear-gradient(135deg, #e74c3c, #3498db)", borderRadius: "3px" },
  },
  {
    value: "flat",
    label: "Flat",
    desc: "Minimal, limited palette",
    preview: { background: "#3498db", borderRadius: "2px" },
  },
  {
    value: "sticker",
    label: "Sticker",
    desc: "Playful 3D, rounded",
    preview: { background: "#f39c12", borderRadius: "50%", boxShadow: "0 2px 4px rgba(0,0,0,0.4)" },
  },
];

interface StyleDropdownProps {
  value: IconStyle;
  onChange: (value: IconStyle) => void;
}

export function StyleDropdown({ value, onChange }: StyleDropdownProps) {
  const selected = STYLES.find((s) => s.value === value) || STYLES[0];

  return (
    <div className="relative group">
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
        Style
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as IconStyle)}
        className="w-full appearance-none bg-muted/40 border border-border rounded-md px-3 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
        style={{ paddingLeft: "40px" }}
      >
        {STYLES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label} — {s.desc}
          </option>
        ))}
      </select>
      <div
        className="absolute left-2.5 top-[26px] w-5 h-5 pointer-events-none"
        style={selected.preview}
      />
      <div className="absolute right-2.5 top-[26px] pointer-events-none text-muted-foreground">
        ▾
      </div>
    </div>
  );
}
