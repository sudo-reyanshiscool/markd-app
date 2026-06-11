import { onlineManager, QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";

import { kv } from "@/lib/storage";

/**
 * Offline-first server-state cache (spec §7.21):
 * - queries persist to storage and rehydrate on launch
 * - mutations run optimistically and pause while offline
 * - onlineManager is fed by NetInfo on native (web uses browser events)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: 2,
      networkMode: "offlineFirst",
    },
    mutations: {
      networkMode: "offlineFirst",
      retry: 2,
    },
  },
});

if (Platform.OS !== "web") {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    }),
  );
}

export const queryPersister = createAsyncStoragePersister({
  storage: kv,
  key: "markd.query-cache",
  throttleTime: 1500,
});

/** Bust the persisted cache when the shape of cached data changes. */
export const QUERY_CACHE_BUSTER = "markd-v1";
