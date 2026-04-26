import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { spring } from "@/lib/motion";
import { X } from "lucide-react";
import { IconButton } from "./Button";

export function Sheet({
  open,
  onClose,
  title,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(20,19,15,0.45)] backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            role="dialog"
            aria-modal
            aria-label={title}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={spring.snappy}
            style={{ width }}
            className="relative ml-auto flex h-full max-w-full flex-col bg-[var(--bg)] shadow-[var(--shadow-lg)] border-l border-[var(--line)]"
          >
            <header className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
              <h2 className="display text-[18px]">{title}</h2>
              <IconButton onClick={onClose} aria-label="Close">
                <X size={18} />
              </IconButton>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
