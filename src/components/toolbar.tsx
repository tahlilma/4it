"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { helpTopicFor } from "@/lib/help-map";
import { Icon } from "./icons";
import { cx } from "./ui";

/**
 * Top bar in the iOS manner: transparent at rest; once content scrolls under it, it turns to glass
 * and the page's large title slides up into it.
 */
export function Toolbar() {
  const pathname = usePathname();
  const [s, setS] = useState({ scrolled: false, show: false, title: "" });
  const help = helpTopicFor(pathname);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const h1 = document.querySelector<HTMLElement>("main h1");
      const scrolled = window.scrollY > 4;
      const show = !!h1 && h1.getBoundingClientRect().bottom < 56;
      const title = (h1?.dataset.title || h1?.textContent || "").trim();
      setS((p) => (p.scrolled === scrolled && p.show === show && p.title === title ? p : { scrolled, show, title }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    raf = requestAnimationFrame(read);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pathname]);

  return (
    <header className="no-print sticky top-0 z-30 h-[52px] shrink-0">
      <div
        aria-hidden
        className={cx(
          "material absolute inset-0 transition-opacity duration-200",
          "[mask-image:linear-gradient(to_bottom,black_70%,transparent)]",
          s.scrolled ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="relative flex h-full items-center justify-center px-16 lg:justify-start lg:px-9">
        <span
          className={cx(
            "truncate font-display text-[16px] font-semibold text-label transition-[opacity,transform] duration-200 ease-out",
            s.show ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
          )}
        >
          {s.title}
        </span>
        {help && (
          <Link
            href={`/help/${help}`}
            title="Help for this screen"
            aria-label="Help for this screen"
            className="absolute top-1/2 right-4 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-label-2 ring-1 ring-sep-strong ring-inset transition-colors hover:text-ink-blue sm:right-6 lg:right-9"
          >
            <Icon name="question" strokeWidth={1.9} className="h-[18px] w-[18px]" />
          </Link>
        )}
      </div>
    </header>
  );
}
