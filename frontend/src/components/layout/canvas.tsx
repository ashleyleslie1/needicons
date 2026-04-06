import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface CanvasProps {
  children?: ReactNode;
  className?: string;
}

export function Canvas({ children, className }: CanvasProps) {
  return (
    <main className={cn("flex flex-1 flex-col overflow-hidden", className)}>
      <ScrollArea className="h-screen flex-1">
        <div className="p-6">{children}</div>
      </ScrollArea>
    </main>
  );
}
