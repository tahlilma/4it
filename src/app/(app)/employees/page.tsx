import Link from "next/link";
import { EmpFilterBar } from "@/components/emp-filters";
import { Icon } from "@/components/icons";
import { Avatar, Card, LinkButton, PageHeader, Pager, StatusBadge } from "@/components/ui";
import { can, requirePerm } from "@/lib/auth";
import { dmy } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { EMP_ORDER, employeeWhere, parseEmpFilter, qs, str, type SP } from "@/lib/employee-filter";
import { int, money } from "@/lib/num";

const PAGE = 50;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePerm("employee.view");
  const sp = await searchParams;
  const where = employeeWhere(parseEmpFilter(sp));
  const page = Math.max(1, Number(str(sp.page)) || 1);
  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: EMP_ORDER,
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { designation: true, section: true, department: true, line: true },
    }),
  ]);
  const showSalary = can(user, "salary.view");
  return (
    <div className="space-y-5">
      <PageHeader
        title="Employees"
        subtitle={`${int(total)} matching employees`}
        actions={
          <>
            {can(user, "reports.hr") && <LinkButton href={`/reports/all-employees${qs(sp, { page: null, run: 1 })}`}>Employee Report</LinkButton>}
            {can(user, "employee.edit") && (
              <LinkButton href="/employees/new" variant="primary">
                <Icon name="plus" strokeWidth={2.2} className="h-4 w-4" /> New Employee
              </LinkButton>
            )}
          </>
        }
      />
      <EmpFilterBar sp={sp} action="/employees" />
      <Card bodyClass="overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Designation</th>
              <th>Department / Section</th>
              <th>Line</th>
              <th>Joined</th>
              {showSalary && <th className="text-right">Gross</th>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="text-label-2 tabular-nums">
                  <Link href={`/employees/${e.id}`} className="hover:text-ink-blue">
                    {e.empCode}
                  </Link>
                </td>
                <td>
                  <Link href={`/employees/${e.id}`} className="group flex items-center gap-3">
                    <Avatar name={e.nameEn} src={e.photoPath ? `/api/photo/${e.id}?v=${e.updatedAt.getTime()}` : null} size={32} />
                    <span className="min-w-0">
                      <span className="block font-medium text-label group-hover:text-ink-blue">{e.nameEn}</span>
                      <span className="block font-bn text-[12.5px] text-label-2">{e.nameBn}</span>
                    </span>
                  </Link>
                </td>
                <td>{e.designation.nameEn}</td>
                <td>
                  {e.department.nameEn}
                  <div className="text-[12.5px] text-label-2">{e.section.nameEn}</div>
                </td>
                <td>{e.line?.nameEn ?? ""}</td>
                <td className="whitespace-nowrap">{dmy(e.joinDate)}</td>
                {showSalary && <td className="text-right tabular-nums">{money(e.gross, false)}</td>}
                <td>
                  <StatusBadge status={e.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[15px] text-label-2">
                  No employees match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <Pager page={page} pages={Math.ceil(total / PAGE)} makeHref={(p) => `/employees${qs(sp, { page: p })}`} />
      </Card>
    </div>
  );
}
