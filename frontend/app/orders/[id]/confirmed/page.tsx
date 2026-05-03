"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { MobileAppFrame } from "@/app/components/MobileLayout";
import { PillLink, StatusPill } from "@/app/components/Precision";

export default function OrderConfirmedPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <MobileAppFrame>
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--is-bg)] px-6 pb-16 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.1, 1] }}
          transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          className="mb-8 flex size-12 items-center justify-center rounded-full"
          style={{ background: "var(--is-green-tint)" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 12.5 10 16.5 18 8"
              stroke="var(--is-green)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--is-text-1)]">Payment confirmed</h1>
        <p className="mt-2 max-w-xs text-[15px] text-[var(--is-text-2)]">Your order is being prepared.</p>
        <div className="mt-6 flex justify-center">
          <StatusPill kind="ready">Ready soon</StatusPill>
        </div>
        <div className="mt-10 w-full max-w-xs space-y-3">
          <PillLink href={`/orders/${id}`}>Track order</PillLink>
          <PillLink href="/deals" variant="ghost">
            Back to deals
          </PillLink>
        </div>
      </main>
    </MobileAppFrame>
  );
}
