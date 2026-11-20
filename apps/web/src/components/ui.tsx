import { Slot } from "@radix-ui/react-slot";
import { ChevronDown } from "lucide-react";
import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

/**
 * Shared UI primitives — Kanban main design (2026-11-20).
 * Flat white cards on the #E9EEF5 page, 18px radius, hairline
 * #E5E7EB borders, very soft shadow. Vivid purple #6C5CE7 is the
 * primary action colour (buttons, active nav, In Progress pill,
 * focus); near-black #111827 is text. Status colours carry meaning
 * only (done / in-progress / blocked / at-risk) and trends always
 * carry an explicit + / − sign.
 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-card border border-line bg-card shadow-[0_1px_2px_rgba(17,24,39,0.04)] ${className}`}
    >
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
  ACTIVE: "bg-done-light text-done-strong",
  DONE: "bg-done-light text-done-strong",
  NEW: "bg-done-light text-done-strong",
  IN_PROGRESS: "bg-accent-light text-accent",
  BLOCKED: "bg-risk-light text-risk",
  OVERLOADED: "bg-risk-light text-risk",
  AT_RISK: "bg-warn-light text-warn",
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

/**
 * Shared form controls — Kanban, premium Apple-like treatment. Every
 * text input, select and textarea in the app goes through these so
 * nothing looks like a raw system control: large 16px radius, warm-
 * white card with a whisper of inner depth, hairline border that
 * deepens on hover, purple accent focus border + a soft purple glow
 * ring (never the harsh native blue outline — the native outline is
 * killed in index.css), generous padding, smooth transitions on
 * hover/focus. No width in the base — the call site passes its own
 * width (w-full, w-64, …) via className. forwardRef so
 * react-hook-form's register() (which spreads a ref) keeps working.
 */
const controlBase =
  "rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink shadow-[inset_0_1px_2px_rgba(17,24,39,0.05)] outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted hover:border-[#d1d5db] focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} {...props} className={`${controlBase} ${className}`} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = "", ...props }, ref) {
    return <textarea ref={ref} {...props} className={`${controlBase} ${className}`} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = "", children, ...props }, ref) {
    return (
      <span className={`relative block ${className}`}>
        <select
          ref={ref}
          {...props}
          className={`${controlBase} w-full cursor-pointer appearance-none pr-9`}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        />
      </span>
    );
  },
);

/** Label + control + optional hint/error. Renders a real <label> so
 *  clicking the label focuses the control inside it. */
export function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      {label ? <span className="font-medium text-ink">{label}</span> : null}
      <span className="mt-1.5 block">{children}</span>
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
      {error ? <span className="mt-1.5 block text-sm text-risk">{error}</span> : null}
    </label>
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
    "inline-flex items-center justify-center rounded-[10px] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const style =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent/90"
      : "border border-line bg-card text-ink hover:bg-page";
  const Comp = asChild ? Slot : "button";
  return (
    <Comp type={asChild ? undefined : "button"} onClick={onClick} className={`${base} ${style}`}>
      {children}
    </Comp>
  );
}
