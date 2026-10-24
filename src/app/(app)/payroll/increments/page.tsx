import Link from "next/link";
import { SegmentedNav } from "@/components/segmented";
import { Card, PageHeader, Pager } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { INCREMENT_KINDS, label } from "@/lib/constants";
import { addMonths, dmy, startOfMonth, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { money } from "@/lib/num";
import { refOptions } from "@/lib/refs";
import { PromotionForm, ProposalForm, ProposalTable, type ProposalRow } from "../forms";

const VIEWS = ["PROPOSED", "APPROVED", "APPLIED", "REJECTED"] as const;
/** Proposals per page — the table is interactive, so it stays small even when thousands are due. */
const PER_PAGE = 100;

export default async function IncrementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("increment.propose");
  const sp = await searchParams;
  const view = (VIEWS as readonly string[]).includes(sp.view ?? "") ? sp.view! : "PROPOSED";
  const page = Math.max(1, Number(sp.page) || 1);
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const nextMonth = addMonths(startOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1), 1);
  const [incs, counts, designations, grades] = await Promise.all([
    prisma.increment.findMany({
      where: { status: view },
      include: { employee: true, oldDesignation: true, newDesignation: true },
      orderBy: [{ effectiveDate: "asc" }, { employee: { empCode: "asc" } }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.increment.groupBy({ by: ["status"], _count: { _all: true } }),
    refOptions("designations"),
    refOptions("grades"),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count._all]));
  const rows: ProposalRow[] = incs.map((i) => ({
    id: i.id, status: i.status, code: i.employee.empCode, name: i.employee.nameEn, kind: label(INCREMENT_KINDS, i.kind),
    effective: dmy(i.effectiveDate), oldDesig: i.oldDesignation.nameEn, newDesig: i.newDesignation.nameEn,
    oldGross: money(i.oldGross, false), newGross: money(i.newGross, false), amount: money(i.amount, false), percent: i.percent, empId: i.employeeId,
  }));
  return (
    <div className="space-y-5">
      <PageHeader
        title="Increment & promotion"
        subtitle={`RMG wage gazette: annual increment of at least ${company.incrementPercent}% of basic after each year of service. Propose → approve → apply (applied changes are written to the salary history).`}
        actions={
          <>
            <Link className="btn btn-secondary" href="/reports/increment-proposals?run=1">
              Proposal list
            </Link>
            <Link className="btn btn-secondary" href="/reports/increment-list?run=1">
              Increment list
            </Link>
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <SegmentedNav
            className="w-full sm:w-fit"
            active={view}
            items={VIEWS.map((v) => ({ key: v, label: `${v.charAt(0)}${v.slice(1).toLowerCase()} (${c[v] ?? 0})`, href: `/payroll/increments?view=${v}` }))}
          />
          <Card bodyClass="p-0">
            <ProposalTable
              rows={rows}
              total={c[view] ?? 0}
              view={view}
              canApprove={can(user, "increment.approve") && view === "PROPOSED"}
              canApply={can(user, "salary.edit") && view === "APPROVED"}
            />
            <Pager page={page} pages={Math.ceil((c[view] ?? 0) / PER_PAGE)} makeHref={(n) => `/payroll/increments?view=${view}&page=${n}`} />
          </Card>
        </div>
        <div className="space-y-5">
          <Card title="Annual increment proposals">
            <ProposalForm date={ymd(nextMonth)} percent={company.incrementPercent} />
          </Card>
          <Card title="Promotion / special increment">
            <PromotionForm designations={designations} grades={grades} date={ymd(nextMonth)} />
          </Card>
        </div>
      </div>
    </div>
  );
}
