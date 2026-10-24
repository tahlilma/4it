import { PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { POLICY_FIELDS, POLICY_SECTIONS } from "@/lib/policy-fields";
import { PolicyForm } from "./policy-form";

export default async function CompanyPage() {
  await requirePerm("setup.manage");
  const c = (await getCompany()) as unknown as Record<string, unknown>;
  const values = Object.fromEntries(
    POLICY_FIELDS.map((f) => [f.name, f.name === "weeklyHoliday" ? String(c[f.name]) : (c[f.name] as string | number | boolean | null)]),
  );
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Company & Payroll Policy"
        subtitle="Defaults follow the Bangladesh Labour Act 2006, Labour Rules 2015 and the RMG minimum-wage gazette. Changes apply to future processing and are recorded in the audit log."
        back={{ href: "/setup", label: "Master data" }}
      />
      <PolicyForm sections={POLICY_SECTIONS} values={values} />
    </div>
  );
}
