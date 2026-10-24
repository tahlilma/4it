import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { ReportFilters } from "@/components/report/filters";
import { ReportSheet } from "@/components/report/sheet";
import { PrintButton } from "@/components/report/toolbar";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { todayLocal } from "@/lib/dates";
import { str, type SP } from "@/lib/employee-filter";
import { rowCount } from "@/lib/reports/format";
import { reportBySlug, STATUTORY } from "@/lib/reports/registry";
import type { Paging } from "@/lib/reports/types";
import { latestProcessedDay, parseFilters } from "@/lib/reports/util";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SP> }) {
  const { slug } = await params;
  const def = reportBySlug(slug);
  if (!def) notFound();
  const user = await requirePerm(def.perm);
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const f = parseFilters(def, sp, today, await latestProcessedDay(today));
  const run = str(sp.run) === "1";
  const out = run ? await def.run(f, { company, user, today }) : null;
  const query = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string])))).toString();
  const hasContent = !!out && (!!out.node || (!!out.table && rowCount(out.table) > 0));
  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: "/reports", label: "Report Center" }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {def.title} {STATUTORY[def.slug] && <Badge tone="violet">{STATUTORY[def.slug]}</Badge>}
          </span>
        }
        subtitle={def.description}
        actions={
          hasContent && (
            <>
              <PrintButton />
              {out?.table && (
                <a href={`/api/reports/${def.slug}/xlsx?${query}`} className="btn btn-secondary">
                  <Icon name="download" strokeWidth={2} className="h-4 w-4" /> Excel
                </a>
              )}
            </>
          )
        }
      />
      <ReportFilters def={def} f={f} />
      {!run && (
        <Empty title="No Report Yet" icon="document">
          Choose the filters, then press Show Report.
        </Empty>
      )}
      {out && !hasContent && (
        <Empty title="No Results" icon="search">
          {out.empty ?? "Nothing matches these filters."}
        </Empty>
      )}
      {out && hasContent && f.paging && <BatchNav paging={f.paging} slug={def.slug} sp={sp} />}
      {out && hasContent && (
        <div className="print-reset -mx-1 overflow-x-auto rounded-[22px] bg-fill-3 p-3 lg:mx-0 lg:p-8">
          {out.node ? out.node : <ReportSheet out={out} company={company} printedBy={user.name} tz={company.tzOffsetMinutes} />}
        </div>
      )}
    </div>
  );
}

/**
 * Whole-factory document runs are shown one batch at a time, so any computer can open and print them.
 * Plain links and a GET form: works without JavaScript.
 */
function BatchNav({ paging, slug, sp }: { paging: Paging; slug: string; sp: SP }) {
  const params = (page: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) for (const x of v === undefined ? [] : Array.isArray(v) ? v : [v]) if (k !== "page") q.append(k, x);
    q.set("page", String(page));
    return q;
  };
  const href = (page: number) => `/reports/${slug}?${params(page).toString()}`;
  const hidden = [...params(paging.page).entries()].filter(([k]) => k !== "page");
  return (
    <div className="no-print card flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3.5">
      <div className="min-w-0">
        <div className="text-[14.5px] text-label">
          Showing <b className="font-semibold tabular-nums">{paging.from.toLocaleString("en-IN")}–{paging.to.toLocaleString("en-IN")}</b> of <b className="font-semibold tabular-nums">{paging.total.toLocaleString("en-IN")}</b> · batch {paging.page} of {paging.pages}
        </div>
        <p className="mt-0.5 max-w-2xl text-[12.5px] leading-snug text-label-2">
          Large runs come in batches of {paging.size} so that any computer can open and print them. Print each batch in turn, or narrow the filters (for example to one section).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {paging.page > 1 ? (
          <a href={href(paging.page - 1)} className="btn btn-secondary btn-sm">
            <Icon name="chevron-left" strokeWidth={2.2} className="h-3.5 w-3.5" /> Previous
          </a>
        ) : null}
        <form method="get" action={`/reports/${slug}`} className="flex items-center gap-1.5">
          {hidden.map(([k, v], i) => (
            <input key={i} type="hidden" name={k} value={v} />
          ))}
          <label className="sr-only" htmlFor="batch-page">Batch</label>
          <select id="batch-page" name="page" defaultValue={String(paging.page)} className="input w-auto py-[3px] pr-8 text-[13px]">
            {Array.from({ length: paging.pages }, (_, i) => (
              <option key={i} value={i + 1}>
                Batch {i + 1}: {(i * paging.size + 1).toLocaleString("en-IN")}–{Math.min(paging.total, (i + 1) * paging.size).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Go
          </button>
        </form>
        {paging.page < paging.pages ? (
          <a href={href(paging.page + 1)} className="btn btn-primary btn-sm">
            Next <Icon name="chevron-right" strokeWidth={2.2} className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}
