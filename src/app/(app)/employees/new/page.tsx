import { PageHeader } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmployeeForm } from "../employee-form";
import { employeeFormOptions } from "../form-data";

export default async function NewEmployeePage() {
  const user = await requirePerm("employee.edit");
  const { options, policy } = await employeeFormOptions();
  const last = await prisma.employee.findFirst({ orderBy: { punchId: "desc" }, select: { punchId: true } });
  const next = (last?.punchId ?? 10000) + 1;
  return (
    <div className="max-w-6xl">
      <PageHeader title="New employee" subtitle="Personal file entry. Statutory checks: minimum hiring age, grade minimum wage, salary structure." back={{ href: "/employees", label: "Employees" }} />
      <EmployeeForm values={{ empCode: String(next), punchId: next }} options={options} policy={policy} salaryEditable isNew />
      {!can(user, "salary.edit") && <p className="mt-2 text-xs text-stone-500">After creation, salary changes require the salary.edit permission.</p>}
    </div>
  );
}
