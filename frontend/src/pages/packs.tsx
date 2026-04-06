import { Navigate, Outlet, useParams } from "react-router-dom";
import { Panel } from "@/components/layout/panel";
import { Canvas } from "@/components/layout/canvas";
import { usePacks } from "@/hooks/api/use-packs";
import { PackCard } from "@/components/icons/pack-card";
import { CreatePackDialog } from "@/components/icons/create-pack-dialog";

export function PacksPage() {
  const { packId } = useParams();
  const { data: packs = [] } = usePacks();

  return (
    <>
      <Panel>
        <h2 className="text-sm font-semibold text-foreground mb-2">Packs</h2>
        <div className="flex flex-col">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </div>
        <div className="mt-3">
          <CreatePackDialog />
        </div>
      </Panel>
      <Canvas>
        {packId ? (
          <Outlet />
        ) : packs.length > 0 ? (
          <Navigate to={`/packs/${packs[0].id}`} replace />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <p className="text-muted-foreground text-sm">
              Create your first icon pack to get started.
            </p>
            <CreatePackDialog />
          </div>
        )}
      </Canvas>
    </>
  );
}
