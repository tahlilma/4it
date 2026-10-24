import Link from "next/link";
import { Icon } from "@/components/icons";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { addMonths, monthKey, monthLabel, parseMonth, startOfMonth, todayLocal } from "@/lib/dates";
import { runCompliance, type Severity } from "@/lib/services/compliance";

const SEV: Record<Severity, { tone: "red" | "amber" | "slate"; label: string }> = {
  high: { tone: "red", label: "High" },
  medium: { tone: "amber", label: "Medium" },
  low: { tone: "slate", label: "Low" },
};

export default async function CompliancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("compliance.view");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const prev = addMonths(startOfMonth(today.getUTCFullYear(), today.getUTCMonth() + 1), -1);
  const month = parseMonth(sp.month) ?? { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 };
  const checks = await runCompliance(company, today, month);
  const failing = checks.filter((c) => c.count > 0);
  const areas = [...new Set(checks.map((c) => c.area))];
  return (
    <div className="space-y-7">
      <PageHeader
        title="Compliance Monitor"
        subtitle="Live checks against the Bangladesh Labour Act 2006, Labour Rules 2015, the RMG wage gazette and common buyer-audit requirements (amfori BSCI, WRAP, SMETA, C-TPAT). Records are shown as they are — fix the cause, not the record."
        actions={
          <form method="get" className="flex items-end gap-2">
            <div>
              <label className="label">Working-hours month</label>
              <input type="month" name="month" defaultValue={monthKey(month.year, month.month)} className="input" />
            </div>
            <button className="btn btn-primary">Check</button>
          </form>
        }
      />
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Checks Passing"
          icon="check-circle"
          value={`${checks.length - failing.length}/${checks.length}`}
          tone={failing.length ? "amber" : "green"}
          sub={failing.length ? `${failing.length} need attention` : "Everything checks out"}
        />
        <Stat label="High Severity" icon="warning" value={failing.filter((c) => c.severity === "high").length} unit="findings" tone="red" />
        <Stat label="Medium" icon="warning" value={failing.filter((c) => c.severity === "medium").length} unit="findings" tone="amber" />
        <Stat label="Hours Checked For" icon="calendar" value={monthLabel(month.year, month.month)} tone="blue" />
      </div>
      {areas.map((area) => (
        <section key={area}>
          <h2 className="eyebrow mb-2 px-1 text-label-3">{area}</h2>
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {checks
              .filter((c) => c.area === area)
              .sort((a, b) => Number(b.count > 0) - Number(a.count > 0))
              .map((c) => (
                <Card key={c.key}>
                  <div className="flex items-start gap-3">
                    {c.count ? (
                      <Icon
                        name="warning"
                        strokeWidth={2}
                        className={`mt-0.5 h-5 w-5 shrink-0 ${c.severity === "high" ? "text-ink-red" : c.severity === "medium" ? "text-ink-orange" : "text-label-2"}`}
                      />
                    ) : (
                      <Icon name="check-circle" strokeWidth={2} className="mt-0.5 h-5 w-5 shrink-0 text-ink-green" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] leading-snug font-semibold text-label">{c.title}</div>
                      <div className="mt-0.5 text-[12.5px] text-label-2">{c.law}</div>
                    </div>
                    {c.count ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={SEV[c.severity].tone}>{SEV[c.severity].label}</Badge>
                        <span className="min-w-6 rounded-full bg-fill-3 px-1.5 text-center text-[12px] leading-5 font-semibold text-label tabular-nums">{c.count}</span>
                      </div>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    )}
                  </div>
                  {c.count > 0 && (
                    <div className="mt-3 ml-8">
                      <ul className="space-y-1 text-[14px]">
                        {c.items.map((it, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            {it.href ? (
                              <Link href={it.href} className="link truncate">
                                {it.label}
                              </Link>
                            ) : (
                              <span className="truncate">{it.label}</span>
                            )}
                            {it.detail && <span className="shrink-0 text-[12.5px] text-label-2 tabular-nums">{it.detail}</span>}
                          </li>
                        ))}
                      </ul>
                      {c.count > c.items.length && <div className="mt-1 text-[12.5px] text-label-2">…and {c.count - c.items.length} more</div>}
                    </div>
                  )}
                  {(c.note || c.href) && (
                    <div className="mt-3 ml-8 flex items-center justify-between gap-3 text-[12.5px] text-label-2">
                      <span>{c.note}</span>
                      {c.href && (
                        <Link href={c.href} className="inline-flex shrink-0 items-center gap-0.5 text-ink-blue hover:underline">
                          Details <Icon name="chevron-right" strokeWidth={2.4} className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  )}
                </Card>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
