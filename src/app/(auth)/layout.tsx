import { Logo } from "@/components/ui/logo";
import { Photo } from "@/components/ui/photo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-6 md:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-subtle">Accounts are real · in-app content is still fictional demo data</p>
      </div>
      <div className="relative hidden p-4 lg:block">
        <Photo seed="hearth-auth-cover" alt="" priority sizes="50vw" width={1200} height={1600} className="h-full rounded-3xl border border-line">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
          <blockquote className="absolute inset-x-0 bottom-0 p-10">
            <p className="font-display text-4xl leading-tight text-white">“First place I didn&apos;t feel like I had to explain myself.”</p>
            <footer className="mt-3 text-sm text-white/70">Demo testimonial</footer>
          </blockquote>
        </Photo>
      </div>
    </div>
  );
}
