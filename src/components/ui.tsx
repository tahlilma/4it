import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}

/* ── Hues, as literal class names so Tailwind can see them. Colour carries meaning. ── */

export type Hue = "blue" | "green" | "indigo" | "orange" | "pink" | "purple" | "red" | "teal" | "yellow" | "mint" | "cyan" | "brown" | "gray";

/** Solid fills (bars, dots). */
export const FILL: Record<Hue, string> = {
  blue: "bg-hue-blue",
  green: "bg-hue-green",
  indigo: "bg-hue-indigo",
  orange: "bg-hue-orange",
  pink: "bg-hue-pink",
  purple: "bg-hue-purple",
  red: "bg-hue-red",
  teal: "bg-hue-teal",
  yellow: "bg-hue-yellow",
  mint: "bg-hue-mint",
  cyan: "bg-hue-cyan",
  brown: "bg-hue-brown",
  gray: "bg-hue-gray",
};

/** Legible text in the colour. */
export const INK: Record<Hue, string> = {
  blue: "text-ink-blue",
  green: "text-ink-green",
  indigo: "text-ink-indigo",
  orange: "text-ink-orange",
  pink: "text-ink-pink",
  purple: "text-ink-purple",
  red: "text-ink-red",
  teal: "text-ink-teal",
  yellow: "text-ink-yellow",
  mint: "text-ink-mint",
  cyan: "text-ink-cyan",
  brown: "text-ink-brown",
  gray: "text-ink-gray",
};

/** Tinted background with matching text (badges, tiles, soft buttons). */
export const TINT: Record<Hue, string> = {
  blue: "bg-hue-blue/12 text-ink-blue",
  green: "bg-hue-green/13 text-ink-green",
  indigo: "bg-hue-indigo/12 text-ink-indigo",
  orange: "bg-hue-orange/14 text-ink-orange",
  pink: "bg-hue-pink/12 text-ink-pink",
  purple: "bg-hue-purple/12 text-ink-purple",
  red: "bg-hue-red/11 text-ink-red",
  teal: "bg-hue-teal/13 text-ink-teal",
  yellow: "bg-hue-yellow/18 text-ink-yellow",
  mint: "bg-hue-mint/13 text-ink-mint",
  cyan: "bg-hue-cyan/13 text-ink-cyan",
  brown: "bg-hue-brown/14 text-ink-brown",
  gray: "bg-fill-3 text-label-2",
};

