import { Outlet } from "react-router-dom";
import { Panel } from "@/components/layout/panel";
import { Canvas } from "@/components/layout/canvas";

export function PacksPage() {
  return (
    <>
      <Panel>
        <h2 className="text-sm font-semibold text-foreground mb-2">Packs</h2>
        <p className="text-xs text-muted-foreground">Loading...</p>
      </Panel>
      <Canvas>
        <Outlet />
      </Canvas>
    </>
  );
}
