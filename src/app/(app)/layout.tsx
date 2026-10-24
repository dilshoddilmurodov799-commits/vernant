import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RequireUser } from "@/components/auth/require-user";
import Loading from "./loading";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<Loading />}>
        <RequireUser>{children}</RequireUser>
      </Suspense>
    </AppShell>
  );
}
