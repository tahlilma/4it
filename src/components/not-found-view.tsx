import Link from "next/link";
import { Icon } from "./icons";

/** Apple's "content unavailable" pattern: a quiet glyph, a plain title, a way out. */
export function NotFoundView() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <Icon name="search" strokeWidth={1.4} className="h-14 w-14 text-label-3" />
      <h1 className="mt-4 font-display text-[28px] leading-tight font-bold tracking-[-0.022em] text-label">Page Not Found</h1>
      <p className="mt-2 text-[15px] leading-snug text-label-2">The record may have been removed, or the link is mistyped.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link href="/employees" className="btn btn-secondary">
          Find an Employee
        </Link>
        <Link href="/" className="btn btn-primary">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