/** Soft icon tile: a tinted square with the glyph in the same hue. */
export function Tile({ icon, color, size = 30, className }: { icon: IconName; color: Hue; size?: number; className?: string }) {
  const glyph = Math.round(size * 0.55);
  return (
    <span className={cx("tile", TINT[color], className)} style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}>
      <span className="flex" style={{ width: glyph, height: glyph }}>
        <Icon name={icon} strokeWidth={1.9} className="h-full w-full" />
      </span>
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  eyebrow?: ReactNode;
}) {
  return (
    <div className="no-print mb-7">
      {back && (
        <Link href={back.href} className="press -ml-1 mb-2 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[13.5px] font-medium text-label-2 transition-colors hover:text-ink-blue">
          <Icon name="chevron-left" strokeWidth={2.2} className="h-3.5 w-3.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow mb-1.5 text-ink-orange">{eyebrow}</div>}
          <h1 data-title={typeof title === "string" ? title : undefined} className="font-display text-[30px] leading-[1.12] font-semibold text-label sm:text-[34px]">
            {title}
          </h1>
          {subtitle && <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-label-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
  bodyClass,
  id,
  icon,
  tone,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  id?: string;
  icon?: IconName;
  tone?: Hue;
}) {
  const head = !!(title || actions);
  return (
    <section id={id} className={cx("card", className)}>
      {head && (
        <div className="card-h">
          <h2 className="flex items-center gap-2.5 text-[15.5px] leading-6 font-semibold tracking-[-0.01em] text-label">
            {icon && <Tile icon={icon} color={tone ?? "blue"} size={26} />}
            {title}
          </h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClass ?? (head ? "px-5 pb-5" : "p-5")}>{children}</div>
    </section>
  );
}

/** Section heading above a group, in small caps. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx("eyebrow mb-2 px-1 text-label-3", className)}>{children}</h2>;
}

/* ── Grouped lists ── */

export function List({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {header && <SectionLabel>{header}</SectionLabel>}
      <div className="card">{children}</div>
      {footer && <p className="mt-2 px-1 text-[12.5px] leading-snug text-label-2">{footer}</p>}
    </section>
  );
}

export function ListRow({
  href,
  icon,
  color = "gray",
  title,
  subtitle,
  detail,
  accessory,
  chevron,
  className,
}: {
  href?: string;
  icon?: IconName;
  color?: Hue;
  title: ReactNode;
  subtitle?: ReactNode;
  detail?: ReactNode;
  accessory?: ReactNode;
  chevron?: boolean;
  className?: string;
}) {
  const showChevron = chevron ?? !!href;
  const inset = icon ? 62 : 16;
  const body = (
    <>
      {icon && <Tile icon={icon} color={color} />}
      <span className="min-w-0 flex-1 py-0.5">
        <span className="block text-[14.5px] leading-5 font-medium text-label">{title}</span>
        {subtitle && <span className="mt-0.5 block text-[12.5px] leading-[18px] text-label-2">{subtitle}</span>}
      </span>
      {accessory}
      {detail !== undefined && detail !== null && <span className="shrink-0 text-[14px] text-label-2 tabular-nums">{detail}</span>}
      {showChevron && <Icon name="chevron-right" strokeWidth={2.2} className="h-3.5 w-3.5 shrink-0 text-label-3 transition-transform duration-150 group-hover:translate-x-0.5" />}
    </>
  );
  const cls = cx(
    "group relative flex min-h-12 items-center gap-3 px-4 py-2.5",
    "before:absolute before:top-0 before:right-0 before:left-[var(--inset)] before:h-px before:bg-sep first:before:hidden",
    href && "transition-colors hover:bg-fill-4 active:bg-fill-3",
    className,
  );
  const style = { "--inset": `${inset}px` } as CSSProperties;
  return href ? (
    <Link href={href} className={cls} style={style}>
      {body}
    </Link>
  ) : (
    <div className={cls} style={style}>
      {body}
    </div>
  );
}

/* ── Badges ── */

const TONES = {
  slate: TINT.gray,
  blue: TINT.blue,
  green: TINT.green,
  amber: TINT.orange,
  red: TINT.red,
  violet: TINT.purple,
  pink: TINT.pink,
} as const;
export type Tone = keyof typeof TONES;
const TONE_HUE: Record<Tone, Hue> = { slate: "gray", blue: "blue", green: "green", amber: "orange", red: "red", violet: "purple", pink: "pink" };

export function Badge({ tone = "slate", children, title, dot = false }: { tone?: Tone; children: ReactNode; title?: string; dot?: boolean }) {
  return (
    <span className={cx("badge", TONES[tone])} title={title}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "green", PRESENT: "green", APPROVED: "green", PAID: "green", LOCKED: "violet", POSTED: "violet", APPLIED: "violet",
  PROCESSED: "blue", CALCULATED: "blue", ON_LEAVE: "blue", PROPOSED: "amber", PENDING: "amber", DRAFT: "slate", OPEN: "amber",
  LATE: "amber", LEAVE: "blue", OFF: "slate", ABSENT: "red", REJECTED: "red", SEPARATED: "red", CANCELLED: "slate", CLOSED: "slate",
  REJOINED: "green",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? "slate"} dot>
      {label ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </Badge>
  );
}

/* ── Summary figure ── */

export function Stat({
  label,
  value,
  sub,
  tone = "slate",
  href,
  icon,
  unit,
  meta,
  meter,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  href?: string;
  icon?: IconName;
  unit?: ReactNode;
  meta?: ReactNode;
  /** 0–100: draws a thin progress track under the figure. */
  meter?: number;
}) {
  const h = TONE_HUE[tone];
  const body = (
    <div className={cx("card flex h-full flex-col p-4", href && "transition-[transform,box-shadow] duration-200 ease-out group-hover:-translate-y-0.5")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-label-2">{label}</div>
          {meta && <div className="text-[12px] text-label-3">{meta}</div>}
        </div>
        {icon && <Tile icon={icon} color={h} size={30} />}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[28px] leading-none font-semibold tracking-[-0.025em] text-label tabular-nums">{value}</span>
        {unit && <span className="text-[13px] font-medium text-label-2">{unit}</span>}
      </div>
      {sub && <div className="mt-1.5 text-[12.5px] leading-snug text-label-2">{sub}</div>}
      {meter !== undefined && (
        <div className="mt-auto pt-3">
          <div className="h-1 overflow-hidden rounded-full bg-fill-3">
            <div className={cx("h-full rounded-full", FILL[h])} style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} />
          </div>
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="group block h-full rounded-[16px]">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ── Content unavailable ── */

export function Empty({ title, children, icon = "folder" }: { title: string; children?: ReactNode; icon?: IconName }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <Tile icon={icon} color="gray" size={48} />
      <p className="mt-4 font-display text-[21px] font-semibold text-label">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-[14.5px] leading-relaxed text-label-2">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "blue", title, children }: { tone?: "blue" | "green" | "amber" | "red"; title?: ReactNode; children?: ReactNode }) {
  const look = {
    blue: { box: "bg-hue-blue/8 ring-hue-blue/15", icon: "info" as const, ink: "text-ink-blue" },
    green: { box: "bg-hue-green/9 ring-hue-green/18", icon: "check-circle" as const, ink: "text-ink-green" },
    amber: { box: "bg-hue-orange/10 ring-hue-orange/22", icon: "warning" as const, ink: "text-ink-orange" },
    red: { box: "bg-hue-red/8 ring-hue-red/18", icon: "x-circle" as const, ink: "text-ink-red" },
  }[tone];
  return (
    <div className={cx("flex gap-2.5 rounded-[12px] px-4 py-3 text-[14px] leading-snug text-label ring-1 ring-inset", look.box)}>
      <Icon name={look.icon} strokeWidth={2} className={cx("mt-px h-[18px] w-[18px] shrink-0", look.ink)} />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? "mt-0.5 text-label-2" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function KV({ items, cols = 2 }: { items: [ReactNode, ReactNode][]; cols?: 1 | 2 | 3 | 4 }) {
  const grid = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[cols];
  return (
    <dl className={cx("grid grid-cols-1 gap-x-6 gap-y-4", grid)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[12.5px] text-label-2">{k}</dt>
          <dd className="mt-0.5 truncate text-[14.5px] text-label">{v === "" || v === null || v === undefined ? <span className="text-label-3">—</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
  size,
  target,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm";
  target?: string;
}) {
  return (
    <Link href={href} target={target} className={cx("btn", `btn-${variant}`, size === "sm" && "btn-sm")}>
      {children}
    </Link>
  );
}

/* ── Avatar ── */

const AVATAR_HUES: Hue[] = ["blue", "purple", "orange", "teal", "pink", "green", "brown", "indigo"];

export function initials(name: string): string {
  const words = name.replace(/^(md\.?|mst\.?|mohammad|mohammed)\s+/i, "").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Round avatar: the photo when there is one, otherwise softly tinted initials (stable per name). */
export function Avatar({ name, src, size = 36, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" style={style} className={cx("shrink-0 rounded-full object-cover ring-1 ring-stone-900/10", className)} />;
  }
  const hash = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  return (
    <span style={style} className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.02em]", TINT[AVATAR_HUES[hash % AVATAR_HUES.length]], className)}>
      {initials(name)}
    </span>
  );
}

/** Simple pager driven by ?page= */
export function Pager({ page, pages, makeHref }: { page: number; pages: number; makeHref: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="no-print flex items-center justify-between border-t border-sep px-4 py-2.5 text-[13px] text-label-2">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-1">
        {page > 1 && (
          <Link className="btn btn-ghost btn-sm" href={makeHref(page - 1)}>
            <Icon name="chevron-left" strokeWidth={2.2} className="h-3 w-3" /> Previous
          </Link>
        )}
        {page < pages && (
          <Link className="btn btn-ghost btn-sm" href={makeHref(page + 1)}>
            Next <Icon name="chevron-right" strokeWidth={2.2} className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
