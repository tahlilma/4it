import Link from "next/link";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { FESTIVALS, label } from "@/lib/constants";
import { dmy, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { int, money } from "@/lib/num";
import { BonusRunForm } from "../forms";

export default async function BonusIndex() {
  await requirePerm("bonus.manage");
  const company = await getCompany();
  const runs = await prisma.bonusRun.findMany({ orderBy: { cutoffDate: "desc" } });
  const sums = await prisma.bonusLine.groupBy({ by: ["runId"], _count: { _all: true }, _sum: { amount: true, net: true } });
  const byRun = new Map(sums.map((s) => [s.runId, s]));
  return (
    <div className="space-y-5">
      <PageHeader title="Festival bonus" subtitle="Labour Rules r.111(5): two festival bonuses a year for workers with one year of continuous service, each up to one month's basic wage." />
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Bonus sheets" className="xl:col-span-2" bodyClass="overflow-x-auto p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Title</th>
                <th>Festival</th>
                <th>Service up to</th>
                <th>Religions</th>
                <th className="text-right">Employees</th>
                <th className="text-right">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link className="link font-medium" href={`/payroll/bonus/${r.id}`}>
                      {r.title}
                    </Link>
                  </td>
                  <td>{label(FESTIVALS, r.festival)}</td>
                  <td>{dmy(r.cutoffDate)}</td>
                  <td className="text-xs">{r.religions === "ALL" ? "All" : r.religions.toLowerCase()}</td>
                  <td className="text-right tabular-nums">{int(byRun.get(r.id)?._count._all ?? 0)}</td>
                  <td className="text-right tabular-nums">{money(byRun.get(r.id)?._sum.amount ?? 0, false)}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500">
                    No bonus sheets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
        <Card title="New bonus sheet" className="h-fit">
          <BonusRunForm today={ymd(todayLocal(company.tzOffsetMinutes))} />
        </Card>
      </div>
    </div>
  );
}
