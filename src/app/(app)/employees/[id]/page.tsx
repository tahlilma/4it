import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { ActionButton } from "@/components/form";
import { Icon, type IconName } from "@/components/icons";
import { SegmentedNav } from "@/components/segmented";
import { Alert, Avatar, Badge, Card, KV, List, ListRow, StatusBadge } from "@/components/ui";
import { can, requirePerm, type SessionUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { AGE_PROOF, EMP_TYPES, EMPLOYMENT_NATURE, GENDERS, label, MARITAL, PAYMENT_MODES, RELIGIONS, SEPARATION_TYPES, WEEKDAY_OPTS } from "@/lib/constants";
import { ageOn, addDays, dmy, eachDay, endOfMonth, hm, monthLabel, parseMonth, serviceSpan, spanText, stamp, startOfMonth, todayLocal, WEEKDAYS_SHORT, ymd } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { statusCode } from "@/lib/engine/attendance";
import { otRate } from "@/lib/engine/salary";
import { money } from "@/lib/num";
import { leaveBalances } from "@/lib/services/leave";
import { deleteNominee, removeTeamMember } from "../actions";
import { NomineeForm, PhotoUpload, TeamForm } from "./profile-forms";

const TABS = [
  ["overview", "Overview"],
  ["attendance", "Attendance"],
  ["leave", "Leave"],
  ["salary", "Salary & payslips"],
  ["nominees", "Nominees"],
  ["teams", "Safety teams"],
  ["documents", "Documents"],
  ["audit", "Audit trail"],
] as const;

export default async function EmployeeProfile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePerm("employee.view");
  const { id } = await params;
  const sp = await searchParams;
  const emp = await prisma.employee.findUnique({ where: { id: Number(id) }, include: EMP_INCLUDE });
  if (!emp) notFound();
  const company = await getCompany();
  const today = todayLocal(company.tzOffsetMinutes);
  const tab = (sp.tab ?? "overview") as (typeof TABS)[number][0];

  return (
    <div className="space-y-5">
      <div className="no-print">
        <Link href="/employees" className="-ml-1.5 inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-[15px] text-ink-blue transition-opacity active:opacity-50">
          <Icon name="chevron-left" strokeWidth={2.4} className="h-4 w-4" />
          Employees
        </Link>
        {/* Contact card */}
        <section className="flex flex-col items-center pt-2 text-center">
          <Avatar name={emp.nameEn} src={emp.photoPath ? `/api/photo/${emp.id}?v=${emp.updatedAt.getTime()}` : null} size={104} />
          <h1 data-title={emp.nameEn} className="mt-4 font-display text-[30px] leading-tight font-bold tracking-[-0.022em] text-label">
            {emp.nameEn}
          </h1>
          <div className="font-bn text-[16px] text-label-2">{emp.nameBn}</div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-[14px] text-label-2">
            <span className="tabular-nums">{emp.empCode}</span>
            <Dot />
            <span>{emp.designation.nameEn}</span>
            <Dot />
            <span>
              {emp.department.nameEn} / {emp.section.nameEn}
            </span>
            {emp.line && (
              <>
                <Dot />
                <span>{emp.line.nameEn}</span>
              </>
            )}
            <Dot />
            <span>Joined {dmy(emp.joinDate)}</span>
            <span className="ml-1.5">
              <StatusBadge status={emp.status} />
            </span>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {can(user, "employee.edit") && <ContactAction href={`/employees/${emp.id}/edit`} icon="edit" label="Edit" />}
            <ContactAction href={`/employees/${emp.id}?tab=documents`} icon="printer" label="Documents" />
            {can(user, "salary.view") && <ContactAction href={`/employees/${emp.id}?tab=salary`} icon="cash" label="Payslips" />}
            {can(user, "separation.manage") && emp.status === "ACTIVE" && <ContactAction href={`/separations/new?emp=${emp.empCode}`} icon="door" label="Separate" />}
          </div>
        </section>
      </div>
      {sp.created && <Alert tone="green">Employee created. Add a photo and nominees, then print the appointment letter and ID card.</Alert>}
      {sp.saved && <Alert tone="green">Changes saved.</Alert>}

      <div className="flex justify-center">
        <SegmentedNav active={tab} items={TABS.map(([k, l]) => ({ key: k, label: l, href: `/employees/${emp.id}?tab=${k}` }))} />
      </div>

      {tab === "overview" && <Overview emp={emp} user={user} today={today} otDivisor={company.otDivisor} otMultiplier={company.otMultiplier} />}
      {tab === "attendance" && <AttendanceTab empId={emp.id} month={sp.m} today={today} />}
      {tab === "leave" && <LeaveTab empId={emp.id} today={today} />}
      {tab === "salary" && <SalaryTab empId={emp.id} user={user} />}
      {tab === "nominees" && <NomineesTab empId={emp.id} user={user} />}
      {tab === "teams" && <TeamsTab empId={emp.id} user={user} />}
      {tab === "documents" && <DocumentsTab code={emp.empCode} separated={!!emp.separation} />}
      {tab === "audit" && <AuditTab empId={emp.id} tz={company.tzOffsetMinutes} />}
    </div>
  );
}

