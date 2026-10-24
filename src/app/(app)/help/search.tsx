"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";

export interface HelpEntry {
  href: string;
  title: string;
  topic: string;
  words: string;
}

/** Instant search across every topic and section of the guide. */
export function HelpSearch({ entries }: { entries: HelpEntry[] }) {
  const [q, setQ] = useState("");
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = terms.length ? entries.filter((e) => terms.every((t) => e.words.includes(t))).slice(0, 10) : [];
  return (
    <div className="relative w-full max-w-xl">
      <Icon name="search" strokeWidth={2} className="pointer-events-none absolute top-[19px] left-3.5 h-[18px] w-[18px] -translate-y-1/2 text-label-3" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the guide — e.g. overtime, lefty, pay slip, ছুটি"
        aria-label="Search the guide"
        className="input py-2.5 pl-10 text-[15px]"
      />
      {terms.length > 0 && (
        <div className="card absolute inset-x-0 top-full z-20 mt-2 max-h-[60vh] overflow-y-auto p-1.5">
          {hits.length ? (
            hits.map((h) => (
              <Link key={h.href} href={h.href} className="flex flex-col rounded-[10px] px-3 py-2 transition-colors hover:bg-fill-4">
                <span className="text-[14.5px] font-medium text-label">{h.title}</span>
                <span className="text-[12.5px] text-label-2">{h.topic}</span>
              </Link>
            ))
          ) : (
            <p className="px-3 py-3 text-[14px] text-label-2">Nothing found for &ldquo;{q}&rdquo;. Try a simpler word, or browse the topics below.</p>
          )}
        </div>
      )}
    </div>
  );
}
