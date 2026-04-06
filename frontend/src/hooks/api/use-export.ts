import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ExportRequest } from "@/lib/types";

export function useExportPack() {
  return useMutation({
    mutationFn: ({ packId, data }: { packId: string; data: ExportRequest }) =>
      api.exportPack(packId, data),
  });
}
