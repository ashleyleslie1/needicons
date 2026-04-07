type Mood = "" | "none" | "cinematic" | "vibrant" | "dynamic" | "fashion" | "portrait" | "stock_photo";

const MOODS: {
  value: Mood;
  label: string;
  desc: string;
  emoji: string;
}[] = [
  { value: "none", label: "None", desc: "No mood modifier", emoji: "—" },
  { value: "cinematic", label: "Cinematic", desc: "Dramatic lighting, film-like", emoji: "🎬" },
  { value: "vibrant", label: "Vibrant", desc: "Saturated, energetic", emoji: "✨" },
  { value: "dynamic", label: "Dynamic", desc: "Motion, action-oriented", emoji: "⚡" },
  { value: "fashion", label: "Fashion", desc: "Elegant, editorial", emoji: "👗" },
  { value: "portrait", label: "Portrait", desc: "Close-up, detailed", emoji: "👤" },
  { value: "stock_photo", label: "Stock Photo", desc: "Clean, professional", emoji: "📷" },
];

interface MoodDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function MoodDropdown({ value, onChange }: MoodDropdownProps) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">
        Mood <span className="normal-case text-muted-foreground/50">(optional)</span>
      </label>
      <select
        value={value || "none"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-muted/40 border border-border rounded-md px-3 py-2 text-sm text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {MOODS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.emoji} {m.label} — {m.desc}
          </option>
        ))}
      </select>
    </div>
  );
}
