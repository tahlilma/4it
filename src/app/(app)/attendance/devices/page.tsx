import Link from "next/link";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { stamp } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { int } from "@/lib/num";
import { DeviceActions } from "../forms";

export default async function DevicesPage() {
  await requirePerm("device.manage");
  const company = await getCompany();
  const devices = await prisma.device.findMany({ orderBy: { name: "asc" } });
  const stats = await Promise.all(
    devices.map(async (d) => ({
      enrolled: await prisma.employeeDevice.count({ where: { deviceId: d.id, removedAt: null, employee: { status: "ACTIVE" } } }),
      due: await prisma.employee.count({ where: { status: "ACTIVE", devices: { none: { deviceId: d.id, removedAt: null } } } }),
      toRemove: await prisma.employee.count({ where: { status: "SEPARATED", devices: { some: { deviceId: d.id, removedAt: null } } } }),
      punches: await prisma.punchLog.count({ where: { deviceId: d.id } }),
    })),
  );
  return (
    <div className="space-y-5">
      <PageHeader
        title="Punch machines"
        subtitle="ZKTeco-compatible devices over TCP/IP (port 4370). Pull punches, enrol new joiners and remove separated employees."
        actions={
          <Link href="/setup/devices" className="btn btn-secondary">
            Add / edit devices
          </Link>
        }
      />
      <Alert tone="blue">
        For automatic sync, schedule <code className="rounded bg-fill-3 px-1">npm run device:sync</code> with Windows Task Scheduler (e.g. every 30 minutes). Separated employees should be removed from every device on their last day (C-TPAT access control).
      </Alert>
      <div className="grid gap-5 lg:grid-cols-2">
        {devices.map((d, i) => (
          <Card
            key={d.id}
            title={
              <span className="flex items-center gap-2">
                {d.name} {d.active ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
              </span>
            }
          >
            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <div className="text-stone-500">Address</div>
              <div className="font-mono text-xs">
                {d.ip}:{d.port}
              </div>
              <div className="text-stone-500">Location</div>
              <div>{d.location}</div>
              <div className="text-stone-500">Enrolled (active staff)</div>
              <div>{int(stats[i].enrolled)}</div>
              <div className="text-stone-500">Awaiting enrolment</div>
              <div>{stats[i].due ? <Badge tone="amber">{stats[i].due}</Badge> : 0}</div>
              <div className="text-stone-500">Separated, still enrolled</div>
              <div>{stats[i].toRemove ? <Badge tone="red">{stats[i].toRemove}</Badge> : 0}</div>
              <div className="text-stone-500">Punches stored</div>
              <div>{int(stats[i].punches)}</div>
              <div className="text-stone-500">Last sync</div>
              <div className="text-xs">
                {stamp(d.lastSyncAt, company.tzOffsetMinutes) || "never"}
                {d.lastSyncNote && <div className="text-stone-500">{d.lastSyncNote}</div>}
              </div>
            </div>
            <DeviceActions deviceId={d.id} />
          </Card>
        ))}
      </div>
      {devices.length === 0 && <Alert tone="amber">No devices configured yet.</Alert>}
    </div>
  );
}