function Dot() {
  return <span aria-hidden className="text-label-3">·</span>;
}

/** Contacts-style action: glyph above label, in the accent colour. */
function ContactAction({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link
      href={href}
      className="press flex w-[92px] flex-col items-center gap-1 rounded-[14px] bg-surface py-2.5 text-[12px] font-medium text-ink-blue ring-1 ring-stone-900/[0.04] transition-[transform,background-color] duration-150 hover:bg-fill-4 active:scale-[0.96]"
    >
      <Icon name={icon} strokeWidth={2} className="h-5 w-5" />
      {label}
    </Link>
  );
}

const EMP_INCLUDE = {
  department: true, section: true, designation: true, grade: true, line: true, floor: true, machineType: true, shift: true,
  separation: true, devices: { include: { device: true } },
} satisfies Prisma.EmployeeInclude;
type Emp = Prisma.EmployeeGetPayload<{ include: typeof EMP_INCLUDE }>;

function addr(v: string, p: string, t: string, d: string) {
  return [v, p && `PO: ${p}`, t, d].filter(Boolean).join(", ");
}
function addrBn(v: string, p: string, t: string, d: string) {
  return [v && `গ্রামঃ ${v}`, p && `পোঃ ${p}`, t && `থানাঃ ${t}`, d && `জেলাঃ ${d}`].filter(Boolean).join(", ");
}

