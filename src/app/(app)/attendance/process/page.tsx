import { Alert, Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { addDays, parseDate, todayLocal, ymd } from "@/lib/dates";
import { refOptions } from "@/lib/refs";
import { ProcessForm } from "../forms";

export default async function ProcessPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("attendance.process");
  const sp = await searchParams;
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const from = parseDate(sp.from) ?? addDays(today, -1);
  const to = parseDate(sp.to) ?? today;
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Process attendance" subtitle="Rebuild daily attendance from machine punches, approved leave and manual adjustments." />
      <Card>
        <ProcessForm from={ymd(from)} to={ymd(to)} departments={await refOptions("departments")} />
      </Card>
      <Alert tone="blue" title="How processing works">
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Machine punches are never edited. Each run recalculates status, late, early-out, working hours, OT, tiffin and night bills from the raw punches.</li>
          <li>Punches belong to a date from {Math.round(240 / 60)} hours before shift start for 24 hours, so night shifts that end after midnight are counted correctly.</li>
          <li>Approved leave and manual adjustments (with their reasons) are applied; weekly and festival holidays come from the policy and holiday calendar.</li>
          <li>Months with a locked payroll cannot be re-processed, so paid wages always match the attendance records.</li>
        </ul>
      </Alert>
    </div>
  );
}
