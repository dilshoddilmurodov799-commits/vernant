"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { DEMO_PHOTO_CHOICES } from "@/lib/demo/data";
import { IDENTITIES, INTENTS, type Identity, type Intent, type Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Photo } from "@/components/ui/photo";
import { Chip, Switch } from "@/components/ui/primitives";
import { Logo } from "@/components/ui/logo";

const STEPS = ["About you", "Identity", "Looking for", "Photo", "Privacy"] as const;
const PRONOUNS = ["he/him", "he/they", "they/them", "she/her", "she/they", "Prefer not to say"];

export function OnboardingFlow() {
  const router = useRouter();
  const { state, dispatch } = useDemo();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name: state.me.name,
    pronouns: state.me.pronouns,
    city: state.me.city,
    bio: "",
    identities: [] as Identity[],
    lookingFor: [] as Intent[],
    photo: DEMO_PHOTO_CHOICES[0],
    visibility: "members" as Visibility,
    showDistance: true,
  });

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const canContinue = [
    data.name.trim().length > 0 && data.city.trim().length > 0,
    data.identities.length > 0,
    data.lookingFor.length > 0,
    !!data.photo,
    true,
  ][step];

  const finish = () => {
    dispatch({
      type: "updateProfile",
      patch: {
        name: data.name.trim(),
        pronouns: data.pronouns,
        city: data.city.trim(),
        bio: data.bio.trim() || state.me.bio,
        identities: data.identities,
        lookingFor: data.lookingFor,
        photo: data.photo,
      },
    });
    dispatch({ type: "updateSettings", patch: { visibility: data.visibility, showDistance: data.showDistance } });
    router.push("/feed");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} aria-label="Back" className="grid size-10 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <Logo />
        )}
        <span className="text-xs text-subtle tabular-nums">
          {step + 1} / {STEPS.length}
        </span>
      </header>

      <div className="mt-6 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-accent" : "bg-surface-3")} />
        ))}
      </div>

      <main key={step} className="flex-1 py-8 animate-rise">
        <p className="text-xs font-medium tracking-[0.14em] text-accent uppercase">{STEPS[step]}</p>

        {step === 0 && (
          <>
            <Heading title="Let's set up your profile" sub="You can change any of this later." />
            <div className="space-y-4">
              <Field label="Display name">
                {(p) => <Input {...p} value={data.name} maxLength={40} onChange={(e) => setData({ ...data, name: e.target.value })} />}
              </Field>
              <fieldset className="space-y-1.5">
                <legend className="mb-1.5 text-[13px] font-medium text-muted">Pronouns</legend>
                <div className="flex flex-wrap gap-2">
                  {PRONOUNS.map((p) => (
                    <Chip key={p} active={data.pronouns === p} onClick={() => setData({ ...data, pronouns: p })}>
                      {p}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <Field label="City" hint="Only an approximate distance is shown to others.">
                {(p) => <Input {...p} value={data.city} maxLength={60} onChange={(e) => setData({ ...data, city: e.target.value })} />}
              </Field>
              <Field label="Short bio" hint={`${data.bio.length}/300 · optional`}>
                {(p) => <Textarea {...p} value={data.bio} maxLength={300} placeholder="What should people know about you?" onChange={(e) => setData({ ...data, bio: e.target.value })} />}
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Heading title="How do you identify?" sub="Pick any that fit. Everyone is welcome here — bodies of every size, and the people who love them." />
            <div className="flex flex-wrap gap-2">
              {IDENTITIES.map((i) => (
                <Chip key={i} active={data.identities.includes(i)} onClick={() => setData({ ...data, identities: toggle(data.identities, i) })} className="h-10 px-4 text-sm">
                  {data.identities.includes(i) && <Check />}
                  {i}
                </Chip>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Heading title="What are you here for?" sub="This helps us show you the right people. Choose all that apply." />
            <div className="grid gap-2">
              {INTENTS.map((i) => {
                const active = data.lookingFor.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setData({ ...data, lookingFor: toggle(data.lookingFor, i) })}
                    className={cn(
                      "flex h-14 items-center justify-between rounded-xl border px-4 text-left text-[15px] transition-colors",
                      active ? "border-accent/50 bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                    )}
                  >
                    {i}
                    <span className={cn("grid size-5 place-items-center rounded-full border", active ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>
                      {active && <Check className="size-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <Heading title="Add a profile photo" sub="Demo: choose a placeholder. Real uploads will go to a private bucket, be scanned, and served through expiring links." />
            <div className="grid grid-cols-3 gap-2.5">
              {DEMO_PHOTO_CHOICES.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  aria-pressed={data.photo === seed}
                  aria-label={`Demo photo ${seed.slice(-1)}`}
                  onClick={() => setData({ ...data, photo: seed })}
                  className={cn("relative overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-bg transition", data.photo === seed ? "ring-accent" : "ring-transparent")}
                >
                  <Photo seed={seed} alt="" width={300} height={400} sizes="160px" className="aspect-[3/4]" />
                  {data.photo === seed && (
                    <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-accent text-accent-fg">
                      <Check className="size-3.5" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <Heading title="Your privacy, your call" sub="Sensible defaults are on. Change them any time in Settings." />
            <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {(
                [
                  ["everyone", "All verified members", "Appear in Discover for everyone."],
                  ["members", "People in my network", "Only members you follow or who follow you."],
                  ["matches", "Matches only", "Stay hidden from Discover."],
                ] as const
              ).map(([value, label, desc]) => (
                <label key={value} className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
                  <input
                    type="radio"
                    name="visibility"
                    checked={data.visibility === value}
                    onChange={() => setData({ ...data, visibility: value })}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                  <span>
                    <span className="block text-sm">{label}</span>
                    <span className="text-xs text-subtle">{desc}</span>
                  </span>
                </label>
              ))}
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <span>
                  <span className="block text-sm">Show approximate distance</span>
                  <span className="text-xs text-subtle">Never your exact location.</span>
                </span>
                <Switch label="Show approximate distance" checked={data.showDistance} onChange={(v) => setData({ ...data, showDistance: v })} />
              </div>
            </div>
          </>
        )}
      </main>

      <footer className="sticky bottom-0 -mx-5 bg-gradient-to-t from-bg via-bg to-transparent px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button size="lg" className="w-full" disabled={!canContinue} onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}>
          {step === STEPS.length - 1 ? "Enter Vernant" : "Continue"}
        </Button>
      </footer>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mt-2 mb-7">
      <h1 className="font-display text-4xl leading-tight tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{sub}</p>
    </div>
  );
}
