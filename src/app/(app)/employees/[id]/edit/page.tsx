import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { EmployeeForm } from "../../employee-form";
import { employeeFormOptions, toFormValues } from "../../form-data";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePerm("employee.edit");
  const { id } = await params;
  const emp = await prisma.employee.findUnique({ where: { id: Number(id) } });
  if (!emp) notFound();
  const { options, policy } = await employeeFormOptions();
  return (
    <div className="max-w-6xl">
      <PageHeader title={`Edit ${emp.nameEn}`} subtitle={`ID ${emp.empCode}`} back={{ href: `/employees/${emp.id}`, label: "Profile" }} />
      <EmployeeForm values={toFormValues(emp)} options={options} policy={policy} salaryEditable={can(user, "salary.edit")} isNew={false} />
    </div>
  );
}
