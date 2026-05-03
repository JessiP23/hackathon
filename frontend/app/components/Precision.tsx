"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type PillVariant = "primary" | "ghost" | "success" | "danger";

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: PillVariant;
  children: ReactNode;
};

const pillBase =
  "w-full cursor-pointer rounded-[12px] px-0 py-[15px] text-[15px] font-semibold tracking-[-0.01em] transition-[opacity,transform] duration-150 active:scale-[0.98] active:opacity-[0.82] disabled:cursor-not-allowed disabled:opacity-50 font-[family-name:var(--is-font)]";

export function PillButton({ variant = "primary", className = "", children, ...props }: PillButtonProps) {
  const styles: Record<PillVariant, string> = {
    primary: "border-none bg-[var(--is-purple)] text-white",
    ghost: "border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-card)] text-[var(--is-text-2)]",
    success: "border-none bg-[var(--is-green)] text-[#022010]",
    danger: "border-none bg-[var(--is-red)] text-white",
  };

  return (
    <button type="button" className={`${pillBase} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PillLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: PillVariant;
  className?: string;
  children: ReactNode;
}) {
  const styles: Record<PillVariant, string> = {
    primary: "border-none bg-[var(--is-purple)] text-white",
    ghost: "border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-card)] text-[var(--is-text-2)]",
    success: "border-none bg-[var(--is-green)] text-[#022010]",
    danger: "border-none bg-[var(--is-red)] text-white",
  };
  return (
    <Link
      href={href}
      className={`flex min-h-[48px] w-full items-center justify-center rounded-[12px] px-0 py-[15px] text-center text-[15px] font-semibold tracking-[-0.01em] transition-[opacity,transform] duration-150 active:scale-[0.98] active:opacity-[0.82] ${styles[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export type StatusKind = "ready" | "pending" | "flash" | "confirmed" | "picked_up";

const statusStyles: Record<
  StatusKind,
  { bg: string; color: string; border: string }
> = {
  ready: {
    bg: "var(--is-green-tint)",
    color: "var(--is-green)",
    border: "var(--is-green-border)",
  },
  pending: {
    bg: "rgba(255,214,10,0.1)",
    color: "var(--is-amber)",
    border: "rgba(255,214,10,0.2)",
  },
  flash: {
    bg: "var(--is-red-tint)",
    color: "var(--is-red)",
    border: "rgba(255,59,48,0.25)",
  },
  confirmed: {
    bg: "var(--is-purple-tint)",
    color: "#8b85ff",
    border: "var(--is-purple-border)",
  },
  picked_up: {
    bg: "rgba(255,255,255,0.04)",
    color: "var(--is-text-4)",
    border: "var(--is-border-2)",
  },
};

export function StatusPill({ kind, children, className = "" }: { kind: StatusKind; children: ReactNode; className?: string }) {
  const s = statusStyles[kind];
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-[20px] px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${className}`}
      style={{ background: s.bg, color: s.color, border: `0.5px solid ${s.border}` }}
    >
      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

export function DataCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[16px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] p-4 ${className}`}
    >
      {children}
    </div>
  );
}

export function AccentCard({
  children,
  urgency,
  className = "",
}: {
  children: ReactNode;
  urgency?: boolean;
  className?: string;
}) {
  const left = urgency ? "var(--is-red)" : "var(--is-green)";
  return (
    <div
      className={`rounded-r-[12px] border-y border-r border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-card-raised)] py-3 pl-[14px] pr-[14px] ${className}`}
      style={{ borderLeft: `2px solid ${left}`, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--is-text-4)]">{children}</p>
  );
}

export function DividerLine() {
  return <div className="my-3 h-[0.5px] bg-[var(--is-border-1)]" role="separator" />;
}

export function MetricCard({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--is-border-2)] bg-[var(--is-card-raised)] px-[14px] py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--is-text-4)]">{label}</p>
      <p
        className={`mt-1 text-[20px] font-bold leading-none tracking-[-0.03em] text-[var(--is-text-1)] [font-variant-numeric:tabular-nums] ${valueClassName}`}
      >
        {value}
      </p>
    </div>
  );
}

export function CheckoutField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-[10px] border-[0.5px] border-[var(--is-border-1)] bg-[var(--is-surface)] px-[14px] pb-2 pt-[14px] focus-within:border-[var(--is-purple)]">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--is-text-4)]">{label}</p>
      <p
        className={`text-[14px] text-[var(--is-text-1)] [letter-spacing:0.04em] [font-variant-numeric:tabular-nums] ${mono ? "font-[family-name:var(--is-mono)]" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

/** Stripe Elements appearance — use when embedding @stripe/react-stripe-js */
export const stripeElementsAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#635bff",
    colorBackground: "#0f1428",
    colorText: "#e8eaf0",
    colorDanger: "#ff3b30",
    fontFamily: "Inter, -apple-system, sans-serif",
    fontSizeBase: "14px",
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "0.5px solid #1e2a4a",
      padding: "14px",
      letterSpacing: "0.04em",
      fontVariantNumeric: "tabular-nums",
    },
    ".Input:focus": {
      border: "0.5px solid #635bff",
      outline: "none",
    },
    ".Label": {
      fontSize: "10px",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      color: "#3a4560",
    },
  },
};
