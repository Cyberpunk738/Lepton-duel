import type { ReactNode } from "react";

const DELAY_CLASS = ["", "rise-delay-1", "rise-delay-2", "rise-delay-3", "rise-delay-4"] as const;

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const step = Math.min(Math.max(Math.round(delay), 0), DELAY_CLASS.length - 1);
  return (
    <div className={`animate-rise ${DELAY_CLASS[step]} ${className ?? ""}`}>
      {children}
    </div>
  );
}
