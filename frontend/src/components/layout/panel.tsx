import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebar } from "@/hooks/ui/use-sidebar";
import { cn } from "@/lib/utils";

interface PanelProps {
  children?: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  const { panelCollapsed } = useSidebar();

  return (
    <div
      className={cn(
        "h-screen border-r border-border bg-surface transition-all duration-200 shrink-0",
        panelCollapsed ? "w-0 overflow-hidden" : "w-64",
        className
      )}
    >
      <ScrollArea className="h-full">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </div>
  );
}
