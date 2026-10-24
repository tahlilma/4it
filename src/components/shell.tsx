import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { can, getSessionUser } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { label, ROLES } from "@/lib/constants";
import { navFor } from "@/lib/nav";
import { Icon } from "./icons";
import { Logo } from "./logo";
import { MobileTabBar, SearchField, SidebarNav } from "./nav-links";
import { Avatar } from "./ui";

const PANEL = "fixed inset-y-2.5 left-2.5 z-40 flex w-[260px] flex-col overflow-hidden rounded-[20px] shadow-[0_18px_40px_-18px_rgb(13_15_29/0.55)]";

/** Indigo ("denim") sidebar, floating on the cotton canvas. The outer element reserves its width. */
export async function Sidebar() {
  const [user, company] = await Promise.all([getSessionUser(), getCompany()]);
  if (!user) return null;
  return (
    <aside className="no-print hidden w-[280px] shrink-0 lg:block">
      <div className={`${PANEL} denim`}>
        <Link href="/" className="flex items-center gap-3 px-4 pt-4 pb-3.5">
          <Logo className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-[14.5px] leading-tight font-semibold text-side-ink">{company.nameEn}</div>
            <div className="text-[11.5px] text-side-ink-2">HR & Payroll</div>
          </div>
        </Link>
        {can(user, "employee.view") && <SearchField tone="dark" className="px-3 pb-3" />}
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-4 [scrollbar-color:rgb(255_255_255/0.15)_transparent]">
          <SidebarNav groups={navFor(user.role)} />
        </div>
        <div className="flex items-center gap-2.5 border-t border-white/[0.08] bg-black/10 px-3 py-3">
          <Link href="/account" title="My account" className="-m-1.5 flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] p-1.5 transition-colors hover:bg-side-hover">
            <Avatar name={user.name} size={32} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[13px] font-semibold text-side-ink">{user.name}</div>
              <div className="truncate text-[11.5px] text-side-ink-2">{label(ROLES, user.role)}</div>
            </div>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex h-8 w-8 items-center justify-center rounded-[9px] text-side-ink-2 transition-colors hover:bg-side-hover hover:text-side-ink"
              title="Sign out"
              aria-label="Sign out"
            >
              <Icon name="logout" strokeWidth={1.9} className="h-[18px] w-[18px]" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function SidebarSkeleton() {
  return (
    <aside className="no-print hidden w-[280px] shrink-0 lg:block">
      <div className={`${PANEL} denim`} />
    </aside>
  );
}

/** Tab bar + "More" sheet (phones and tablets). */
export async function MobileNav() {
  const user = await getSessionUser();
  if (!user) return null;
  return <MobileTabBar groups={navFor(user.role)} user={{ name: user.name, role: label(ROLES, user.role) }} canSearch={can(user, "employee.view")} />;
}
