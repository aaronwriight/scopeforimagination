import { Fragment, type ReactNode } from "react";
import { ExternalLink } from "@/components/science/science-content";

export type PublicationLink = {
  href: string;
  label: string;
};

export function PublicationLinks({ links, children }: { links: PublicationLink[]; children: ReactNode }) {
  return (
    <details className="mt-3">
      <summary className="inline cursor-pointer list-none text-[#6f8200]">
        <span className="hover:underline">ABS</span>
        {links.map((link) => (
          <Fragment key={link.href}>
            {" | "}
            <ExternalLink href={link.href}>{link.label}</ExternalLink>
          </Fragment>
        ))}
      </summary>
      <div className="mt-3 pl-5">{children}</div>
    </details>
  );
}
