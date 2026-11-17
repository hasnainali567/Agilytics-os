import { Slot } from "@radix-ui/react-slot";
import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-panel shadow-sm ${className}`}>
      {children}
    </div>
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
  ACTIVE: "bg-green-100 text-green-800",
  OVERLOADED: "bg-red-100 text-red-800",
  AT_RISK: "bg-amber-100 text-amber-800",
  INACTIVE: "bg-gray-100 text-gray-600",
  DONE: "bg-green-100 text-green-800",
  TODO: "bg-gray-100 text-gray-700",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  BLOCKED: "bg-red-100 text-red-800",
};

export function StatusPill({ status }: { status: string }) {
  const style = badgeStyles[status] ?? "bg-gray-100 text-gray-700";
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
    "inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors";
  const style =
    variant === "primary"
      ? "bg-primary-600 text-white hover:bg-primary-500"
      : "border border-line bg-panel text-ink hover:bg-canvas";
  const Comp = asChild ? Slot : "button";
  return (
    <Comp type={asChild ? undefined : "button"} onClick={onClick} className={`${base} ${style}`}>
      {children}
    </Comp>
  );
}
