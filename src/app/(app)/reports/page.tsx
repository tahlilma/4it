import { Icon, type IconName } from "@/components/icons";
import { Badge, Empty, List, ListRow, PageHeader, Tile, type Hue } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { hasPerm } from "@/lib/rbac";
import { REPORT_GROUPS, REPORTS, STATUTORY } from "@/lib/reports/registry";

const GROUP_LOOK: Record<string, { icon: IconName; color: Hue; blurb: string }> = {
  "Personal File": { icon: "folder", color: "blue", blurb: "Letters, forms and the documents kept in each worker's file." },
  Leave: { icon: "calendar", color: "purple", blurb: "Applications, registers and balances." },
  Increment: { icon: "trending", color: "mint", blurb: "Increments, promotions and their letters." },
  Employee: { icon: "users", color: "orange", blurb: "Lists, registers, ID cards and headcount." },
  Attendance: { icon: "clock", color: "indigo", blurb: "Daily, monthly and overtime records." },
  Bills: { icon: "moon", color: "teal", blurb: "Tiffin and night allowances." },
  Payroll: { icon: "cash", color: "green", blurb: "Salary sheets, pay slips, bank and bonus." },
};

export default async function ReportsIndex({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const term = (q ?? "").toLowerCase();
  const visible = REPORTS.filter((r) => hasPerm(user.role, r.perm) && (!term || `${r.title} ${r.titleBn ?? ""} ${r.description}`.toLowerCase().includes(term)));
  const groups = REPORT_GROUPS.map((g) => ({
    g,
    items: visible.filter((r) => r.group === g),
    look: GROUP_LOOK[g] ?? { icon: "document" as const, color: "gray" as const, blurb: "" },
  })).filter((x) => x.items.length);
  return (
    <div>
      <PageHeader
        title="Report Center"
        subtitle={`${visible.length} reports, letters and statutory forms. Each prints to A4 or legal (Print → Save as PDF); tables also export to Excel.`}
        actions={
          <form method="get" role="search" className="relative w-full sm:w-72">
            <Icon name="search" strokeWidth={2} className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-label-2" />
            <input name="q" type="search" defaultValue={q} placeholder="Search reports" aria-label="Search reports" className="input pl-8" />
          </form>
        }
      />

      {groups.length > 1 && (
        <nav aria-label="Categories" className="no-print -mt-2 mb-7 flex flex-wrap gap-2">
          {groups.map(({ g, items, look }) => (
            <a
              key={g}
              href={`#${slugify(g)}`}
              className="press inline-flex items-center gap-2 rounded-full bg-surface py-1 pr-3 pl-1 text-[13px] font-medium text-label ring-1 ring-stone-900/[0.05] transition-transform duration-150 active:scale-[0.96]"
            >
              <Tile icon={look.icon} color={look.color} size={22} />
              {g}
              <span className="text-label-3 tabular-nums">{items.length}</span>
            </a>
          ))}
        </nav>
      )}

      {!groups.length && (
        <Empty title="No Results" icon="search">
          No report matches “{q}”. Try a different word, such as “salary” or “ফরম”.
        </Empty>
      )}

      <div className="gap-7 xl:columns-2">
        {groups.map(({ g, items, look }) => (
          <section key={g} id={slugify(g)} className="mb-7 scroll-mt-20 break-inside-avoid">
            <div className="mb-2 flex items-center gap-2.5 px-1">
              <Tile icon={look.icon} color={look.color} size={26} />
              <div className="min-w-0">
                <h2 className="text-[17px] leading-tight font-semibold tracking-[-0.016em] text-label">{g}</h2>
                {look.blurb && <p className="text-[12.5px] text-label-2">{look.blurb}</p>}
              </div>
            </div>
            <List>
              {items.map((r) => (
                <ListRow
                  key={r.slug}
                  href={`/reports/${r.slug}`}
                  title={r.title}
                  subtitle={r.titleBn ? <span className="font-bn">{r.titleBn}</span> : <span className="line-clamp-1">{r.description}</span>}
                  accessory={STATUTORY[r.slug] ? <Badge tone="violet">{STATUTORY[r.slug]}</Badge> : undefined}
                />
              ))}
            </List>
          </section>
        ))}
      </div>
    </div>
  );
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}
