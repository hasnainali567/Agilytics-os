import { Slot } from "@radix-ui/react-slot";
import type { ReactNode } from "react";

/**
 * Shared UI primitives — Agibankz (decision 19).
 * Flat white cards on the warm canvas, 22px radius, hairline borders,
 * no shadows. Deep forest green is the primary action colour ONLY.
 * Status colours carry meaning only (done / in-progress / blocked /
 * at-risk) and trends always carry an explicit + / − sign.
 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-card border border-line bg-panel ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-line px-5 py-4">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  ACTIVE: "bg-done/10 text-done",
  DONE: "bg-done/10 text-done",
  IN_PROGRESS: "bg-lime text-forest",
  BLOCKED: "bg-risk/10 text-risk",
  OVERLOADED: "bg-risk/10 text-risk",
  AT_RISK: "bg-warn/10 text-warn",
  TODO: "bg-pill text-muted",
  INACTIVE: "bg-pill text-muted",
};

export function StatusPill({ status }: { status: string }) {
  const style = badgeStyles[status] ?? "bg-pill text-muted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  asChild = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  asChild?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";
  const style =
    variant === "primary"
      ? "bg-forest text-white hover:bg-forest/90"
      : "border border-line bg-panel text-ink hover:bg-canvas";
  const Comp = asChild ? Slot : "button";
  return (
    <Comp type={asChild ? undefined : "button"} onClick={onClick} className={`${base} ${style}`}>
      {children}
    </Comp>
  );
}
