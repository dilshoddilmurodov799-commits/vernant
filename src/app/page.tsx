import { ArrowRight, Eye, HeartHandshake, Lock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DemoNotice, Logo } from "@/components/ui/logo";
import { Photo } from "@/components/ui/photo";

const MOSAIC = ["hearth-land-1", "hearth-land-2", "hearth-land-3", "hearth-land-4", "hearth-land-5"];

const PILLARS = [
  { icon: HeartHandshake, title: "Dating, your way", body: "Like, match, and talk with people who are into exactly who you are. No swiping marathons." },
  { icon: Users, title: "Friendship & community", body: "Brunches, hikes, game nights. Find your crew in your city or wherever you're headed." },
  { icon: Sparkles, title: "Share your world", body: "Posts and stories that feel like a living room, not a billboard. Post to everyone or just followers." },
];

const SAFETY = [
  { icon: ShieldCheck, title: "Strictly 18+", body: "Age confirmation at sign-up and photo verification for a trusted badge." },
  { icon: Lock, title: "Private albums", body: "Share private photos only with people you approve, and revoke access any time." },
  { icon: Eye, title: "Privacy controls", body: "Choose who sees your profile, hide your distance, or browse incognito." },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-hidden">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:h-20">
        <Logo />
        <nav className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm">
            Log in
          </ButtonLink>
          <ButtonLink href="/register" size="sm">
            Join Vernant
          </ButtonLink>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-10 pb-20 md:grid-cols-[1.05fr_1fr] md:pt-16 md:pb-28">
          <div className="animate-rise">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-accent" /> For bears, chubs, cubs & the people who admire them
            </p>
            <h1 className="font-display text-[52px] leading-[0.95] tracking-tight md:text-[84px]">
              Room for
              <br />
              <em className="text-accent">all</em> of you.
            </h1>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
              Vernant is a warm, grown-up place to date, make friends, and find community — built for bigger bodies and the people who love them.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/register" size="lg">
                Create your profile <ArrowRight />
              </ButtonLink>
              <ButtonLink href="/feed" variant="outline" size="lg">
                Explore the demo
              </ButtonLink>
            </div>
            <p className="mt-6 text-xs text-subtle">18+ only · Free to join</p>
          </div>

          <div className="relative grid h-[460px] grid-cols-6 grid-rows-6 gap-3 md:h-[560px]" aria-hidden>
            <Photo seed={MOSAIC[0]} alt="" priority sizes="(max-width: 768px) 60vw, 320px" className="col-span-4 row-span-4 rounded-3xl border border-line" />
            <Photo seed={MOSAIC[1]} alt="" sizes="200px" className="col-span-2 row-span-3 rounded-3xl border border-line" />
            <Photo seed={MOSAIC[2]} alt="" sizes="200px" className="col-span-2 row-span-3 rounded-3xl border border-line" />
            <Photo seed={MOSAIC[3]} alt="" sizes="200px" className="col-span-2 row-span-2 rounded-3xl border border-line" />
            <Photo seed={MOSAIC[4]} alt="" sizes="200px" className="col-span-2 row-span-2 rounded-3xl border border-line" />
            <div className="absolute -bottom-4 left-4 rounded-2xl border border-line-strong bg-surface/90 px-4 py-3 shadow-elevated backdrop-blur-xl md:left-[-28px]">
              <p className="text-sm font-medium">It&apos;s a match</p>
              <p className="text-xs text-muted">Marcus liked you back · 2 km away</p>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface/40">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-3">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon className="mb-4 size-6 text-accent" strokeWidth={1.6} />
                <h2 className="text-lg font-medium">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-24">
          <div className="max-w-xl">
            <h2 className="font-display text-4xl leading-tight md:text-5xl">Safe enough to be yourself.</h2>
            <p className="mt-4 text-muted">
              Safety is designed in from the start: blocking and confidential reporting everywhere, private media by consent, and clear controls over who sees what.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {SAFETY.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-line bg-surface p-6">
                <span className="mb-5 grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-5" />
                </span>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-24">
          <div className="rounded-3xl border border-line bg-surface px-6 py-14 text-center md:py-20">
            <h2 className="font-display text-4xl md:text-6xl">Pull up a chair.</h2>
            <p className="mx-auto mt-4 max-w-md text-muted">Join a community that&apos;s been waiting for you.</p>
            <ButtonLink href="/register" size="lg" className="mt-8">
              Join Vernant
            </ButtonLink>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-xs text-subtle md:flex-row md:items-center">
          <p>© 2026 Vernant · Adults 18+ only</p>
          <DemoNotice />
        </div>
      </footer>
    </div>
  );
}
