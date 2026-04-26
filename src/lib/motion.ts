import type { Transition, Variants } from "framer-motion";

export const spring = {
  soft: { type: "spring", stiffness: 320, damping: 32, mass: 0.9 } satisfies Transition,
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.8 } satisfies Transition,
  hover: { type: "spring", stiffness: 700, damping: 30, mass: 0.6 } satisfies Transition,
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: spring.soft },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

export const stagger: Variants = {
  animate: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

export const pop: Variants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1, transition: spring.snappy },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.12 } },
};
