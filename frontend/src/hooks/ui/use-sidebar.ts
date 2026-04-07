import { createContext, useContext, useState, useEffect, createElement } from "react";
import type { ReactNode } from "react";

interface SidebarContextValue {
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    return localStorage.getItem("needicons_active_project") || null;
  });

  useEffect(() => {
    if (activeProjectId) {
      localStorage.setItem("needicons_active_project", activeProjectId);
    } else {
      localStorage.removeItem("needicons_active_project");
    }
  }, [activeProjectId]);

  return createElement(
    SidebarContext.Provider,
    { value: { activeProjectId, setActiveProjectId } },
    children,
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
