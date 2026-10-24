"use client";

import { usePathname } from "next/navigation";
import { createContext, Suspense, use, useCallback, useContext, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { ButtonLink } from "@/components/ui/button";

/**
 * Guest vs. member on pages anyone can browse (feed, discover, profiles, stories). The layout
 * passes an un-awaited `isMember()` promise so the static shell still prerenders; readers
 * suspend until it resolves. This only shapes the UI: member data and actions must still be
 * authorized on the server and in RLS.
 */
const ViewerContext = createContext<Promise<boolean> | null>(null);
const GateContext = createContext<((action: () => void) => void) | null>(null);

export function ViewerProvider({ signedIn, children }: { signedIn: Promise<boolean>; children: React.ReactNode }) {
  return <ViewerContext value={signedIn}>{children}</ViewerContext>;
}

/** Suspends until the session check resolves; call inside <Suspense>. */
export function useSignedIn() {
  const signedIn = useContext(ViewerContext);
  if (!signedIn) throw new Error("useSignedIn must be used inside <ViewerProvider>");
  return use(signedIn);
}

/** Renders `children(signedIn)`, with `null` while the session check is still streaming in. */
export function ViewerSwitch({ children }: { children: (signedIn: boolean | null) => React.ReactNode }) {
  return (
    <Suspense fallback={children(null)}>
      <ResolvedViewer>{children}</ResolvedViewer>
    </Suspense>
  );
}

function ResolvedViewer({ children }: { children: (signedIn: boolean) => React.ReactNode }) {
  return children(useSignedIn());
}

/** Lets members act; shows guests a join prompt instead. Must sit inside <Suspense>. */
export function MemberGate({ children }: { children: React.ReactNode }) {
  const signedIn = useSignedIn();
  const [prompting, setPrompting] = useState(false);
  const guard = useCallback((action: () => void) => (signedIn ? action() : setPrompting(true)), [signedIn]);

  return (
    <GateContext value={guard}>
      {children}
      <JoinPrompt open={prompting} onClose={() => setPrompting(false)} />
    </GateContext>
  );
}

/** Wrap member-only handlers: `member(() => dispatch(...))`. Guests get the join prompt. */
export function useMemberAction() {
  const guard = useContext(GateContext);
  if (!guard) throw new Error("useMemberAction must be used inside <MemberGate>");
  return guard;
}

/** Login link that returns to the current page. */
export function useLoginHref() {
  const pathname = usePathname();
  return pathname === "/" ? "/login" : `/login?next=${encodeURIComponent(pathname)}`;
}

function JoinPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const loginHref = useLoginHref();
  return (
    <Dialog open={open} onClose={onClose} title="Join Vernant to do that" description="Create a free account or log in to like, follow, comment, message, and report.">
      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <ButtonLink href="/register" className="sm:flex-1">
          Create account
        </ButtonLink>
        <ButtonLink href={loginHref} variant="outline" className="sm:flex-1">
          Log in
        </ButtonLink>
      </div>
    </Dialog>
  );
}
