import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface FancyOption {
  value: string;
  label: string;
  desc?: string;
  icon?: React.ReactNode;
}

interface FancySelectProps {
  label: string;
  options: FancyOption[];
  value: string;
  onChange: (value: string) => void;
}

export function FancySelect({ label, options, value, onChange }: FancySelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="flex items-center justify-between" ref={ref}>
      <span className="text-[13px] text-foreground">{label}</span>
      <div className="relative">
        {/* Trigger */}
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 w-[170px] text-left transition-all shadow-sm",
            open ? "border-accent ring-2 ring-accent/15" : "border-border hover:border-accent/30 hover:shadow-md",
          )}
        >
          {current?.icon && <span className="text-muted-foreground shrink-0">{current.icon}</span>}
          <div className="flex-1 min-w-0">
            <span className="text-[13px] text-foreground block leading-tight truncate">{current?.label}</span>
            {current?.desc && <span className="text-[9px] text-muted-foreground block truncate">{current.desc}</span>}
          </div>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground shrink-0">
            <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-1 w-[210px] rounded-xl border border-border bg-card shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
                  opt.value === value
                    ? "bg-accent/8 text-accent"
                    : "text-foreground hover:bg-muted",
                )}
              >
                {opt.icon && <span className={cn("shrink-0", opt.value === value ? "text-accent" : "text-muted-foreground")}>{opt.icon}</span>}
                <div className="flex-1 min-w-0">
                  <span className={cn("text-[13px] block leading-tight", opt.value === value && "font-medium")}>{opt.label}</span>
                  {opt.desc && <span className="text-[10px] text-muted-foreground block">{opt.desc}</span>}
                </div>
                {opt.value === value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent shrink-0">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
