import { Suspense } from "react";
import { RequireUser } from "@/components/auth/require-user";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RequireUser allowUnfinishedOnboarding>{children}</RequireUser>
    </Suspense>
  );
}
