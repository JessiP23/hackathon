import Link from "next/link";

/** Single-column phone shell — matches InfraStreet mockup (~430px). */
export function MobileAppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[var(--infra-black)] text-[var(--infra-ink)] [padding-bottom:env(safe-area-inset-bottom,0px)]">
      {children}
    </div>
  );
}

type MobileNavProps = {
  title: string;
  backHref: string;
  backLabel?: string;
  right?: React.ReactNode;
};

/** Sticky top bar — consistent across onboarding / orders / vendor detail. */
export function MobileNav({ title, backHref, backLabel = "Back", right }: MobileNavProps) {
  return (
    <header
      className="sticky top-0 z-40 flex h-11 items-center gap-2 border-b border-[var(--infra-ink-4)] bg-[rgba(0,0,0,0.92)] px-4 backdrop-blur-xl backdrop-saturate-180"
      style={{ paddingTop: "max(0px, env(safe-area-inset-top))", WebkitBackdropFilter: "saturate(180%) blur(20px)" }}
    >
      <Link
        href={backHref}
        className="min-w-[4.5rem] shrink-0 text-[15px] font-medium text-[var(--infra-blue)] active:opacity-70"
      >
        ← {backLabel}
      </Link>
      <span className="min-w-0 flex-1 truncate text-center text-[15px] font-semibold tracking-[-0.3px]">{title}</span>
      <div className="flex min-w-[4.5rem] shrink-0 justify-end">{right ?? <span className="inline-block w-1" aria-hidden />}</div>
    </header>
  );
}
