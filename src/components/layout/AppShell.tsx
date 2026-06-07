import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CheckCircle2,
  Compass,
  GraduationCap,
  LineChart,
  Menu,
  Settings,
  Sparkles,
  Timer,
  Trophy,
  X,
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

function Wordmark() {
  return (
    <div>
      <p className="display text-[26px] tracking-tight text-[var(--ink)]">
        Markd<span className="text-[var(--accent)]">.</span>
      </p>
      <p className="mt-1 text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
        Quiet focus
      </p>
    </div>
  );
}

/** Shared nav list. `layoutGroup` keeps the sliding indicator unique per surface
 *  so the sidebar and the mobile drawer don't fight over one `layoutId`. */
function NavItems({ layoutGroup }: { layoutGroup: string }) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] font-medium transition-colors",
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
                  layoutId={`${layoutGroup}-nav-active`}
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
  );
}

function AccountFooter() {
  const cloudPending = useStore((s) => s.cloudPending);
  const email = useStore((s) => s.email);
  return (
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
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll + Escape-to-close while the drawer is open.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] md:grid md:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--line)] bg-[var(--surface)] px-4 py-6 md:flex">
        <div className="px-2 pb-6">
          <Wordmark />
        </div>
        <NavItems layoutGroup="sidebar" />
        <AccountFooter />
      </aside>

      {/* Mobile top bar */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 backdrop-blur-md md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex h-14 items-center">
          <p className="display text-[22px] tracking-tight text-[var(--ink)]">
            Markd<span className="text-[var(--accent)]">.</span>
          </p>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          className="grid h-10 w-10 place-items-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          <Menu size={20} strokeWidth={1.8} />
        </button>
      </header>

      {/* Mobile slide-out drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <motion.div
              onClick={() => setMenuOpen(false)}
              className="absolute inset-0 bg-[rgba(20,19,15,0.45)] backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              role="dialog"
              aria-modal
              aria-label="Navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={spring.snappy}
              className="relative flex h-full w-[78%] max-w-[300px] flex-col border-r border-[var(--line)] bg-[var(--surface)] px-4 py-6 shadow-[var(--shadow-lg)]"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 1.5rem)" }}
            >
              <div className="flex items-start justify-between px-2 pb-6">
                <Wordmark />
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="grid h-9 w-9 place-items-center rounded-full text-[var(--ink-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                >
                  <X size={18} />
                </button>
              </div>
              <NavItems layoutGroup="drawer" />
              <AccountFooter />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={fadeUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="mx-auto max-w-[960px] px-5 py-8 md:px-10 md:py-12"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
