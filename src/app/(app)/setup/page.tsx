import { List, ListRow, PageHeader, type Hue } from "@/components/ui";
import type { IconName } from "@/components/icons";
import { can, requirePerm } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MASTERS } from "@/lib/masters";

const LOOK: Record<string, [IconName, Hue]> = {
  departments: ["building", "blue"],
  sections: ["list", "cyan"],
  floors: ["layers", "indigo"],
  lines: ["chart", "purple"],
  "machine-types": ["cog", "gray"],
  designations: ["users", "orange"],
  grades: ["tag", "green"],
  shifts: ["clock", "indigo"],
  holidays: ["sun", "orange"],
  "leave-types": ["calendar", "purple"],
  teams: ["flame", "red"],
  buyers: ["globe", "teal"],
  devices: ["device", "red"],
  "bank-accounts": ["bank", "brown"],
  manpower: ["trending", "mint"],
};

const SECTIONS: { header: string; keys: string[] }[] = [
  { header: "Organisation", keys: ["departments", "sections", "floors", "lines", "machine-types", "designations"] },
  { header: "Pay & Time", keys: ["grades", "shifts", "holidays", "leave-types"] },
  { header: "Compliance & Devices", keys: ["teams", "buyers", "devices", "bank-accounts", "manpower"] },
];

export default async function SetupIndex() {
  const user = await requirePerm("setup.manage");
  const counts = await Promise.all(MASTERS.map((m) => (prisma as unknown as Record<string, { count: () => Promise<number> }>)[m.model].count()));
  const byKey = new Map(MASTERS.map((m, i) => [m.key, { m, n: counts[i] }]));
  const rest = MASTERS.filter((m) => !SECTIONS.some((s) => s.keys.includes(m.key)));
  const sections = rest.length ? [...SECTIONS, { header: "Other", keys: rest.map((m) => m.key) }] : SECTIONS;
  return (
    <div>
      <PageHeader title="Master Data" subtitle="Organisation structure, wage grades, shifts, holidays, leave rules, safety teams and devices." />
      <div className="grid items-start gap-7 xl:grid-cols-2">
        <div className="space-y-7">
          <List header="Company">
            <ListRow href="/setup/company" icon="building" color="gray" title="Company & Payroll Policy" subtitle="Name, address, wage rules, overtime and holidays" />
            {can(user, "users.manage") && <ListRow href="/setup/users" icon="user-circle" color="gray" title="Users & Roles" subtitle="Who can sign in, and what they can do" />}
          </List>
          {sections.slice(0, 1).map((s) => (
            <Section key={s.header} header={s.header} keys={s.keys} byKey={byKey} />
          ))}
        </div>
        <div className="space-y-7">
          {sections.slice(1).map((s) => (
            <Section key={s.header} header={s.header} keys={s.keys} byKey={byKey} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Section({ header, keys, byKey }: { header: string; keys: string[]; byKey: Map<string, { m: (typeof MASTERS)[number]; n: number }> }) {
  const rows = keys.map((k) => byKey.get(k)).filter((x) => !!x);
  if (!rows.length) return null;
  return (
    <List header={header}>
      {rows.map(({ m, n }) => {
        const [icon, color] = LOOK[m.key] ?? ["list", "gray"];
        return <ListRow key={m.key} href={`/setup/${m.key}`} icon={icon} color={color} title={m.title} subtitle={<span className="line-clamp-2">{m.description}</span>} detail={n} />;
      })}
    </List>
  );
}
