import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** false khi render trên server/hydrate, true sau khi chạy trên trình duyệt. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

