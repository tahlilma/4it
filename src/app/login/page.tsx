import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const POINTS = [
  "Attendance straight from the punch machines, processed daily",
  "Wages, overtime and bonuses under the Labour Act 2006",
  "Bangla letters and statutory forms, ready to print",
];

export default function LoginPage() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="denim relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Logo className="h-10 w-10" />
          <div>
            <div className="text-[15px] font-semibold text-side-ink">HR & Payroll</div>
            <div className="text-[12px] text-side-ink-2">for garment factories in Bangladesh</div>
          </div>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-[40px] leading-[1.08] font-semibold text-side-ink">
            Every worker, every hour, every taka — <span className="text-[#f2b35e] italic">on record.</span>
          </h1>
          <ul className="mt-8 space-y-3.5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[14.5px] leading-snug text-side-ink/85">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/[0.1] ring-1 ring-white/[0.14] ring-inset">
                  <Icon name="check" strokeWidth={2.6} className="h-3 w-3 text-[#f2b35e]" />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-8 font-bn text-[15px] text-side-ink-2">বাংলাদেশ শ্রম আইন ২০০৬ ও শ্রম বিধিমালা ২০১৫ অনুযায়ী</p>
        </div>
        <p className="text-[12px] text-side-ink-2">For BGMEA & BKMEA member factories · Labour Act 2006 · Labour Rules 2015</p>
      </aside>

      <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Logo className="h-10 w-10" />
            <div className="text-[15px] font-semibold text-label">HR & Payroll</div>
          </div>
          <h2 className="font-display text-[32px] leading-tight font-semibold text-label">Sign in</h2>
          <p className="mt-2 text-[14.5px] leading-relaxed text-label-2">Use the username and password your HR administrator gave you.</p>
          <div className="mt-8">
            <Suspense fallback={<div className="h-[200px]" />}>
              <LoginForm />
            </Suspense>
          </div>
          <p className="mt-8 text-[13px] text-label-2">
            Forgot your password? Ask your HR administrator to reset it from <span className="font-medium text-label">Users &amp; Roles</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
