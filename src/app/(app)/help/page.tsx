import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader, SectionLabel, Tile } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { helpCtx } from "./load";
import { HelpSearch, type HelpEntry } from "./search";
import { textOf } from "./text";
import { TOPICS, topicBySlug } from "./topics";

export const metadata: Metadata = { title: "Help & Guide" };

export default async function HelpHome() {
  await requireUser();
  const ctx = await helpCtx();
  const built = TOPICS.map((t) => ({ t, sections: t.sections(ctx) }));
  const entries: HelpEntry[] = built.flatMap(({ t, sections }) => [
    { href: `/help/${t.slug}`, title: t.title, topic: "Topic", words: `${t.title} ${t.summary} ${t.keywords ?? ""}`.toLowerCase() },
    ...sections.map((s) => ({ href: `/help/${t.slug}#${s.id}`, title: s.title, topic: t.title, words: `${s.title} ${t.title} ${t.keywords ?? ""} ${textOf(s.body)}`.toLowerCase() })),
  ]);
  const start = ["getting-started", "monthly-cycle"].map((s) => topicBySlug(s)!);
  const rest = TOPICS.filter((t) => !start.includes(t));
  const faq = built.find((b) => b.t.slug === "faq")?.sections.slice(0, 6) ?? [];

  return (
    <div className="space-y-9">
      <div>
        <PageHeader
          eyebrow="Help & Guide"
          title="How everything works"
          subtitle="Plain-language explanations of every screen, rule and report in the app — written so that anyone can follow them, with no HR or IT background needed. Figures in orange are your factory's own settings."
        />
        <div className="-mt-2">
          <HelpSearch entries={entries} />
        </div>
      </div>

      <section>
        <SectionLabel>Start here</SectionLabel>
        <div className="grid gap-3 md:grid-cols-2">
          {start.map((t, i) => (
            <Link key={t.slug} href={`/help/${t.slug}`} className="group card flex items-start gap-4 p-5 transition-transform duration-200 ease-out hover:-translate-y-0.5">
              <Tile icon={t.icon} color={t.color} size={44} />
              <div className="min-w-0 flex-1">
                <div className="eyebrow text-label-3">Step {i + 1}</div>
                <div className="mt-0.5 font-display text-[21px] font-semibold text-label">{t.title}</div>
                <p className="mt-1 text-[14px] leading-relaxed text-label-2">{t.summary}</p>
              </div>
              <Icon name="arrow-right" strokeWidth={2} className="mt-1 h-4 w-4 shrink-0 text-label-3 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink-blue" />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>All topics</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((t) => {
            const n = built.find((b) => b.t === t)?.sections.length ?? 0;
            return (
              <Link key={t.slug} href={`/help/${t.slug}`} className="group card flex flex-col p-4 transition-transform duration-200 ease-out hover:-translate-y-0.5">
                <div className="flex items-center gap-3">
                  <Tile icon={t.icon} color={t.color} size={34} />
                  <div className="text-[15.5px] font-semibold text-label">{t.title}</div>
                </div>
                <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-label-2">{t.summary}</p>
                <div className="mt-3 flex items-center justify-between text-[12.5px] text-label-3">
                  <span>{t.slug === "glossary" ? "A–Z" : `${n} sections`}</span>
                  <span className="flex items-center gap-1 font-medium text-ink-blue opacity-0 transition-opacity group-hover:opacity-100">
                    Read <Icon name="arrow-right" strokeWidth={2.2} className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <SectionLabel>Quick answers</SectionLabel>
        <div className="card divide-y divide-sep">
          {faq.map((s) => (
            <Link key={s.id} href={`/help/faq#${s.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-fill-4">
              <Icon name="question" strokeWidth={1.9} className="h-[18px] w-[18px] shrink-0 text-ink-orange" />
              <span className="flex-1 text-[14.5px] text-label">{s.title}</span>
              <Icon name="chevron-right" strokeWidth={2.2} className="h-3.5 w-3.5 text-label-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
          <Link href="/help/faq" className="flex items-center gap-1 px-4 py-3 text-[14px] font-medium text-ink-blue hover:bg-fill-4">
            All questions <Icon name="arrow-right" strokeWidth={2.2} className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
