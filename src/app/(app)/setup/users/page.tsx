import Link from "next/link";
import { Icon } from "@/components/icons";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { requirePerm } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { label, ROLES } from "@/lib/constants";
import { stamp } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { PERM_LABELS, ROLE_BLURBS } from "@/lib/perm-labels";
import { permsOf } from "@/lib/rbac";
import { EditUserForm, NewUserForm, OwnPasswordForm } from "./user-forms";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("users.manage");
  const sp = await searchParams;
  const company = await getCompany();
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { username: "asc" }] });
  const editing = sp.edit ? users.find((u) => u.id === Number(sp.edit)) : null;
  return (
    <div className="space-y-5">
      <PageHeader title="Users & Roles" subtitle="Each role grants a fixed set of permissions. Every sign-in and change is written to the audit log." />
      {sp.saved && <Alert tone="green">User updated.</Alert>}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card title={`${users.length} users`} className="xl:col-span-2" bodyClass="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Username</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="text-[13px] tabular-nums">{u.username}</td>
                  <td>{u.name}</td>
                  <td>{label(ROLES, u.role)}</td>
                  <td>{u.active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge>}</td>
                  <td className="text-xs text-stone-500">{stamp(u.lastLoginAt, company.tzOffsetMinutes) || "never"}</td>
                  <td className="text-right">
                    <Link href={`/setup/users?edit=${u.id}`} className="btn btn-secondary btn-sm">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-5">
          <Card title={editing ? `Edit ${editing.username}` : "New user"}>{editing ? <EditUserForm key={editing.id} user={editing} /> : <NewUserForm />}</Card>
          <Card title="My password">
            <OwnPasswordForm />
          </Card>
        </div>
      </div>
      <Card title="What each role can do">
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r.value}>
              <div className="text-[14.5px] font-semibold text-label">{r.en}</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-label-2">{ROLE_BLURBS[r.value]}</p>
              <ul className="mt-2 space-y-1 text-[13px] text-label">
                {permsOf(r.value).map((p) => (
                  <li key={p} className="flex gap-2">
                    <Icon name="check" strokeWidth={2.4} className="mt-[3px] h-3 w-3 shrink-0 text-ink-green" />
                    {PERM_LABELS[p]}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
