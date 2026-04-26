import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PAPER_LINKS } from "@/data/curricula";
import { fadeUp, stagger } from "@/lib/motion";

export function Papers() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Past papers</p>
        <h1 className="display mt-1 text-[36px] tracking-[-0.02em]">Where to look</h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--ink-3)]">
          Direct links to the boards and trusted revision sites. Markd doesn't host papers — we
          point you to the official source.
        </p>
      </header>

      <motion.ul
        variants={stagger}
        initial="initial"
        animate="animate"
        className="grid gap-3 md:grid-cols-2"
      >
        {PAPER_LINKS.map((link) => (
          <motion.li variants={fadeUp} key={link.url}>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="block focus:outline-none"
            >
              <Card interactive padded={false} className="group p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-[16px] text-[var(--ink)]">{link.name}</h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-3)]">
                      {link.desc}
                    </p>
                  </div>
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-3)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors">
                    <ExternalLink size={14} />
                  </span>
                </div>
              </Card>
            </a>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
