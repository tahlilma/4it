import Link from "next/link";
import { ActionButton } from "@/components/form";
import { Alert, Badge, Card, PageHeader, StatusBadge } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { addDays, diffDays, dmy, todayLocal, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { continuousAbsences } from "@/lib/services/lefty";
import { openLeftyCase } from "../actions";
import { LeftyStep } from "../forms";

export default async function LeftyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("separation.manage");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const showClosed = sp.closed === "1";
  const [runs, cases] = await Promise.all([
    continuousAbsences(prisma, company.leftyAbsentDays),
    prisma.leftyCase.findMany({
      where: showClosed ? {} : { status: "OPEN" },
      include: { employee: { include: { designation: true, section: true } } },
      orderBy: { absentFrom: "asc" },
    }),
  ]);
  const openIds = new Set((await prisma.leftyCase.findMany({ where: { status: "OPEN" }, select: { employeeId: true } })).map((c) => c.employeeId));
  const candidates = runs.filter((r) => !openIds.has(r.employeeId));
  const emps = await prisma.employee.findMany({ where: { id: { in: candidates.map((c) => c.employeeId) } }, include: { designation: true, section: true } });
  const empById = new Map(emps.map((e) => [e.id, e]));
  const t = ymd(today);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Lefty (unauthorised absence) cases"
        subtitle={`Bangladesh Labour Act s.27(3A): after more than ${company.leftyAbsentDays} days' absence without leave, write asking the worker to explain and rejoin within 10 days; if no reply, allow 7 more days for self-defence; only then treat the worker as having resigned.`}
      />
      <Card title={`Absent more than ${company.leftyAbsentDays} days — no case yet (${candidates.length})`} bodyClass="overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Absent since</th>
              <th className="text-right">Days</th>
              <th>Last processed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {candidates.map((r) => {
              const e = empById.get(r.employeeId)!;
              return (
                <tr key={r.employeeId}>
                  <td>
                    <Link className="link text-[13px] font-medium tabular-nums" href={`/employees/${e.id}?tab=attendance`}>
                      {e.empCode}
                    </Link>
                    <div className="text-sm">{e.nameEn}</div>
                    <div className="text-xs text-stone-500">
                      {e.designation.nameEn} · {e.section.nameEn}
                    </div>
                  </td>
                  <td>{dmy(r.from)}</td>
                  <td className="text-right">
                    <Badge tone="red">{r.days}</Badge>
                  </td>
                  <td className="text-xs">{dmy(r.lastDate)}</td>
                  <td className="text-right">
                    <ActionButton action={openLeftyCase} fields={{ employeeId: r.employeeId, absentFrom: ymd(r.from) }} label="Open case" variant="primary" />
                  </td>
                </tr>
              );
            })}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-stone-500">
                  No new continuous absences.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Card
        title={showClosed ? "All cases" : `Open cases (${cases.length})`}
        actions={
          <Link className="btn btn-ghost btn-sm" href={showClosed ? "/separations/lefty" : "/separations/lefty?closed=1"}>
            {showClosed ? "Open only" : "Include closed"}
          </Link>
        }
        bodyClass="overflow-x-auto p-0"
      >
        <table className="tbl">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Absent since</th>
              <th>1st letter</th>
              <th>2nd letter</th>
              <th>3rd letter</th>
              <th>Next step</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const l2Due = c.letter1Date ? addDays(c.letter1Date, 10) : null;
              const l3Due = c.letter2Date ? addDays(c.letter2Date, 7) : null;
              const print = (n: number) => (
                <span className="ml-1 inline-flex gap-1 text-xs">
                  <Link className="text-ink-blue hover:underline" href={`/reports/lefty-letter?case=${c.id}&letter=${n}&run=1&status=ALL`}>
                    letter
                  </Link>
                  <Link className="text-ink-blue hover:underline" href={`/reports/lefty-envelope?case=${c.id}&run=1&status=ALL`}>
                    envelope
                  </Link>
                </span>
              );
              return (
                <tr key={c.id}>
                  <td>
                    <Link className="link text-[13px] font-medium tabular-nums" href={`/employees/${c.employeeId}?tab=attendance`}>
                      {c.employee.empCode}
                    </Link>
                    <div className="text-sm">{c.employee.nameEn}</div>
                    <div className="text-xs text-stone-500">{c.employee.section.nameEn}</div>
                  </td>
                  <td>
                    {dmy(c.absentFrom)}
                    <div className="text-xs text-stone-500">{diffDays(c.absentFrom, today)} days</div>
                  </td>
                  <td className="text-sm">{c.letter1Date ? <>{dmy(c.letter1Date)}{print(1)}</> : "—"}</td>
                  <td className="text-sm">{c.letter2Date ? <>{dmy(c.letter2Date)}{print(2)}</> : l2Due ? <span className="text-xs text-stone-500">due {dmy(l2Due)}</span> : "—"}</td>
                  <td className="text-sm">{c.letter3Date ? <>{dmy(c.letter3Date)}{print(3)}</> : l3Due ? <span className="text-xs text-stone-500">due {dmy(l3Due)}</span> : "—"}</td>
                  <td>
                    {c.status === "OPEN" && (
                      <div className="flex flex-col gap-1.5">
                        {!c.letter1Date && (
                          <>
                            <Link className="text-[12.5px] text-ink-blue hover:underline" href={`/reports/lefty-letter?case=${c.id}&letter=1&run=1&status=ALL`}>
                              Print 1st letter →
                            </Link>
                            <LeftyStep id={c.id} op="letter1" label="1st letter sent" today={t} />
                          </>
                        )}
                        {c.letter1Date && !c.letter2Date && (
                          <>
                            <Link className="text-[12.5px] text-ink-blue hover:underline" href={`/reports/lefty-letter?case=${c.id}&letter=2&run=1&status=ALL`}>
                              Print 2nd letter →
                            </Link>
                            <LeftyStep id={c.id} op="letter2" label="2nd letter sent" today={t} />
                          </>
                        )}
                        {c.letter2Date && !c.letter3Date && (
                          <>
                            <Link className="text-[12.5px] text-ink-blue hover:underline" href={`/reports/lefty-letter?case=${c.id}&letter=3&run=1&status=ALL`}>
                              Print 3rd letter →
                            </Link>
                            <LeftyStep id={c.id} op="letter3" label="3rd letter sent" today={t} />
                          </>
                        )}
                        {c.letter3Date && <LeftyStep id={c.id} op="separate" label="Record deemed resignation" today={t} variant="danger" confirm="Record this worker as having resigned under s.27(3A)?" />}
                        <LeftyStep id={c.id} op="rejoined" label="Rejoined" today={t} variant="success" />
                      </div>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              );
            })}
            {cases.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-stone-500">
                  No cases.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <Alert tone="amber">Letters must go by registered post to both present and permanent addresses (print the envelopes). Keep the postal receipts in the personal file.</Alert>
    </div>
  );
}
