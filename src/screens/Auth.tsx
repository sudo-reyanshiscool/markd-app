import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/States";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { spring } from "@/lib/motion";

type Mode = "signin" | "signup";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const setSession = useStore((s) => s.setSession);
  const setGuestMode = useStore((s) => s.setGuestMode);
  const hydrate = useStore((s) => s.hydrateFromCloud);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!isSupabaseConfigured || !supabase) {
      setErr("Cloud accounts aren't configured. Use Guest mode to try Markd locally.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        if (data.user) {
          setSession(data.user.id, data.user.email ?? null);
          await hydrate();
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          setSession(data.user.id, data.user.email ?? null);
          await hydrate();
        }
      }
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const guest = () => {
    setSession(null, null);
    setGuestMode(true);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr] bg-[var(--bg)] text-[var(--ink)]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring.soft}
        className="flex flex-col justify-between gap-10 p-6 sm:p-10 lg:gap-0 lg:p-16"
      >
        <p className="display text-[28px] text-[var(--ink)]">
          Markd<span className="text-[var(--accent)]">.</span>
        </p>

        <div className="max-w-md">
          <h1 className="display text-[34px] leading-[1.06] tracking-tight sm:text-[44px] sm:leading-[1.04]">
            A calmer way to land your exams.
          </h1>
          <p className="mt-5 text-[16px] leading-relaxed text-[var(--ink-2)]">
            Markd lines up your subjects, deadlines and exams into one clear next move — so
            revision feels less like guesswork and more like a habit.
          </p>

          <ul className="mt-8 space-y-2.5 text-[14px] text-[var(--ink-2)]">
            {[
              "Daily planner that actually picks for you",
              "Live exam countdowns and subject health",
              "Pomodoro timer with quiet XP",
              "Works offline, syncs in the background",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <span className="mt-[7px] h-1 w-1 rounded-full bg-[var(--accent)]" />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-4)]">
          Made for GCSE · A-Level · IB
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring.soft, delay: 0.05 }}
        className="flex items-center justify-center border-t border-[var(--line)] bg-[var(--surface)] p-6 sm:p-10 lg:border-l lg:border-t-0 lg:p-16"
      >
        <form onSubmit={handle} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="display text-[28px]">
              {mode === "signup" ? "Make your space" : "Welcome back"}
            </h2>
            <p className="mt-1 text-[13px] text-[var(--ink-3)]">
              {mode === "signup"
                ? "A free Markd account keeps your work in sync."
                : "Sign in to pick up where you left off."}
            </p>
          </div>

          {mode === "signup" && (
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              autoComplete="name"
            />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@school.org"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            required
          />

          {err && <ErrorState message={err} />}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy || !email || !password}
          >
            {busy ? "Just a moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>

          <div className="flex items-center justify-between text-[13px] text-[var(--ink-3)]">
            <button
              type="button"
              className="hover:text-[var(--ink)] transition-colors"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            >
              {mode === "signup" ? "I already have an account" : "Create an account"}
            </button>
            <button
              type="button"
              className="hover:text-[var(--ink)] transition-colors"
              onClick={guest}
            >
              Continue as guest →
            </button>
          </div>

          {!isSupabaseConfigured && (
            <p className="rounded-[10px] border border-dashed border-[var(--line-strong)] bg-[var(--surface-2)] p-3 text-[12px] text-[var(--ink-3)]">
              No Supabase keys set. Markd will run locally — your data stays in this browser
              until you connect a project.
            </p>
          )}
        </form>
      </motion.section>
    </div>
  );
}
