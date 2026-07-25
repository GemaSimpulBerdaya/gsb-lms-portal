import { useSyncExternalStore } from "react";

/**
 * Hydration-safe client mount signal for SSR guards.
 * 
 * @returns {boolean} mounted - true after component mounts, false during SSR
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
