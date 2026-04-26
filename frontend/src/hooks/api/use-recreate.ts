import { useCallback, useSyncExternalStore } from "react";
import { recreatePool, type RecreateState } from "@/lib/recreate-pool";

export interface UseRecreateResult {
  isPending: boolean;
  partial: string | null;
  start: () => void;
}

/**
 * Subscribe to the recreate-pool state for a single record. Re-renders the
 * caller whenever this record's recreate state changes (start, partial, end).
 */
export function useRecreate(recordId: string): UseRecreateResult {
  const subscribe = useCallback((listener: () => void) => recreatePool.subscribe(listener), []);
  const getSnapshot = useCallback((): RecreateState | null => recreatePool.getState(recordId), [recordId]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    isPending: state !== null,
    partial: state?.partial ?? null,
    start: useCallback(() => recreatePool.start(recordId), [recordId]),
  };
}
