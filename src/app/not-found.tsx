import { Logo } from "@/components/logo";
import { NotFoundView } from "@/components/not-found-view";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <Logo className="h-11 w-11" />
      <NotFoundView />
    </main>
  );
}
