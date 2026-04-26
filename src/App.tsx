import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AuthScreen } from "@/screens/Auth";
import { Today } from "@/screens/Today";
import { Subjects } from "@/screens/Subjects";
import { Tasks } from "@/screens/Tasks";
import { Exams } from "@/screens/Exams";
import { Timer } from "@/screens/Timer";
import { Goals } from "@/screens/Goals";
import { Portfolio } from "@/screens/Portfolio";
import { Papers } from "@/screens/Papers";
import { Settings } from "@/screens/Settings";
import { useStore } from "@/lib/store";
import { LoadingState } from "@/components/ui/States";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function App() {
  const status = useStore((s) => s.status);
  const userId = useStore((s) => s.userId);
  const boot = useStore((s) => s.bootFromSupabase);
  const setSession = useStore((s) => s.setSession);
  const hydrate = useStore((s) => s.hydrateFromCloud);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setSession(user?.id ?? null, user?.email ?? null);
      if (user) void hydrate();
    });
    return () => sub.subscription.unsubscribe();
  }, [setSession, hydrate]);

  if (status === "loading" && !userId) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)]">
        <LoadingState label="Booting Markd" />
      </div>
    );
  }

  const guestMode = useStore((s) => s.guestMode);
  if (!userId && isSupabaseConfigured && !guestMode) {
    return (
      <Routes>
        <Route path="*" element={<AuthScreen />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<Today />} />
        <Route path="/subjects" element={<Subjects />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/exams" element={<Exams />} />
        <Route path="/timer" element={<Timer />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/papers" element={<Papers />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/today" replace />} />
      </Routes>
    </AppShell>
  );
}
