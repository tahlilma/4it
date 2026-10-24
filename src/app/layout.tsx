import type { Metadata, Viewport } from "next";
import { Fraunces, Hind_Siliguri, Instrument_Sans, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

// UI text: crisp, slightly technical, with tabular figures for payroll columns.
const sans = Instrument_Sans({ variable: "--font-ui", subsets: ["latin"] });
// Titles: a soft, tailored serif — the app's "voice".
const serif = Fraunces({ variable: "--font-serif", subsets: ["latin"], axes: ["opsz", "SOFT"] });
const hind = Hind_Siliguri({ variable: "--font-hind", subsets: ["bengali"], weight: ["400", "500", "600", "700"] });
// Formal Bangla face for printed letters and statutory forms.
const bengali = Noto_Sans_Bengali({ variable: "--font-bengali", subsets: ["bengali"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: { default: "HR & Payroll", template: "%s · HR & Payroll" },
  description: "HR, attendance and payroll for Bangladesh RMG factories — Labour Act 2006 / Labour Rules 2015 compliant.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0f1d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${hind.variable} ${bengali.variable} h-full`}>
      <body className="cotton min-h-full">{children}</body>
    </html>
  );
}
