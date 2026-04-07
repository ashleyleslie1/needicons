import { useSettings } from "@/hooks/api/use-settings";
import type { Edition } from "@/lib/types";

interface EditionFlags {
  edition: Edition;
  isOss: boolean;
  isCommercial: boolean;
  showAllModels: boolean;
  showDalle3Warning: boolean;
  showGpuSettings: boolean;
  showRunPodSettings: boolean;
  showAllQualityOptions: boolean;
}

export function useEdition(): EditionFlags {
  const { data: settings } = useSettings();
  const edition: Edition = settings?.edition ?? "oss";
  const isOss = edition === "oss";

  return {
    edition,
    isOss,
    isCommercial: !isOss,
    showAllModels: isOss,
    showDalle3Warning: isOss,
    showGpuSettings: isOss,
    showRunPodSettings: isOss,
    showAllQualityOptions: isOss,
  };
}
