import { Suspense } from "react";
import { MemberGate, ViewerProvider } from "@/components/auth/member-gate";
import { isMember } from "@/lib/auth/session";

/** Stories are open to guests; replying needs an account. */
export default function StoriesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ViewerProvider signedIn={isMember()}>
      <Suspense>
        <MemberGate>{children}</MemberGate>
      </Suspense>
    </ViewerProvider>
  );
}
