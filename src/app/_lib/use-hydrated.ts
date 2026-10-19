import { useSyncExternalStore } from "react";

// False on the server and during hydration, true once React has attached its handlers in the browser.
// (useSyncExternalStore re-renders with the client value right after hydration, with no mismatch warning.)

const noSubscription = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}
