import { Suspense } from "react";
import { RequireUser } from "@/components/auth/require-user";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <RequireUser>{children}</RequireUser>
    </Suspense>
  );
}
