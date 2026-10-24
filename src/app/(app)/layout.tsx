import { Suspense } from "react";
import { MobileNav, Sidebar, SidebarSkeleton } from "@/components/shell";
import { Toolbar } from "@/components/toolbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="no-print h-[52px]" />}>
          <Toolbar />
        </Suspense>
        <main className="page-in print-reset mx-auto w-full max-w-[1400px] flex-1 px-4 pt-1 pb-32 sm:px-6 lg:px-9 lg:pb-14">{children}</main>
      </div>
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
