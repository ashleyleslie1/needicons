import { createContext, useContext, useState, createElement } from "react";
import type { ReactNode } from "react";

type RightPanel = "generation" | "profile" | null;

interface SidebarContextValue {
  panelCollapsed: boolean;
  togglePanel: () => void;
  rightPanel: RightPanel;
  setRightPanel: (panel: RightPanel) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>(null);

  const togglePanel = () => setPanelCollapsed((prev) => !prev);

  return createElement(
    SidebarContext.Provider,
    { value: { panelCollapsed, togglePanel, rightPanel, setRightPanel } },
    children
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
