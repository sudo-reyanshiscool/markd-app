import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Compass,
  GraduationCap,
  LineChart,
  Settings,
  Sparkles,
  Timer,
  Trophy,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import { useStore } from "@/lib/store";
import { fadeUp, spring } from "@/lib/motion";

const NAV = [
  { to: "/today", label: "Today", icon: Compass },
  { to: "/subjects", label: "Subjects", icon: GraduationCap },
  { to: "/tasks", label: "Tasks", icon: CheckCircle2 },
  { to: "/exams", label: "Exams", icon: Calendar },
  { to: "/timer", label: "Timer", icon: Timer },
  { to: "/goals", label: "Goals", icon: LineChart },
  { to: "/portfolio", label: "Portfolio", icon: Trophy },
  { to: "/papers", label: "Papers", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const cloudPending = useStore((s) => s.cloudPending);
  const email = useStore((s) => s.email);

  return (
    <div className="grid min-h-screen grid-cols-[260px_1fr] bg-[var(--bg)] text-[var(--ink)]">
      <aside className="sticky top-0 flex h-screen flex-col border-r border-[var(--line)] bg-[var(--surface)] px-4 py-6">
        <div className="px-2 pb-6">
          <p className="display text-[26px] tracking-tight text-[var(--ink)]">Markd<span className="text-[var(--accent)]">.</span></p>
          <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
            Quiet focus
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors",
                  isActive
                    ? "text-[var(--ink)]"
                    : "text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-[10px] bg-[var(--surface-2)] border border-[var(--line)]"
                    />
                  )}
                  <span className="relative grid place-items-center">
                    <n.icon size={16} strokeWidth={1.8} />
                  </span>
                  <span className="relative">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <footer className="mt-4 border-t border-[var(--line)] pt-4">
          <div className="flex items-center justify-between gap-2 px-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] text-[var(--ink-3)]">
                {email ?? "Guest mode"}
              </p>
              <p className="truncate text-[11px] uppercase tracking-[0.12em] text-[var(--ink-4)]">
                {cloudPending ? "Syncing…" : "Up to date"}
              </p>
            </div>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                cloudPending ? "bg-[var(--warmth)] animate-pulse" : "bg-[var(--success)]",
              )}
            />
          </div>
        </footer>
      </aside>

      <main className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={fadeUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="mx-auto max-w-[960px] px-10 py-12"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
