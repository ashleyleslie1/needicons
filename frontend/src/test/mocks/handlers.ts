import { http, HttpResponse } from "msw";
import type { SettingsResponse, GpuResponse } from "@/lib/types";

const mockSettings: SettingsResponse = {
  edition: "oss",
  provider: {
    api_key: "sk-••••kF3w",
    default_model: "gpt-4o",
    api_key_set: true,
  },
};

const mockGpu: GpuResponse = {
  active_provider: "cpu",
  available_providers: [{ id: "cpu", name: "CPU", available: true }],
  detail: "CPU only",
  preference: "auto",
};

export const handlers = [
  http.get("/api/settings", () => {
    return HttpResponse.json(mockSettings);
  }),

  http.get("/api/settings/gpu", () => {
    return HttpResponse.json(mockGpu);
  }),

  http.get("/api/profiles", () => {
    return HttpResponse.json([]);
  }),
];
