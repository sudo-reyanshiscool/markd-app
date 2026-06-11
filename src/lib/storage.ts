import { Platform } from "react-native";

/**
 * Unified async key-value storage.
 *
 * Native: MMKV when the native module is available (dev/EAS builds),
 * falling back to AsyncStorage (Expo Go). Web: localStorage.
 * Everything is exposed async so callers never care which one they got.
 */
export interface KVStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function createWebStorage(): KVStorage {
  return {
    async getItem(key) {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    async setItem(key, value) {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // storage full / private mode — drop silently, app stays usable
      }
    },
    async removeItem(key) {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

function createNativeStorage(): KVStorage {
  try {
    // MMKV is a native module: present in dev/EAS builds, absent in Expo Go.
    const { MMKV } = require("react-native-mmkv") as typeof import("react-native-mmkv");
    const mmkv = new MMKV({ id: "markd" });
    return {
      async getItem(key) {
        return mmkv.getString(key) ?? null;
      },
      async setItem(key, value) {
        mmkv.set(key, value);
      },
      async removeItem(key) {
        mmkv.delete(key);
      },
    };
  } catch {
    const AsyncStorage =
      require("@react-native-async-storage/async-storage").default;
    return {
      getItem: (key) => AsyncStorage.getItem(key),
      setItem: (key, value) => AsyncStorage.setItem(key, value),
      removeItem: (key) => AsyncStorage.removeItem(key),
    };
  }
}

export const kv: KVStorage =
  Platform.OS === "web" ? createWebStorage() : createNativeStorage();

/** Adapter shape zustand's createJSONStorage expects. */
export const zustandStorage = {
  getItem: (name: string) => kv.getItem(name),
  setItem: (name: string, value: string) => kv.setItem(name, value),
  removeItem: (name: string) => kv.removeItem(name),
};

export async function readJSON<T>(key: string): Promise<T | null> {
  const raw = await kv.getItem(key);
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  await kv.setItem(key, JSON.stringify(value));
}
