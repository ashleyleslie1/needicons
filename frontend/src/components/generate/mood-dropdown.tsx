import { cn } from "@/lib/utils";

const MOODS = [
  { value: "none", label: "None" },
  { value: "cinematic", label: "Cinematic" },
  { value: "vibrant", label: "Vibrant" },
  { value: "dynamic", label: "Dynamic" },
  { value: "fashion", label: "Fashion" },
  { value: "portrait", label: "Portrait" },
  { value: "stock_photo", label: "Stock Photo" },
] as const;

interface MoodDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function MoodDropdown({ value, onChange }: MoodDropdownProps) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block font-medium">
        Mood
      </label>
      <div className="relative">
        <select
          value={value || "none"}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none rounded-lg border border-border bg-[#12121c] text-foreground",
            "px-3 pr-8 py-2 text-sm",
            "cursor-pointer transition-colors",
            "hover:border-accent/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
          )}
        >
          {MOODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
