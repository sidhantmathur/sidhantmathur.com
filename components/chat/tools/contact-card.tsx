import { MonoLink } from "@/components/mono-link";

// ContactCard (04 §2.4). Mono "Get in touch" label, three link rows styled
// like the footer. Never renders salary, address, or phone — there are no
// props for any of those (keeps the schema honest; the phone number is
// deliberately excluded from every published surface, 00-decisions.md §11).
//
// Shape matches the contactCard tool's execute() return value.
export type ContactCardData = {
  email: string;
  github: string;
  linkedin: string;
};

export function ContactCard({ data }: { data: ContactCardData }) {
  return (
    <div className="border border-ink bg-paper p-5">
      <span className="font-mono text-xs text-muted">Get in touch</span>
      <div className="mt-3 flex flex-col gap-2">
        <MonoLink href={data.github} variant="external" contact="github">
          GitHub
        </MonoLink>
        <MonoLink href={data.linkedin} variant="external" contact="linkedin">
          LinkedIn
        </MonoLink>
        <MonoLink href={data.email} variant="mailto" contact="email">
          Email
        </MonoLink>
      </div>
    </div>
  );
}
