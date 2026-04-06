import { api, ApiError } from "./api-client";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";

test("listPacks returns packs array", async () => {
  const packs = await api.listPacks();
  expect(packs).toHaveLength(1);
  expect(packs[0].name).toBe("Test Pack");
});

test("createPack sends POST and returns pack", async () => {
  const pack = await api.createPack({ name: "New Pack" });
  expect(pack.name).toBe("New Pack");
});

test("deletePack sends DELETE", async () => {
  const result = await api.deletePack("abc123def456");
  expect(result.status).toBe("deleted");
});

test("getSettings returns settings with masked key", async () => {
  const settings = await api.getSettings();
  expect(settings.provider.api_key_set).toBe(true);
  expect(settings.provider.default_model).toBe("gpt-4o");
});

test("throws ApiError on non-ok response", async () => {
  server.use(
    http.get("/api/packs", () =>
      HttpResponse.json({ detail: "Not found" }, { status: 404 }),
    ),
  );
  await expect(api.listPacks()).rejects.toThrow(ApiError);
});
