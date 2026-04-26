import type { QueryClient } from "@tanstack/react-query";
import { api } from "./api-client";
import type { GenerationRecord } from "./types";

/**
 * Module-level pool that owns in-flight "Recreate" (add-variation) requests.
 *
 * The fetch lives outside any React component lifecycle so closing the image
 * editor modal — or navigating away from the Generate page — does not cancel
 * a generation that's already been billed for. Components subscribe to the
 * pool to render loading placeholders and partial-frame previews.
 */
export interface RecreateState {
  partial: string | null;
  startedAt: number;
}

type Listener = () => void;

let queryClient: QueryClient | null = null;
const states = new Map<string, RecreateState>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export const recreatePool = {
  setQueryClient(qc: QueryClient) {
    queryClient = qc;
  },

  start(recordId: string) {
    if (states.has(recordId)) return; // already in flight, ignore double-clicks
    states.set(recordId, { partial: null, startedAt: Date.now() });
    notify();

    api
      .addVariation(recordId, (b64) => {
        const cur = states.get(recordId);
        if (!cur) return;
        states.set(recordId, { ...cur, partial: `data:image/png;base64,${b64}` });
        notify();
      })
      .then(({ record }) => {
        if (queryClient) {
          queryClient.setQueriesData<GenerationRecord[]>(
            { queryKey: ["generation-history"] },
            (old) => old?.map((r) => (r.id === record.id ? record : r)),
          );
          queryClient.invalidateQueries({ queryKey: ["generation-history"] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
        }
      })
      .catch(() => {
        // Failures already surface via the queue UI / SSE error events;
        // swallow here so the finally cleanup still runs.
      })
      .finally(() => {
        states.delete(recordId);
        notify();
      });
  },

  getState(recordId: string): RecreateState | null {
    return states.get(recordId) ?? null;
  },

  isPending(recordId: string): boolean {
    return states.has(recordId);
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
