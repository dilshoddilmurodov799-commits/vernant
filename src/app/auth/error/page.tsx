import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = { title: "Link expired" };

export default function AuthErrorPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 py-10">
      <div className="w-full max-w-sm text-center">
        <Logo className="mb-10" />
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-line bg-surface-2 text-muted">
          <LinkIcon className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-3xl tracking-tight">This link didn&apos;t work</h1>
        <p className="mt-2 text-sm text-muted">
          Email links can be used once and expire after a while. Links also need to be opened in the same browser where you requested them.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <ButtonLink href="/login">Log in or resend confirmation</ButtonLink>
          <ButtonLink href="/forgot-password" variant="ghost">
            Request a new password reset
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
