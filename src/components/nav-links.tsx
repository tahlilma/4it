"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/login/actions";
import { activeHref, TAB_HREFS, type NavGroup } from "@/lib/nav";
import { Icon } from "./icons";
import { Sheet } from "./sheet";
import { Avatar, cx, Tile } from "./ui";

/** Selection follows the click at once; the route catches up behind it. */
function useCurrent(hrefs: string[]) {
  const pathname = usePathname();
  const [pending, setPending] = useState<{ href: string; from: string } | null>(null);
  const current = pending && pending.from === pathname ? pending.href : activeHref(pathname, hrefs);
  const choose = (href: string) => setPending({ href, from: pathname });
  return { current, choose, pathname };
}

const GLIDE = { type: "spring", bounce: 0, duration: 0.38 } as const;

/** Sidebar navigation on the indigo panel; a cotton pill glides to the selected item. */
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const hrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const { current, choose } = useCurrent(hrefs);
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Main">
      {groups.map((g, gi) => (
        <div key={g.label} className={gi ? "mt-5" : ""}>
          <div className="eyebrow px-3 pb-1.5 text-[10.5px] text-side-ink-2">{g.label}</div>
          <ul className="space-y-px">
            {g.items.map((i) => {
              const active = current === i.href;
              return (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    onClick={() => choose(i.href)}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "relative flex items-center gap-3 rounded-[10px] px-3 py-[7px] text-[13.5px] transition-colors duration-150",
                      active ? "font-medium text-side-pill-ink" : "text-side-ink/85 hover:bg-side-hover hover:text-side-ink",
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="side-pill"
                        transition={reduce ? { duration: 0 } : GLIDE}
                        className="absolute inset-0 bg-side-pill shadow-[0_1px_2px_rgb(0_0_0/0.25),0_6px_16px_-8px_rgb(0_0_0/0.5)]"
                        style={{ borderRadius: 10 }}
                      />
                    )}
                    <Icon name={i.icon} strokeWidth={active ? 2 : 1.7} className={cx("relative h-[18px] w-[18px] shrink-0", active ? "text-[#4549cf]" : "text-side-ink-2")} />
                    <span className="relative truncate">{i.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Floating tab bar for phones; "More" opens the full menu as a sheet. */
export function MobileTabBar({ groups, user, canSearch }: { groups: NavGroup[]; user: { name: string; role: string }; canSearch: boolean }) {
  const items = groups.flatMap((g) => g.items);
  const tabs = TAB_HREFS.map((h) => items.find((i) => i.href === h)).filter((i) => !!i).slice(0, 4);
  const { current, choose, pathname } = useCurrent(items.map((i) => i.href));
  const reduce = useReducedMotion();
  const [more, setMore] = useState(false);
  // The menu sheet is mounted on first use (then kept, so it can animate both ways).
  const [menuMounted, setMenuMounted] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  if (more && openedAt !== pathname) setMore(false);
  const close = () => setMore(false);
  const onMore = !tabs.some((t) => t.href === current);

  const tabClass = (active: boolean) =>
    cx(
      "press relative flex flex-1 flex-col items-center gap-0.5 rounded-[18px] py-1.5 text-[10.5px] font-medium transition-[transform,color] duration-150 active:scale-[0.95]",
      active ? "text-side-pill-ink" : "text-side-ink-2",
    );
  const pill = (
    <motion.span
      layoutId="tab-pill"
      transition={reduce ? { duration: 0 } : GLIDE}
      className="absolute inset-0 bg-side-pill shadow-[0_1px_2px_rgb(0_0_0/0.3)]"
      style={{ borderRadius: 18 }}
    />
  );

  return (
    <>
      <nav aria-label="Tabs" className="no-print fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+10px)] z-40 lg:hidden">
        <div className="denim mx-auto flex max-w-md items-stretch rounded-[22px] p-1 shadow-[0_12px_32px_-10px_rgb(13_15_29/0.6)]">
          {tabs.map((t) => {
            const active = current === t.href;
            return (
              <Link key={t.href} href={t.href} onClick={() => choose(t.href)} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                {active && pill}
                <Icon name={t.icon} strokeWidth={active ? 2 : 1.7} className={cx("relative h-[21px] w-[21px]", active && "text-[#4549cf]")} />
                <span className="relative">{t.short ?? t.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setOpenedAt(pathname);
              setMenuMounted(true);
              setMore(true);
            }}
            aria-expanded={more}
            className={tabClass(onMore)}
          >
            {onMore && pill}
            <Icon name="grid" strokeWidth={onMore ? 2 : 1.7} className={cx("relative h-[21px] w-[21px]", onMore && "text-[#4549cf]")} />
            <span className="relative">More</span>
          </button>
        </div>
      </nav>

      {menuMounted && (
        <Sheet open={more} onClose={close} label="Menu">
          <div className="card mb-4 flex items-center gap-3 p-3">
            <Link href="/account" className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={user.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[16px] font-semibold text-label">{user.name}</div>
                <div className="text-[13px] text-label-2">{user.role} · My account</div>
              </div>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="btn btn-danger btn-sm" title="Sign out">
                Sign Out
              </button>
            </form>
          </div>
          {canSearch && <SearchField className="mb-5" />}
          <div className="space-y-5">
            {groups.map((g) => (
              <section key={g.label}>
                <h2 className="eyebrow mb-2 px-1 text-label-3">{g.label}</h2>
                <div className="card">
                  {g.items.map((i) => (
                    <Link
                      key={i.href}
                      href={i.href}
                      onClick={() => choose(i.href)}
                      style={{ "--inset": "58px" } as React.CSSProperties}
                      className={cx(
                        "relative flex min-h-12 items-center gap-3 px-4 py-2 transition-colors active:bg-fill-3",
                        "before:absolute before:top-0 before:right-0 before:left-[var(--inset)] before:h-px before:bg-sep first:before:hidden",
                      )}
                    >
                      <Tile icon={i.icon} color={i.color} size={30} />
                      <span className={cx("flex-1 text-[15px]", current === i.href ? "font-semibold text-ink-blue" : "text-label")}>{i.label}</span>
                      <Icon name="chevron-right" strokeWidth={2.2} className="h-3.5 w-3.5 text-label-3" />
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Employee search (ID, name, NID or mobile). `tone="dark"` sits on the indigo sidebar. */
export function SearchField({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <form action="/employees" method="get" role="search" className={className}>
      <div className="relative">
        <Icon name="search" strokeWidth={2} className={cx("pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2", tone === "dark" ? "text-side-ink-2" : "text-label-3")} />
        <input
          name="q"
          type="search"
          placeholder="Search employees"
          aria-label="Search employees"
          className={
            tone === "dark"
              ? "block w-full rounded-[10px] border-0 bg-white/[0.08] py-[7px] pr-3 pl-8 text-[16px] text-side-ink ring-1 ring-white/[0.08] transition placeholder:text-side-ink-2 focus:bg-white/[0.12] focus:ring-white/25 focus:outline-none sm:text-[13.5px]"
              : "input pl-8"
          }
        />
      </div>
    </form>
  );
}
