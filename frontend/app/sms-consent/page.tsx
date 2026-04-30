import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS terms & consent",
  description:
    "How InfraStreet collects SMS opt-in, messaging use cases, sample messages, and compliance contact.",
};

function ComplianceEmail() {
  const email =
    process.env.NEXT_PUBLIC_COMPLIANCE_EMAIL ?? "privacy@infrastreet.app";
  return (
    <a
      href={`mailto:${email}`}
      className="text-orange-400 hover:text-orange-300 underline underline-offset-2"
    >
      {email}
    </a>
  );
}

export default function SmsConsentPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 px-5 py-4 max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-neutral-500 hover:text-white text-sm font-medium"
        >
          Home
        </Link>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-10 pb-24 space-y-10 text-neutral-200 leading-relaxed">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            SMS terms & opt-in
          </h1>
          <p className="text-neutral-500 text-sm mt-2">
            Public page for carrier / Twilio registration (proof of consent, use
            case, samples). Replace the default email in production via{" "}
            <code className="text-neutral-400 bg-white/10 px-1 rounded">
              NEXT_PUBLIC_COMPLIANCE_EMAIL
            </code>
            .
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">
            Proof of consent (opt-in) collected
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-neutral-300">
            <li>
              <strong className="text-white">Customers:</strong> When you enter
              your phone number during onboarding at{" "}
              <Link href="/customer-onboarding" className="text-orange-400 hover:underline">
                Get Started
              </Link>
              , you must check the box confirming that you agree to receive SMS
              from InfraStreet as described on this page. We record your consent
              at the time you submit your phone number through our app.
            </li>
            <li>
              <strong className="text-white">Vendors:</strong> When you send
              the first text message to our InfraStreet business number, you are
              initiating the conversation and requesting account setup and service
              messages related to your storefront and flash deals.
            </li>
          </ul>
          <p className="text-neutral-500 text-sm">
            We do not sell your phone number to third parties for their own
            marketing. Messaging is limited to our service as described below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Use case description</h2>
          <p className="bg-white/5 border border-white/10 rounded-xl p-4 text-neutral-200 font-normal">
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
          <p className="text-neutral-500 text-sm">
            Copy the paragraph above into Twilio or carrier forms when a{" "}
            <strong className="text-neutral-400">use case description</strong> is
            required.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Sample messages</h2>
          <p className="text-neutral-500 text-sm">
            Examples below match the tone and length of production traffic (copy
            into registration forms as sample messages).
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Transactional (order)
              </p>
              <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-neutral-300 whitespace-pre-wrap font-mono">
                Orden confirmada! #T7K2M9 2x Tacos al pastor @ Maria&apos;s Cart.
                Pickup antes de 7:00 PM. Muestra este codigo al vendor.
              </pre>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Optional deal alert (customer opted in)
              </p>
              <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-neutral-300 whitespace-pre-wrap font-mono">
                InfraStreet: Tacos 50% off @ Maria&apos;s Cart, 0.8mi. $30. 12
                left til 7pm. infrastreet.app/d/fd_abc123
              </pre>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Vendor operational
              </p>
              <pre className="bg-black/40 border border-white/10 rounded-xl p-4 text-sm text-neutral-300 whitespace-pre-wrap font-mono">
                Nueva orden #T7K2M9 2x Tacos - $60 Cliente: Ana Pickup antes de
                7:00 PM
              </pre>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Opt-out & help</h2>
          <p className="text-neutral-300">
            You can opt out of optional marketing-style deal alerts by replying{" "}
            <strong className="text-white">STOP</strong>. Reply{" "}
            <strong className="text-white">START</strong> to resubscribe to deal
            alerts where supported. For transactional messages tied to an active
            order, contact us at the email below if you need help.
          </p>
          <p className="text-neutral-500 text-sm">
            Twilio and carriers process STOP/HELP according to their policies;
            InfraStreet updates notification preferences when STOP is received on
            supported customer flows.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">
            E-mail for notifications & compliance
          </h2>
          <p className="text-neutral-300">
            For SMS compliance questions, privacy requests, or messaging policy
            inquiries: <ComplianceEmail />
          </p>
        </section>

        <footer className="pt-8 border-t border-white/10 text-neutral-500 text-sm">
          <p>
            Last updated for InfraStreet registrants. Deploy this page at a stable
            URL (e.g.{" "}
            <span className="text-neutral-400">
              https://your-domain.vercel.app/sms-consent
            </span>
            ) and submit that link where carriers ask for a consent or policy
            URL.
          </p>
        </footer>
      </article>
    </main>
  );
}
