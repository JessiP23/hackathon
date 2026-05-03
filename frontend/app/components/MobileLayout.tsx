import Link from "next/link";

/** Single-column phone shell — Stripe Precision (~430px). */
export function MobileAppFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[var(--is-bg)] font-[family-name:var(--is-font)] text-[var(--is-text-1)] [padding-bottom:env(safe-area-inset-bottom,0px)]"
    >
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

/** Sticky top bar — Precision spec */
export function MobileNav({ title, backHref, backLabel = "Back", right }: MobileNavProps) {
  return (
    <header
      className="sticky top-0 z-[100] flex items-center justify-between border-b-[0.5px] border-[var(--is-border-1)] bg-[var(--is-bg)] px-5 py-3 backdrop-blur-[20px] [-webkit-backdrop-filter:blur(20px)]"
      style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
    >
      <Link
        href={backHref}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center text-[13px] font-medium text-[var(--is-blue)]"
      >
        <span aria-hidden className="mr-0.5">
          ‹
        </span>
        {backLabel}
      </Link>
      <span className="min-w-0 flex-1 truncate px-2 text-center text-[15px] font-semibold tracking-[-0.01em] text-[var(--is-text-1)]">
        {title}
      </span>
      <div className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-end text-[12px] text-[var(--is-text-4)]">
        {right ?? <span className="inline-block w-1" aria-hidden />}
      </div>
    </header>
  );
}
