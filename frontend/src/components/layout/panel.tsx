import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface PanelProps {
  children?: ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div
      className={cn(
        "h-screen border-r border-border bg-surface shrink-0 w-64",
        className
      )}
    >
      <ScrollArea className="h-full">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </div>
  );
}
