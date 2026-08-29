import type { Metadata } from "next";
import { SectionPageShell } from "@/components/site/site-content";
import { NewsletterSignup } from "@/components/site/newsletter-signup";

export const metadata: Metadata = {
  title: "mailing list | scope for imagination",
  description: "Subscribe to Scope for Imagination updates.",
};

const mailingListLinks = [
  ["contact", "/contact"],
  ["home", "/"],
];

export default function MailingListPage() {
  return (
    <SectionPageShell
      section="mailing list"
      links={mailingListLinks}
      title="mailing list"
      subtitle="get an occasional email when a new entry finds its way into Scope for Imagination."
    >
      <div className="not-prose max-w-2xl">
        <NewsletterSignup />
      </div>
    </SectionPageShell>
  );
}
