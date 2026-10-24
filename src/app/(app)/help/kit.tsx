import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx, type Hue } from "@/components/ui";
import type { CompanyRow } from "@/lib/company";

/** Everything a help topic may need to tailor its text to this factory. */
export interface HelpCtx {
  company: CompanyRow;
  shifts: {
    code: string;
    name: string;
    inTime: string;
    outTime: string;
    lateGraceMin: number;
    breakMinutes: number;
    otStartAfterMin: number;
    otRoundUnitMin: number;
    otRoundUpMin: number;
    tiffinAfter: string;
    nightAfter: string;
  }[];
  leaveTypes: { code: string; nameEn: string; nameBn: string; annualDays: number; paid: boolean; accrual: string }[];
}

export interface HelpSection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface HelpTopic {
  slug: string;
  title: string;
  summary: string;
  icon: IconName;
  color: Hue;
  /** Extra words people might search for. */
  keywords?: string;
  sections: (ctx: HelpCtx) => HelpSection[];
}

/* ── Text ── */

export function P({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("my-3.5 text-[15px] leading-[1.7] text-label", className)}>{children}</p>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-7 mb-1 text-[16px] font-semibold tracking-[-0.01em] text-label">{children}</h3>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="my-3.5 space-y-2 pl-1 text-[15px] leading-[1.65] text-label [&>li]:relative [&>li]:pl-5 [&>li]:before:absolute [&>li]:before:top-[0.7em] [&>li]:before:left-0.5 [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-hue-blue/60">{children}</ul>;
}

/** A term in bold, explained in the same line. */
export function Def({ term, children }: { term: ReactNode; children: ReactNode }) {
  return (
    <li>
      <b className="font-semibold">{term}</b> — {children}
    </li>
  );
}

/* ── Callouts ── */

const CALLOUT: Record<"plain" | "tip" | "law" | "warn" | "example", { title: string; icon: IconName; box: string; ink: string }> = {
  plain: { title: "In plain words", icon: "bulb", box: "bg-hue-blue/[0.06] ring-hue-blue/15", ink: "text-ink-blue" },
  tip: { title: "Tip", icon: "sparkle", box: "bg-hue-green/[0.07] ring-hue-green/18", ink: "text-ink-green" },
  law: { title: "What the law says", icon: "scale", box: "bg-hue-purple/[0.06] ring-hue-purple/15", ink: "text-ink-purple" },
  warn: { title: "Watch out", icon: "warning", box: "bg-hue-orange/[0.08] ring-hue-orange/22", ink: "text-ink-orange" },
  example: { title: "Example", icon: "table", box: "bg-surface-2 ring-sep-strong", ink: "text-label-2" },
};

function Callout({ kind, title, children }: { kind: keyof typeof CALLOUT; title?: string; children: ReactNode }) {
  const c = CALLOUT[kind];
  return (
    <aside className={cx("my-5 rounded-[14px] px-4 py-3.5 ring-1 ring-inset", c.box)}>
      <div className={cx("flex items-center gap-2 text-[12px] font-semibold tracking-[0.08em] uppercase", c.ink)}>
        <Icon name={c.icon} strokeWidth={2} className="h-4 w-4" />
        {title ?? c.title}
      </div>
      <div className="mt-1.5 text-[14.5px] leading-[1.65] text-label [&_p]:my-2 [&_ul]:my-2">{children}</div>
    </aside>
  );
}

export const Plain = (p: { children: ReactNode; title?: string }) => <Callout kind="plain" {...p} />;
export const Tip = (p: { children: ReactNode; title?: string }) => <Callout kind="tip" {...p} />;
export const Law = (p: { children: ReactNode; title?: string }) => <Callout kind="law" {...p} />;
export const Warn = (p: { children: ReactNode; title?: string }) => <Callout kind="warn" {...p} />;
export const Example = (p: { children: ReactNode; title?: string }) => <Callout kind="example" {...p} />;

/* ── Steps: numbered, joined by a running stitch ── */

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="my-5 [counter-reset:step]">{children}</ol>;
}

export function Step({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <li className="relative pb-5 pl-11 [counter-increment:step] last:pb-0 before:absolute before:top-0 before:left-0 before:flex before:h-7 before:w-7 before:items-center before:justify-center before:rounded-full before:bg-hue-blue/12 before:text-[13px] before:font-semibold before:text-ink-blue before:content-[counter(step)] after:absolute after:top-8 after:bottom-1 after:left-[13px] after:border-l-[1.5px] after:border-dashed after:border-hue-blue/30 last:after:hidden">
      <div className="pt-0.5 text-[15px] leading-snug font-semibold text-label">{title}</div>
      {children && <div className="mt-1 text-[14.5px] leading-[1.65] text-label-2 [&_b]:text-label">{children}</div>}
    </li>
  );
}

/* ── Links into the app ── */

export function Goto({ href, children, icon = "arrow-right" }: { href: string; children: ReactNode; icon?: IconName }) {
  return (
    <Link
      href={href}
      className="mx-0.5 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 align-baseline text-[13.5px] font-medium text-ink-blue ring-1 ring-sep-strong ring-inset transition-colors hover:bg-hue-blue/[0.06]"
    >
      {children}
      <Icon name={icon} strokeWidth={2.2} className="h-3 w-3" />
    </Link>
  );
}

/** Shows the value this factory has configured, so the guide matches the app. */
export function Setting({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-baseline gap-1.5 rounded-md bg-hue-orange/10 px-2 py-px align-baseline text-[13.5px] text-ink-orange">
      <span className="text-[12px] font-medium opacity-80">{label}:</span>
      <b className="font-semibold">{value}</b>
    </span>
  );
}

/* ── Tables ── */

export function Rules({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="card my-5 overflow-x-auto">
      <table className="tbl text-[14px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "font-medium" : "text-label-2"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A worked calculation: each line is a label and an amount. */
export function Calc({ lines, total }: { lines: [ReactNode, ReactNode][]; total?: [ReactNode, ReactNode] }) {
  return (
    <div className="my-2 overflow-hidden rounded-[10px] bg-surface ring-1 ring-sep ring-inset">
      {lines.map(([l, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 border-b border-sep px-3.5 py-2 text-[14px] last:border-b-0">
          <span className="text-label-2">{l}</span>
          <span className="font-medium text-label tabular-nums">{v}</span>
        </div>
      ))}
      {total && (
        <div className="flex items-baseline justify-between gap-4 bg-hue-blue/[0.05] px-3.5 py-2.5 text-[14.5px]">
          <span className="font-semibold text-label">{total[0]}</span>
          <span className="font-semibold text-label tabular-nums">{total[1]}</span>
        </div>
      )}
    </div>
  );
}

/** Small bold code such as a status code or form number. */
export function Code({ children }: { children: ReactNode }) {
  return <span className="rounded-[5px] bg-fill-3 px-1.5 py-px text-[13px] font-semibold text-label tabular-nums">{children}</span>;
}

export function tk(n: number): string {
  return `Tk ${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
