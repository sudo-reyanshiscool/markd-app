import { Moon, Sun, Monitor, LogOut, Trash2, RefreshCw } from "lucide-react";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/lib/theme";
import { useStore } from "@/lib/store";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { spring } from "@/lib/motion";

const THEMES = [
  { value: "light" as const, label: "Light", icon: Sun },
  { value: "system" as const, label: "System", icon: Monitor },
  { value: "dark" as const, label: "Dark", icon: Moon },
];

export function Settings() {
  const { theme, setTheme } = useTheme();
  const data = useStore((s) => s.data);
  const setRevision = useStore((s) => s.setRevisionMode);
  const setMock = useStore((s) => s.setMockMode);
  const setOutlook = useStore((s) => s.setOutlookUrl);
  const reset = useStore((s) => s.reset);
  const email = useStore((s) => s.email);
  const setSession = useStore((s) => s.setSession);

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null, null);
  };

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Settings</p>
        <h1 className="display mt-1 text-[28px] tracking-[-0.02em] md:text-[36px]">Make it yours</h1>
      </header>

      <section>
        <SectionHeader title="Appearance" hint="Markd is calmest on the warm dark theme. Choose what works for you." />
        <Card>
          <div className="relative inline-flex rounded-[12px] bg-[var(--surface-2)] p-1 border border-[var(--line)]">
            {THEMES.map((t) => {
              const active = theme === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`relative z-10 inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active ? "text-[var(--ink)]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="theme-pill"
                      transition={spring.snappy}
                      className="absolute inset-0 rounded-[8px] bg-[var(--surface)] shadow-[var(--shadow-sm)] border border-[var(--line)]"
                    />
                  )}
                  <span className="relative inline-flex items-center gap-2">
                    <t.icon size={14} /> {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </section>

      <section>
        <SectionHeader title="Modes" hint="Switch how Markd behaves during exam season." />
        <div className="grid gap-3 md:grid-cols-2">
          <Card padded={false} className="flex items-start justify-between p-5">
            <div>
              <h3 className="font-medium">Revision mode</h3>
              <p className="mt-1 max-w-xs text-[13px] text-[var(--ink-3)]">
                Hides finished tasks and prioritises subjects with upcoming exams.
              </p>
            </div>
            <Switch checked={data.revisionMode} onChange={setRevision} />
          </Card>
          <Card padded={false} className="flex items-start justify-between p-5">
            <div>
              <h3 className="font-medium">Mock mode</h3>
              <p className="mt-1 max-w-xs text-[13px] text-[var(--ink-3)]">
                Treats mock exams as real ones — countdowns and pressure adjusted.
              </p>
            </div>
            <Switch checked={data.mockMode} onChange={setMock} />
          </Card>
        </div>
      </section>

      <section>
        <SectionHeader title="Calendar" hint="Paste an Outlook or .ics URL to sync deadlines passively." />
        <Card>
          <label className="block text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)] mb-1.5">
            iCal URL
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={data.outlookCalendarUrl}
              onChange={(e) => setOutlook(e.target.value)}
              placeholder="https://outlook.office365.com/.../calendar.ics"
              className="h-11 flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--surface-2)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)]"
            />
            <Button iconLeft={<RefreshCw size={14} />} disabled>
              Sync
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-[var(--ink-3)]">
            Sync runs on a backend endpoint — wire <code>/api/outlook</code> in production. The URL
            is saved with your account.
          </p>
        </Card>
      </section>

      <section>
        <SectionHeader title="Account" />
        <Card padded={false} className="flex items-center justify-between p-5">
          <div>
            <p className="font-medium text-[var(--ink)]">{email ?? "Guest"}</p>
            <p className="text-[12px] text-[var(--ink-3)]">
              {isSupabaseConfigured ? "Cloud synced" : "Local only — no Supabase keys set"}
            </p>
          </div>
          {isSupabaseConfigured && email && (
            <Button iconLeft={<LogOut size={14} />} onClick={signOut}>
              Sign out
            </Button>
          )}
        </Card>
      </section>

      <section>
        <SectionHeader title="Danger zone" />
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">Reset local data</h3>
              <p className="mt-1 text-[13px] text-[var(--ink-3)]">
                Clears subjects, tasks, exams and sessions in this browser. Cloud copy stays safe.
              </p>
            </div>
            <Button
              variant="danger"
              iconLeft={<Trash2 size={14} />}
              onClick={() => {
                if (confirm("Reset local data? Cloud copy is safe.")) reset();
              }}
            >
              Reset
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
        checked
          ? "bg-[var(--accent)] border-[var(--accent)]"
          : "bg-[var(--surface-2)] border-[var(--line-strong)]"
      }`}
    >
      <motion.span
        layout
        transition={spring.snappy}
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm ${
          checked ? "ml-6" : "ml-1"
        }`}
      />
    </button>
  );
}
