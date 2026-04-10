import { Minus, Clapperboard, Flame, Zap, Gem, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const MOODS: {
  value: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "none", label: "None", Icon: Minus },
  { value: "cinematic", label: "Cinema", Icon: Clapperboard },
  { value: "vibrant", label: "Vibrant", Icon: Flame },
  { value: "dynamic", label: "Dynamic", Icon: Zap },
  { value: "elegant", label: "Elegant", Icon: Gem },
  { value: "minimal", label: "Minimal", Icon: Circle },
];

interface MoodDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function MoodDropdown({ value, onChange }: MoodDropdownProps) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 block font-medium">
        Mood
      </label>
      <div className="grid grid-cols-6 gap-1">
        {MOODS.map((m) => (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            title={m.label}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg py-2 px-1 transition-all text-center",
              value === m.value
                ? "bg-accent/15 ring-1 ring-accent/30 text-accent"
                : "bg-input hover:bg-card/80 text-muted-foreground hover:text-foreground",
            )}
          >
            <m.Icon className="h-3.5 w-3.5" />
            <span className="text-[8px] font-medium leading-none">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
