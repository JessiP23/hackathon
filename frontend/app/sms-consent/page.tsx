import Link from "next/link";
import type { Metadata } from "next";
import { MobileAppFrame, MobileNav } from "@/app/components/MobileLayout";

export const metadata: Metadata = {
  title: "SMS terms & consent | INFRA STREET",
  description:
    "How InfraStreet collects SMS opt-in, messaging use cases, sample messages, and compliance contact.",
};

function ComplianceEmail() {
  const email =
    process.env.NEXT_PUBLIC_COMPLIANCE_EMAIL ?? "privacy@infrastreet.app";
  return (
    <a
      href={`mailto:${email}`}
      className="text-[var(--infra-blue)] underline underline-offset-2 hover:opacity-90"
    >
      {email}
    </a>
  );
}

export default function SmsConsentPage() {
  return (
    <MobileAppFrame>
      <MobileNav title="SMS terms" backHref="/" backLabel="Home" />

      <article className="mx-auto max-w-[430px] space-y-10 px-5 py-8 pb-24 leading-relaxed text-[var(--infra-ink-2)]">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight text-[var(--infra-ink)]">
            SMS terms & opt-in
          </h1>
          <p className="mt-2 text-[13px] text-[var(--infra-ink-3)]">
            Public page for carrier / Twilio registration (proof of consent, use
            case, samples). Replace the default email in production via{" "}
            <code className="rounded bg-[var(--infra-tile-2)] px-1 font-mono text-[13px] text-[var(--infra-ink-2)]">
              NEXT_PUBLIC_COMPLIANCE_EMAIL
            </code>
            .
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-[17px] font-semibold text-[var(--infra-ink)]">
            Proof of consent (opt-in) collected
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-[15px] text-[var(--infra-ink-2)]">
            <li>
              <strong className="text-[var(--infra-ink)]">Customers:</strong> When you enter
              your phone number during onboarding at{" "}
              <Link href="/onboard" className="text-[var(--infra-blue)] underline underline-offset-2">
                Get Started
              </Link>
              , you must check the box confirming that you agree to receive SMS
              from InfraStreet as described on this page. We record your consent
              at the time you submit your phone number through our app.
            </li>
            <li>
              <strong className="text-[var(--infra-ink)]">Vendors:</strong> When you send
              the first text message to our InfraStreet business number, you are
              initiating the conversation and requesting account setup and service
              messages related to your storefront and flash deals.
            </li>
          </ul>
          <p className="text-[13px] text-[var(--infra-ink-3)]">
            We do not sell your phone number to third parties for their own
            marketing. Messaging is limited to our service as described below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[17px] font-semibold text-[var(--infra-ink)]">Use case description</h2>
          <p className="rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-4 font-normal text-[var(--infra-ink-2)]">
            InfraStreet sends SMS messages to connect nearby customers with local
            street vendors. Messages include transactional notifications such as
            order confirmations, pickup codes, and payment-related notices;
            optional informational messages about active flash deals near the
            customer when they have enabled deal alerts and provided location
            access through our mobile web app; and vendor-facing operational
            messages such as new orders and deal reminders. Message frequency
            varies based on user orders, deal activity, and account actions.
            Standard message and data rates may apply.
          </p>
          <p className="text-[13px] text-[var(--infra-ink-3)]">
            Copy the paragraph above into Twilio or carrier forms when a{" "}
            <strong className="text-[var(--infra-ink-2)]">use case description</strong> is
            required.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[17px] font-semibold text-[var(--infra-ink)]">Sample messages</h2>
          <p className="text-[13px] text-[var(--infra-ink-3)]">
            Examples below match the tone and length of production traffic (copy
            into registration forms as sample messages).
          </p>
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--infra-ink-3)]">
                Transactional (order)
              </p>
              <pre className="whitespace-pre-wrap rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-black)] p-4 font-mono text-[13px] text-[var(--infra-ink-2)]">
                Orden confirmada! #T7K2M9 2x Tacos al pastor @ Maria&apos;s Cart.
                Pickup antes de 7:00 PM. Muestra este codigo al vendor.
              </pre>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--infra-ink-3)]">
                Optional deal alert (customer opted in)
              </p>
              <pre className="whitespace-pre-wrap rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-black)] p-4 font-mono text-[13px] text-[var(--infra-ink-2)]">
                InfraStreet: Tacos 50% off @ Maria&apos;s Cart, 0.8mi. $30. 12
                left til 7pm. infrastreet.app/d/fd_abc123
              </pre>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--infra-ink-3)]">
                Vendor operational
              </p>
              <pre className="whitespace-pre-wrap rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-black)] p-4 font-mono text-[13px] text-[var(--infra-ink-2)]">
                Nueva orden #T7K2M9 2x Tacos - $60 Cliente: Ana Pickup antes de
                7:00 PM
              </pre>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-[17px] font-semibold text-[var(--infra-ink)]">Opt-out & help</h2>
          <p className="rounded-[var(--r-lg)] border border-[var(--infra-ink-4)] bg-[var(--infra-tile-1)] p-4 font-normal text-[var(--infra-ink-2)]">
            Reply <strong className="text-[var(--infra-ink)]">STOP</strong> to cancel optional
            deal-alert SMS. Reply <strong className="text-[var(--infra-ink)]">START</strong>{" "}
            to opt back into deal alerts where supported. Reply{" "}
            <strong className="text-[var(--infra-ink)]">HELP</strong> for how to contact
            InfraStreet (see compliance email on this page). Message frequency
            varies. Message and data rates may apply. Carriers and Twilio may
            handle STOP/HELP/START per network rules; we honor STOP for supported
            customer notification flows.
          </p>
          <p className="text-[13px] text-[var(--infra-ink-3)]">
            Copy the gray box above into Twilio / carrier fields that ask for{" "}
            <strong className="text-[var(--infra-ink-2)]">opt-out language</strong>,{" "}
            <strong className="text-[var(--infra-ink-2)]">HELP</strong>, or{" "}
            <strong className="text-[var(--infra-ink-2)]">disclosures</strong>.
          </p>
          <p className="text-[14px] text-[var(--infra-ink-2)]">
            For transactional texts tied to an active order (pickup codes,
            payment issues), contact <ComplianceEmail />.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-[17px] font-semibold text-[var(--infra-ink)]">
            E-mail for notifications & compliance
          </h2>
          <p className="text-[var(--infra-ink-2)]">
            For SMS compliance questions, privacy requests, or messaging policy
            inquiries: <ComplianceEmail />
          </p>
        </section>

        <footer className="border-t border-[var(--infra-ink-4)] pt-8 text-[13px] text-[var(--infra-ink-3)]">
          <p>
            Last updated for InfraStreet registrants. Deploy this page at a stable
            URL (e.g.{" "}
            <span className="text-[var(--infra-ink-2)]">
              https://your-domain.vercel.app/sms-consent
            </span>
            ) and submit that link where carriers ask for a consent or policy
            URL.
          </p>
        </footer>
      </article>
    </MobileAppFrame>
  );
}
