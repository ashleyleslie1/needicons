import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePacks, useCreatePack } from "./use-packs";
import type { ReactNode } from "react";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

test("usePacks returns packs from API", async () => {
  const { result } = renderHook(() => usePacks(), { wrapper: createWrapper() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(1);
  expect(result.current.data![0].name).toBe("Test Pack");
});

test("useCreatePack mutates and returns new pack", async () => {
  const { result } = renderHook(() => useCreatePack(), { wrapper: createWrapper() });
  result.current.mutate({ name: "New Pack" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.name).toBe("New Pack");
});
