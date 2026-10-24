import { Card, KV, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { label, ROLES } from "@/lib/constants";
import { PERM_LABELS, ROLE_BLURBS } from "@/lib/perm-labels";
import { permsOf } from "@/lib/rbac";
import { OwnPasswordForm } from "../setup/users/user-forms";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader title="My Account" subtitle="Your sign-in details, what your role lets you do, and your password." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card title="You">
            <KV
              cols={2}
              items={[
                ["Name", user.name],
                ["Username", user.username],
                ["Role", label(ROLES, user.role)],
              ]}
            />
            <p className="mt-4 text-[13px] leading-relaxed text-label-2">{ROLE_BLURBS[user.role]} Only an administrator can change your name or role.</p>
          </Card>
          <Card title="What you can do">
            <ul className="grid gap-x-6 gap-y-1.5 text-[14px] text-label sm:grid-cols-2">
              {permsOf(user.role).map((p) => (
                <li key={p} className="flex gap-2">
                  <Icon name="check" strokeWidth={2.4} className="mt-1 h-3.5 w-3.5 shrink-0 text-ink-green" />
                  {PERM_LABELS[p]}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title="Change my password">
          <p className="mb-4 text-[13px] leading-relaxed text-label-2">Use at least 8 characters with letters and numbers. Don&apos;t share your password — every change in the app is recorded under your name.</p>
          <OwnPasswordForm />
        </Card>
      </div>
    </div>
  );
}
