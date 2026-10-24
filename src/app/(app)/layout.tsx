import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MemberGate, ViewerProvider } from "@/components/auth/member-gate";
import { isMember } from "@/lib/auth/session";
import Loading from "./loading";

/** Browse pages (feed, discover, profiles) are open to guests; member-only pages live in (member). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // Not awaited: the shell prerenders and the session check streams in.
    <ViewerProvider signedIn={isMember()}>
      <AppShell>
        <Suspense fallback={<Loading />}>
          <MemberGate>{children}</MemberGate>
        </Suspense>
      </AppShell>
    </ViewerProvider>
  );
}
