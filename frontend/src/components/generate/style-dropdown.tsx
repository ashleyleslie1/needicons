import type { IconStyle } from "@/lib/types";
import { FancySelect } from "@/components/ui/fancy-select";
import { Square, PenTool, Palette, Layers, Sticker } from "lucide-react";

const STYLES = [
  { value: "solid", label: "Solid", desc: "Bold filled shapes", icon: <Square className="h-3.5 w-3.5" /> },
  { value: "outline", label: "Outline", desc: "Clean line strokes", icon: <PenTool className="h-3.5 w-3.5" /> },
  { value: "colorful", label: "Colorful", desc: "Rich detailed colors", icon: <Palette className="h-3.5 w-3.5" /> },
  { value: "flat", label: "Flat", desc: "Minimal flat design", icon: <Layers className="h-3.5 w-3.5" /> },
  { value: "sticker", label: "Sticker", desc: "Playful 3D look", icon: <Sticker className="h-3.5 w-3.5" /> },
];

interface StyleDropdownProps {
  value: IconStyle;
  onChange: (value: IconStyle) => void;
}

export function StyleDropdown({ value, onChange }: StyleDropdownProps) {
  return <FancySelect label="Style" options={STYLES} value={value} onChange={(v) => onChange(v as IconStyle)} />;
}
