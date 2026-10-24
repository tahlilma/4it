"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useId, useState } from "react";
import { cx } from "./ui";

/**
 * Segmented control whose segments are links. The thumb springs to the tapped segment right away;
 * the page catches up behind it.
 */
export function SegmentedNav({ items, active, className }: { items: { key: string; label: string; href: string }[]; active: string; className?: string }) {
  const id = useId();
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<{ key: string; from: string } | null>(null);
  const current = picked && picked.from === active ? picked.key : active;
  return (
    <LayoutGroup id={id}>
      <nav className={cx("no-print flex max-w-full overflow-x-auto rounded-[11px] bg-fill-3 p-[3px] ring-1 ring-inset ring-sep [scrollbar-width:none]", className)}>
        {items.map((it) => {
          const on = it.key === current;
          return (
            <Link
              key={it.key}
              href={it.href}
              scroll={false}
              onClick={() => setPicked({ key: it.key, from: active })}
              aria-current={on ? "page" : undefined}
              className={cx(
                "relative flex-1 rounded-[8px] px-3.5 py-[5px] text-center text-[13px] whitespace-nowrap transition-[color,opacity] duration-150 active:opacity-60",
                on ? "font-semibold text-label" : "font-medium text-label-2 hover:text-label",
              )}
            >
              {on && (
                <motion.span
                  layoutId="thumb"
                  transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.36 }}
                  className="absolute inset-0 bg-thumb shadow-[0_1px_2px_rgb(26_27_46/0.12),0_2px_8px_-2px_rgb(26_27_46/0.12)]"
                  style={{ borderRadius: 8 }}
                />
              )}
              <span className="relative">{it.label}</span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
