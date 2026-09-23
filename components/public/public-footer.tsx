import Link from "next/link";
import { env } from "@/lib/env";

export function PublicFooter() {
  const contactItems = [
    env.COMPANY_CONTACT_PHONE ? { label: env.COMPANY_CONTACT_PHONE, href: `tel:${env.COMPANY_CONTACT_PHONE}` } : null,
    env.COMPANY_CONTACT_EMAIL ? { label: env.COMPANY_CONTACT_EMAIL, href: `mailto:${env.COMPANY_CONTACT_EMAIL}` } : null,
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <footer className="mx-auto max-w-7xl px-4 pb-8 pt-6 text-sm text-slate-700 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#D0B830]/30 pt-5">
        <div>
          <p className="font-bold text-slate-950">A1 Parola Window & Gutter Cleaning</p>
          <p className="mt-1">Bay Area residential window and gutter cleaning.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/privacy" className="font-semibold text-[#8a7211] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="font-semibold text-[#8a7211] underline-offset-2 hover:underline">
            Terms
          </Link>
          {contactItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              data-analytics-event={item.href.startsWith("tel:") ? "phone_click" : "email_click"}
              data-analytics-category="lead"
              data-analytics-location="public_footer"
              className="font-semibold text-[#8a7211] underline-offset-2 hover:underline"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
