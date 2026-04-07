import { api, ApiError } from "./api-client";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";

test("getSettings returns settings with masked key", async () => {
  const settings = await api.getSettings();
  expect(settings.provider.api_key_set).toBe(true);
  expect(settings.provider.default_model).toBe("gpt-4o");
});

test("throws ApiError on non-ok response", async () => {
  server.use(
    http.get("/api/settings", () =>
      HttpResponse.json({ detail: "Not found" }, { status: 404 }),
    ),
  );
  await expect(api.getSettings()).rejects.toThrow(ApiError);
});
