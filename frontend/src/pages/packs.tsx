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
        <h2 className="text-base font-semibold text-foreground mb-4">Packs</h2>
        <div className="flex flex-col gap-2">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </div>
        <div className="mt-4">
          <CreatePackDialog />
        </div>
      </Panel>
      <Canvas>
        {packId ? (
          <Outlet />
        ) : packs.length > 0 ? (
          <Navigate to={`/packs/${packs[0].id}`} replace />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-3xl">
                📦
              </div>
              <h2 className="text-xl font-semibold">Create your first pack</h2>
              <p className="text-muted-foreground max-w-sm">
                An icon pack is a collection of icons that share a style. Create one and start adding icons.
              </p>
            </div>
            <CreatePackDialog />
          </div>
        )}
      </Canvas>
    </>
  );
}
