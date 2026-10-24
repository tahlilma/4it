import Link from "next/link";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { label, ROLES } from "@/lib/constants";

export default async function NoAccess({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { p } = await searchParams;
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <Icon name="lock" strokeWidth={1.4} className="h-14 w-14 text-label-3" />
      <h1 className="mt-4 font-display text-[28px] leading-tight font-bold tracking-[-0.022em] text-label">No Access</h1>
      <p className="mt-2 text-[15px] leading-snug text-label-2">
        Your role <b>{label(ROLES, user.role)}</b> does not include the permission <code className="rounded bg-fill-3 px-1 text-[13px]">{p ?? "?"}</code>. Ask an administrator if you need it.
      </p>
      <Link href="/" className="btn btn-primary mt-7">
        Go to Dashboard
      </Link>
    </div>
  );
}
