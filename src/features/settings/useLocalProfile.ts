import { useQuery } from "@tanstack/react-query";

import { localBackend } from "@/lib/backend";
import { useSessionStore } from "@/stores/session";

/** Guest-mode profile (name etc.) stored on-device. */
export function useLocalProfile() {
  const mode = useSessionStore((s) => s.mode);
  return useQuery({
    queryKey: ["guest", "local-profile"],
    queryFn: () => localBackend.getProfile(),
    enabled: mode === "guest",
  });
}

export function useLocalProfileName(): string | null {
  const q = useLocalProfile();
  return q.data?.name ?? null;
}