function Overview({ emp, user, today, otDivisor, otMultiplier }: { emp: Emp; user: SessionUser; today: Date; otDivisor: number; otMultiplier: number }) {
  const showSalary = can(user, "salary.view");
  const svc = serviceSpan(emp.joinDate, emp.separationDate ?? today);
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <div className="space-y-5 xl:col-span-2">
        <Card title="Personal">
          <KV
            cols={3}
            items={[
              ["Name (English)", emp.nameEn],
              ["নাম (বাংলা)", <span key="bn" className="font-bn">{emp.nameBn}</span>],
              ["Gender", label(GENDERS, emp.gender)],
              ["Father", emp.fatherEn],
              ["Mother", emp.motherEn],
              ["Spouse", emp.spouseEn],
              ["Date of birth", `${dmy(emp.dob)} (${ageOn(emp.dob, today)} yrs)`],
              ["Religion", label(RELIGIONS, emp.religion)],
              ["Marital status", label(MARITAL, emp.maritalStatus)],
              ["Blood group", emp.bloodGroup],
              ["NID", emp.nidNo],
              ["Age verified by", label(AGE_PROOF, emp.ageProofType)],
              ["Education", emp.educationEn],
              ["Height / weight", [emp.heightCm && `${emp.heightCm} cm`, emp.weightKg && `${emp.weightKg} kg`].filter(Boolean).join(" · ")],
              ["Children", emp.childrenCount],
              ["Mobile", emp.mobile],
              ["Emergency", [emp.emergencyName, emp.emergencyRelation, emp.emergencyPhone].filter(Boolean).join(" · ")],
              ["Identification mark", emp.identMarkEn],
            ]}
          />
        </Card>
        <Card title="Address">
          <KV
            cols={2}
            items={[
              ["Present", addr(emp.presVillageEn, emp.presPostEn, emp.presThanaEn, emp.presDistrictEn)],
              ["Permanent", addr(emp.permVillageEn, emp.permPostEn, emp.permThanaEn, emp.permDistrictEn)],
              ["বর্তমান ঠিকানা", <span key="p" className="font-bn">{addrBn(emp.presVillageBn, emp.presPostBn, emp.presThanaBn, emp.presDistrictBn)}</span>],
              ["স্থায়ী ঠিকানা", <span key="q" className="font-bn">{addrBn(emp.permVillageBn, emp.permPostBn, emp.permThanaBn, emp.permDistrictBn)}</span>],
            ]}
          />
        </Card>
        <Card title="Employment">
          <KV
            cols={3}
            items={[
              ["Designation", emp.designation.nameEn],
              ["Grade", emp.grade?.nameEn ?? ""],
              ["Type", label(EMP_TYPES, emp.empType)],
              ["Department", emp.department.nameEn],
              ["Section", emp.section.nameEn],
              ["Line / floor", [emp.line?.nameEn, emp.floor?.nameEn].filter(Boolean).join(" · ")],
              ["Machine type", emp.machineType?.nameEn ?? ""],
              ["Shift", emp.shift.name],
              ["Weekly holiday", emp.weeklyHoliday === null ? "Company default" : label(WEEKDAY_OPTS, String(emp.weeklyHoliday))],
              ["Joined", dmy(emp.joinDate)],
              ["Service", spanText(svc)],
              ["Class (s.4)", label(EMPLOYMENT_NATURE, emp.employmentNature)],
              ["Probation ends", dmy(emp.probationEnd)],
              ["Confirmed", dmy(emp.confirmDate)],
              ["OT eligible", emp.otEligible ? "Yes" : "No"],
            ]}
          />
          {emp.separation && (
            <div className="mt-4">
              <Alert tone="amber" title={`Separated — ${label(SEPARATION_TYPES, emp.separation.type)}`}>
                Last working day {dmy(emp.separation.effectiveDate)}. Settlement: {emp.separation.settlementStatus.toLowerCase()}.{" "}
                <Link className="link" href={`/separations/${emp.separation.id}`}>
                  Open settlement
                </Link>
              </Alert>
            </div>
          )}
        </Card>
      </div>
      <div className="space-y-5">
        <Card title="Photo">
          <div className="flex items-start gap-4">
            {emp.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/photo/${emp.id}?v=${emp.updatedAt.getTime()}`} alt="" className="h-36 w-[120px] shrink-0 rounded-[14px] object-cover" />
            ) : (
              <div className="flex h-36 w-[120px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[14px] bg-fill-4 text-[12px] text-label-2">
                <Icon name="user-circle" strokeWidth={1.4} className="h-9 w-9 text-label-3" /> No photo yet
              </div>
            )}
            {can(user, "employee.edit") && <PhotoUpload id={emp.id} />}
          </div>
        </Card>
        {showSalary && (
          <Card title="Salary">
            <KV
              cols={2}
              items={[
                ["Gross", <b key="g">{money(emp.gross)}</b>],
                ["Basic", money(emp.basic)],
                ["House rent", money(emp.houseRent)],
                ["Medical", money(emp.medical)],
                ["Transport", money(emp.transport)],
                ["Food", money(emp.food)],
                ["Other", money(emp.otherAllowance)],
                ["OT rate / hour", emp.otEligible ? money(otRate(emp.basic, { otDivisor, otMultiplier })) : "Not eligible"],
                ["Payment", label(PAYMENT_MODES, emp.paymentMode)],
                ["Account", emp.paymentMode === "BANK" ? `${emp.bankName} ${emp.bankAccountNo}` : emp.paymentMode === "MFS" ? `${emp.mfsProvider} ${emp.mfsNumber}` : ""],
                ["Effective since", dmy(emp.salaryEffective)],
              ]}
            />
          </Card>
        )}
        <Card title="Personal-file checklist">
          <ul className="space-y-2 text-[14px]">
            {(
              [
                ["Appointment letter (r.19)", emp.appointmentLetterDate],
                ["ID card — Form 6", emp.idCardIssueDate],
                ["Nominee — Form 41", emp.nomineeFormDate],
                ["Age & fitness — Form 15", emp.fitnessCertDate],
                ["Service book — Form 7", emp.serviceBookDate],
                ...(emp.gender === "FEMALE" ? ([["Night-work consent — Form 35", emp.nightConsentDate]] as [string, Date | null][]) : []),
              ] as [string, Date | null][]
            ).map(([l, d]) => (
              <li key={l} className="flex items-center justify-between gap-2">
                <span className="text-label">{l}</span>
                {d ? <Badge tone="green">{dmy(d)}</Badge> : <Badge tone="amber">Missing</Badge>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Punch machines">
          {emp.devices.length === 0 ? (
            <p className="text-[14px] text-ink-orange">Not enrolled on any device.</p>
          ) : (
            <ul className="space-y-1.5 text-[14px]">
              {emp.devices.map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span>{d.device.name}</span>
                  {d.removedAt ? <Badge>Removed {dmy(d.removedAt)}</Badge> : <Badge tone="green">Enrolled</Badge>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-label-2">Punch ID: <span className="tabular-nums">{emp.punchId}</span></p>
        </Card>
      </div>
    </div>
  );
}

async function AttendanceTab({ empId, month, today }: { empId: number; month?: string; today: Date }) {
  const pm = parseMonth(month) ?? { year: today.getUTCFullYear(), month: today.getUTCMonth() + 1 };
  const from = startOfMonth(pm.year, pm.month), to = endOfMonth(pm.year, pm.month);
  const days = await prisma.attendanceDay.findMany({ where: { employeeId: empId, date: { gte: from, lte: to } }, orderBy: { date: "asc" } });
  const byDate = new Map(days.map((d) => [ymd(d.date), d]));
  const prev = startOfMonth(pm.month === 1 ? pm.year - 1 : pm.year, pm.month === 1 ? 12 : pm.month - 1);
  const next = addDays(to, 1);
  const count = (s: string) => days.filter((d) => d.status === s).length;
  return (
    <Card
      title={`Attendance — ${monthLabel(pm.year, pm.month)}`}
      actions={
        <div className="flex gap-1">
          <Link className="btn btn-secondary btn-sm" href={`?tab=attendance&m=${ymd(prev).slice(0, 7)}`}>
            ←
          </Link>
          <Link className="btn btn-secondary btn-sm" href={`?tab=attendance&m=${ymd(next).slice(0, 7)}`}>
            →
          </Link>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        <Badge tone="green">Present {count("PRESENT") + count("LATE")}</Badge>
        <Badge tone="amber">Late {count("LATE")}</Badge>
        <Badge tone="red">Absent {count("ABSENT")}</Badge>
        <Badge tone="blue">Leave {count("LEAVE")}</Badge>
        <Badge>OT {days.reduce((s, d) => s + d.otHours, 0)} h</Badge>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="px-1 py-1 text-center text-[12px] font-semibold text-label-2">
            {w}
          </div>
        ))}
        {Array.from({ length: from.getUTCDay() }).map((_, i) => (
          <div key={`x${i}`} />
        ))}
        {eachDay(from, to).map((date) => {
          const d = byDate.get(ymd(date));
          const code = d ? statusCode(d) : "";
          const tone = !d ? "bg-fill-4 text-label-3" : d.status === "ABSENT" ? "bg-hue-red/12 text-ink-red" : d.status === "LEAVE" ? "bg-hue-blue/12 text-ink-blue" : d.status === "OFF" ? "bg-fill-3 text-label-2" : d.status === "LATE" ? "bg-hue-orange/14 text-ink-orange" : "bg-hue-green/14 text-ink-green";
          return (
            <div key={ymd(date)} className={`min-h-16 rounded-[10px] p-1.5 tabular-nums ${tone}`}>
              <div className="flex justify-between">
                <span className="font-semibold">{date.getUTCDate()}</span>
                <span className="font-bold">{code}</span>
              </div>
              {d?.inTime && <div>{hm(d.inTime)}–{hm(d.outTime)}</div>}
              {d && d.otHours > 0 && <div>OT {d.otHours}h</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12.5px] text-label-2">P present · L late · A absent · W weekly holiday · H holiday · WP/HP worked on a holiday · leave codes (CL, SL, EL, ML…)</p>
    </Card>
  );
}

async function LeaveTab({ empId, today }: { empId: number; today: Date }) {
  const year = today.getUTCFullYear();
  const [balances, apps] = await Promise.all([
    leaveBalances(prisma, [empId], year, today),
    prisma.leaveApplication.findMany({ where: { employeeId: empId }, include: { leaveType: true }, orderBy: { fromDate: "desc" }, take: 50 }),
  ]);
  const b = balances.get(empId) ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={`Leave balance ${year}`} bodyClass="p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Leave</th>
              <th className="text-right">Entitled / earned</th>
              <th className="text-right">Availed</th>
              <th className="text-right">Encashed</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {b.map((x) => (
              <tr key={x.code}>
                <td>
                  {x.nameEn}
                  {x.accrual === "EARNED" && !x.eligible && <div className="text-[12.5px] text-ink-orange">Available after 1 year of service</div>}
                </td>
                <td className="text-right tabular-nums">{x.accrual === "NONE" ? "—" : x.entitlement}</td>
                <td className="text-right tabular-nums">{x.availed}</td>
                <td className="text-right tabular-nums">{x.encashed || ""}</td>
                <td className="text-right font-medium tabular-nums">{x.accrual === "NONE" ? "—" : x.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Applications" bodyClass="p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Type</th>
              <th>From – to</th>
              <th className="text-right">Days</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>{a.leaveType.code}</td>
                <td>
                  {dmy(a.fromDate)} – {dmy(a.toDate)}
                </td>
                <td className="text-right">{a.days}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
            {apps.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-label-2">
                  No leave applications.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function SalaryTab({ empId, user }: { empId: number; user: SessionUser }) {
  if (!can(user, "salary.view")) return <Alert tone="amber">Salary information requires the salary.view permission.</Alert>;
  const [hist, slips] = await Promise.all([
    prisma.salaryHistory.findMany({ where: { employeeId: empId }, include: { designation: true, grade: true }, orderBy: { effectiveDate: "desc" } }),
    prisma.payslip.findMany({ where: { employeeId: empId }, include: { run: true, employee: { select: { empCode: true } } }, orderBy: [{ run: { year: "desc" } }, { run: { month: "desc" } }], take: 24 }),
  ]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card title="Salary history" bodyClass="overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Effective</th>
              <th>Type</th>
              <th>Designation / grade</th>
              <th className="text-right">Basic</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {hist.map((h) => (
              <tr key={h.id}>
                <td>{dmy(h.effectiveDate)}</td>
                <td>
                  <Badge tone={h.type === "JOINING" ? "slate" : h.type === "PROMOTION" ? "violet" : "blue"}>{h.type}</Badge>
                  {h.remarks && <div className="text-[12.5px] text-label-2">{h.remarks}</div>}
                </td>
                <td>
                  {h.designation?.nameEn}
                  <div className="text-[12.5px] text-label-2">{h.grade?.nameEn}</div>
                </td>
                <td className="text-right tabular-nums">{money(h.basic)}</td>
                <td className="text-right tabular-nums">{money(h.gross)}</td>
                <td className="text-right tabular-nums">{h.amount ? money(h.amount) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Payslips" bodyClass="overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Days paid</th>
              <th className="text-right">OT h</th>
              <th className="text-right">Net pay</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {slips.map((p) => (
              <tr key={p.id}>
                <td>
                  {monthLabel(p.run.year, p.run.month)} <StatusBadge status={p.run.status} />
                </td>
                <td className="text-right tabular-nums">{p.payableDays}</td>
                <td className="text-right tabular-nums">{p.otHours}</td>
                <td className="text-right font-medium tabular-nums">{money(p.netPayable, false)}</td>
                <td className="text-right">
                  <Link className="link text-xs" href={`/reports/pay-slip?month=${p.run.year}-${String(p.run.month).padStart(2, "0")}&emp=${p.employee.empCode}&run=1&status=ALL`}>
                    Pay slip
                  </Link>
                </td>
              </tr>
            ))}
            {slips.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-label-2">
                  No payslips yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function NomineesTab({ empId, user }: { empId: number; user: SessionUser }) {
  const nominees = await prisma.nominee.findMany({ where: { employeeId: empId }, orderBy: { id: "asc" } });
  const share = nominees.reduce((s, n) => s + n.sharePercent, 0);
  const editable = can(user, "employee.edit");
  return (
    <div className="space-y-5">
      {nominees.length > 0 && share !== 100 && <Alert tone="amber">Nominee shares add up to {share}% — they should total 100%.</Alert>}
      <Card title="Nominees (Form 41)" bodyClass="overflow-x-auto p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Relationship</th>
              <th>Age</th>
              <th>NID</th>
              <th>Address</th>
              <th className="text-right">Share</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {nominees.map((n) => (
              <tr key={n.id}>
                <td>
                  {n.nameEn}
                  <div className="font-bn text-[12.5px] text-label-2">{n.nameBn}</div>
                </td>
                <td>{n.relationEn}</td>
                <td>{n.age}</td>
                <td>{n.nidNo}</td>
                <td className="text-xs">{n.addressEn}</td>
                <td className="text-right">{n.sharePercent}%</td>
                <td className="text-right">{editable && <ActionButton action={deleteNominee} fields={{ id: n.id }} label="Remove" confirm="Remove this nominee?" />}</td>
              </tr>
            ))}
            {nominees.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-ink-orange">
                  No nominee recorded — Rule 118 requires a nomination at joining.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {editable && (
        <Card title="Add nominee">
          <NomineeForm employeeId={empId} />
        </Card>
      )}
    </div>
  );
}

async function TeamsTab({ empId, user }: { empId: number; user: SessionUser }) {
  const [members, teams] = await Promise.all([
    prisma.employeeTeam.findMany({ where: { employeeId: empId }, include: { team: true } }),
    prisma.team.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const editable = can(user, "employee.edit");
  return (
    <div className="space-y-5">
      <Card title="Safety team membership" bodyClass="p-0">
        <table className="tbl">
          <thead>
            <tr>
              <th>Team</th>
              <th>Role</th>
              <th>Training date</th>
              <th>Trained by</th>
              <th>Certificate</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.team.nameEn}</td>
                <td>{m.role === "LEADER" ? <Badge tone="violet">Leader</Badge> : "Member"}</td>
                <td>{dmy(m.trainingDate)}</td>
                <td>{m.trainedBy}</td>
                <td>{m.certificateNo}</td>
                <td className="text-right">{editable && <ActionButton action={removeTeamMember} fields={{ id: m.id }} label="Remove" confirm="Remove from this team?" />}</td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-label-2">
                  Not a member of any safety team.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      {editable && (
        <Card title="Add to a team">
          <TeamForm employeeId={empId} teams={teams.map((t) => ({ value: t.id, label: t.nameEn }))} />
        </Card>
      )}
    </div>
  );
}

function DocumentsTab({ code, separated }: { code: string; separated: boolean }) {
  const docs: [string, string, string][] = [
    ["job-application", "Job application letter", "চাকুরীর আবেদনপত্র"],
    ["appointment-letter", "Appointment letter", "নিয়োগপত্র"],
    ["fitness-certificate", "Age & fitness certificate (Form 15)", "বয়স ও সক্ষমতার প্রত্যয়নপত্র"],
    ["nominee-form", "Nominee form (Form 41)", "মনোনয়ন ফরম"],
    ["id-card", "ID card (Form 6) — Bangla & English", "পরিচয়পত্র"],
    ["confirmation-letter", "Confirmation letter", "চাকুরী স্থায়ীকরণ পত্র"],
    ["increment-letter", "Increment / promotion letter", "বেতন বৃদ্ধি / পদোন্নতি পত্র"],
    ["leave-application", "Leave application form", "ছুটির আবেদনপত্র"],
    ["service-book", "Service book (Form 7)", "সার্ভিস বহি"],
    ["leave-register", "Leave register / leave book (Form 9)", "ছুটির রেজিস্টার"],
    ["job-card", "Job card (monthly)", "জব কার্ড"],
    ["salary-history", "Salary history", "বেতন ইতিহাস"],
    ...(separated ? ([["final-settlement", "Final settlement bill", "চূড়ান্ত নিষ্পত্তি"]] as [string, string, string][]) : []),
  ];
  const half = Math.ceil(docs.length / 2);
  const row = ([slug, en, bn]: [string, string, string]) => (
    <ListRow
      key={slug}
      href={`/reports/${slug}?emp=${encodeURIComponent(code)}&run=1&status=ALL`}
      icon="document"
      color="blue"
      title={en}
      subtitle={<span className="font-bn">{bn}</span>}
      accessory={<span className="text-[14px] text-ink-blue">Print</span>}
    />
  );
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <List header="Personal File Documents">{docs.slice(0, half).map(row)}</List>
      <List header={<span className="max-lg:hidden">&nbsp;</span>}>{docs.slice(half).map(row)}</List>
    </div>
  );
}

async function AuditTab({ empId, tz }: { empId: number; tz: number }) {
  const logs = await prisma.auditLog.findMany({
    where: { entityId: String(empId), entity: { in: ["Employee", "Nominee", "EmployeeTeam", "Attendance", "Leave", "Separation"] } },
    orderBy: { at: "desc" },
    take: 100,
  });
  return (
    <Card title="Changes to this personal file" bodyClass="overflow-x-auto p-0">
      <table className="tbl">
        <thead>
          <tr>
            <th>When</th>
            <th>User</th>
            <th>Action</th>
            <th>Summary</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap text-xs">{stamp(l.at, tz)}</td>
              <td>{l.userName}</td>
              <td>
                <Badge>{l.action}</Badge>
              </td>
              <td className="text-xs">
                {l.summary}
                {l.changes && <div className="mt-0.5 max-w-xl truncate font-mono text-[10.5px] text-label-3">{l.changes}</div>}
              </td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-label-2">
                No recorded changes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
