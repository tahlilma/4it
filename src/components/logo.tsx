/** App mark: a running-stitch checkmark on indigo — garment craft, done right. */
export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#5a61df" />
          <stop offset="1" stopColor="#272a6b" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10.5" fill="url(#logo-bg)" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10" fill="none" stroke="#fff" strokeOpacity="0.14" />
      <path d="M11.2 20.8l6.2 6.2L29 15.2" fill="none" stroke="#fff" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3.3 3.1" />
      <circle cx="29.4" cy="14.8" r="2.3" fill="#f5a33a" />
    </svg>
  );
}
