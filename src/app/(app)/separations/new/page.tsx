import { Alert, Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { todayLocal, ymd } from "@/lib/dates";
import { SeparationForm } from "../forms";

export default async function NewSeparationPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("separation.manage");
  const sp = await searchParams;
  const company = await getCompany();
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Record separation" subtitle="The settlement is calculated immediately from attendance, leave balance and advances." back={{ href: "/separations", label: "Separations" }} />
      <Card>
        <SeparationForm emp={sp.emp} today={ymd(todayLocal(company.tzOffsetMinutes))} />
      </Card>
      <Alert tone="blue" title="Statutory entitlements applied">
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>Resignation (s.27): permanent workers give 60 days&apos; notice (temporary 30), or wages for the shortfall are deducted; 14 days&apos; wages per year after 5 years, 30 days after 10 years.</li>
          <li>Unauthorised absence (s.27(3A)): use Lefty cases — three letters, then deemed resignation.</li>
          <li>Termination by employer (s.26): 120 days&apos; notice or wages in lieu (permanent), plus 30 days&apos; wages per completed year.</li>
          <li>Retrenchment (s.20) and discharge (s.22): 30 days&apos; wages per completed year. Death (s.19): 30 days (45 on duty) per year after 2 years, paid to the nominee.</li>
          <li>Unavailed earned leave is always paid (s.11).</li>
        </ul>
      </Alert>
    </div>
  );
}
