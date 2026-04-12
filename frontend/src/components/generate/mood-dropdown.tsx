import { FancySelect } from "@/components/ui/fancy-select";
import { Minus, Clapperboard, Flame, Zap, Gem, Circle } from "lucide-react";

const MOODS = [
  { value: "none", label: "None", desc: "Default style", icon: <Minus className="h-3.5 w-3.5" /> },
  { value: "cinematic", label: "Cinematic", desc: "Dramatic depth", icon: <Clapperboard className="h-3.5 w-3.5" /> },
  { value: "vibrant", label: "Vibrant", desc: "Bold colors", icon: <Flame className="h-3.5 w-3.5" /> },
  { value: "dynamic", label: "Dynamic", desc: "Motion & energy", icon: <Zap className="h-3.5 w-3.5" /> },
  { value: "elegant", label: "Elegant", desc: "Refined look", icon: <Gem className="h-3.5 w-3.5" /> },
  { value: "minimal", label: "Minimal", desc: "Stripped back", icon: <Circle className="h-3.5 w-3.5" /> },
];

interface MoodDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function MoodDropdown({ value, onChange }: MoodDropdownProps) {
  return <FancySelect label="Mood" options={MOODS} value={value} onChange={onChange} />;
}
