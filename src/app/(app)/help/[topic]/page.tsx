import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { cx, PageHeader, Tile } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { helpCtx } from "../load";
import { TOPICS, topicBySlug } from "../topics";

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  return { title: topicBySlug(topic)?.title ?? "Help & Guide" };
}

export default async function HelpTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  await requireUser();
  const { topic: slug } = await params;
  const topic = topicBySlug(slug);
  if (!topic) notFound();
  const sections = topic.sections(await helpCtx());
  const i = TOPICS.indexOf(topic);
  const prev = TOPICS[i - 1];
  const next = TOPICS[i + 1];
  const contents = (
    <ol className="space-y-0.5">
      {sections.map((s) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="block rounded-md px-2 py-1 text-[13.5px] leading-snug text-label-2 transition-colors hover:bg-fill-4 hover:text-label">
            {s.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div>
      <PageHeader back={{ href: "/help", label: "Help & Guide" }} eyebrow={`Guide · ${i + 1} of ${TOPICS.length}`} title={topic.title} subtitle={topic.summary} />
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_230px]">
        <article className="min-w-0 max-w-[780px]">
          <details className="card mb-8 px-4 py-3 xl:hidden">
            <summary className="cursor-pointer text-[13px] font-semibold tracking-[0.08em] text-label-2 uppercase">On this page</summary>
            <div className="mt-2">{contents}</div>
          </details>

          {sections.map((s, n) => (
            <section key={s.id} id={s.id} className={cx("scroll-mt-20", n > 0 && "mt-12 border-t border-sep pt-10")}>
              <h2 className="group font-display text-[25px] leading-tight font-semibold text-label">
                <a href={`#${s.id}`} className="inline-flex items-baseline gap-2">
                  {s.title}
                  <span aria-hidden className="text-[18px] text-label-3 opacity-0 transition-opacity group-hover:opacity-100">
                    #
                  </span>
                </a>
              </h2>
              <div className="mt-2">{s.body}</div>
            </section>
          ))}

          <nav aria-label="More topics" className="mt-14 grid gap-3 border-t border-sep pt-8 sm:grid-cols-2">
            {prev ? <Neighbour slug={prev.slug} title={prev.title} icon={prev.icon} color={prev.color} label="Previous" /> : <span />}
            {next && <Neighbour slug={next.slug} title={next.title} icon={next.icon} color={next.color} label="Next" alignEnd />}
          </nav>
        </article>

        <aside className="hidden xl:block">
          <nav aria-label="On this page" className="sticky top-20">
            <div className="eyebrow mb-2 px-2 text-label-3">On this page</div>
            {contents}
            <Link href="/help" className="mt-5 flex items-center gap-1.5 px-2 text-[13px] font-medium text-ink-blue hover:underline">
              <Icon name="book" strokeWidth={1.9} className="h-4 w-4" /> All topics
            </Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function Neighbour({ slug, title, icon, color, label, alignEnd }: { slug: string; title: string; icon: Parameters<typeof Tile>[0]["icon"]; color: Parameters<typeof Tile>[0]["color"]; label: string; alignEnd?: boolean }) {
  return (
    <Link href={`/help/${slug}`} className={cx("group card flex items-center gap-3 p-4 transition-transform duration-200 hover:-translate-y-0.5", alignEnd && "sm:flex-row-reverse sm:text-right")}>
      <Tile icon={icon} color={color} size={34} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-label-3">{label}</div>
        <div className="truncate text-[15px] font-semibold text-label group-hover:text-ink-blue">{title}</div>
      </div>
    </Link>
  );
}
