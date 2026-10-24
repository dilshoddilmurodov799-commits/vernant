"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ImagePlus, LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { afterOnboardingPath } from "@/lib/auth/paths";
import { PASSWORD_MIN, USERNAME_PATTERN } from "@/lib/auth/schemas";
import {
  checkUsername,
  removePhoto,
  saveAccount,
  savePreferences,
  saveProfile,
  uploadPhoto,
  type OnboardingResult,
  type UsernameCheck,
} from "@/lib/onboarding/actions";
import {
  AGE_MAX,
  AGE_MIN,
  BIO_MAX,
  CITY_MAX,
  DISTANCE_OPTIONS,
  INTERESTS_MAX,
  photoFileError,
  PHOTO_TYPES,
  type Preferences,
  type ProfileDetails,
} from "@/lib/onboarding/schemas";
import { nextStep, previousStep, signupStepNumber, type OnboardingDraft, type OnboardingStep } from "@/lib/onboarding/steps";
import { IDENTITIES, INTENTS, INTERESTS, PRONOUNS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Logo } from "@/components/ui/logo";
import { Badge, Chip, Switch } from "@/components/ui/primitives";
import { FormAlert, PasswordInput } from "@/components/auth/auth-form";
import { ConsentCheckbox } from "@/components/auth/consent-checkbox";
import { StepIndicator } from "@/components/auth/step-indicator";

/**
 * Sign-up steps 3–5 (account, profile, preferences) plus the finish screen. Every step saves
 * to the server before moving on, so a refresh or a new device resumes where it stopped.
 * Going back keeps unsaved edits in memory; nothing is written to browser storage.
 */
export function OnboardingFlow({ draft, next }: { draft: OnboardingDraft; next: string }) {
  const [step, setStep] = useState<OnboardingStep | "done">(draft.step);
  const [account, setAccount] = useState({ username: draft.username, saved: draft.hasAccount, needsPassword: draft.needsPassword });
  const [profile, setProfile] = useState(draft.profile);
  const [photo, setPhoto] = useState(draft.photo);
  const [prefs, setPrefs] = useState(draft.preferences);

  // Move focus to the new screen's heading so keyboard and screen reader users follow along.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const forward = (from: OnboardingStep) => setStep(nextStep(from));
  const back = (from: OnboardingStep) => setStep(previousStep(from) ?? from);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut />
            Log out
          </Button>
        </form>
      </header>

      <main key={step} className="flex flex-1 flex-col py-8 animate-rise">
        {step === "done" ? (
          <Finished headingRef={headingRef} username={account.username} photoPending={photo?.status === "pending"} next={next} />
        ) : (
          <>
            <StepIndicator step={signupStepNumber(step)} className="mb-6" />
            {step === "account" && (
              <AccountStep
                headingRef={headingRef}
                value={account}
                onChange={(username) => setAccount({ ...account, username })}
                onSaved={() => {
                  setAccount({ ...account, saved: true, needsPassword: false });
                  forward("account");
                }}
              />
            )}
            {step === "profile" && (
              <ProfileStep
                headingRef={headingRef}
                value={profile}
                onChange={setProfile}
                photo={photo}
                onPhoto={setPhoto}
                onBack={() => back("profile")}
                onSaved={() => forward("profile")}
              />
            )}
            {step === "preferences" && (
              <PreferencesStep
                headingRef={headingRef}
                value={prefs}
                onChange={setPrefs}
                onBack={() => back("preferences")}
                onSaved={() => forward("preferences")}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

function Heading({ headingRef, title, sub }: { headingRef: HeadingRef; title: string; sub: string }) {
  return (
    <div className="mb-7">
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-4xl leading-tight tracking-tight outline-none">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{sub}</p>
    </div>
  );
}

/** Runs a server action for a step; `pending` blocks double submits. */
function useStepAction(onSaved: () => void) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const run = (action: (data: FormData) => Promise<OnboardingResult>, data: FormData) => {
    if (pending) return;
    startTransition(async () => {
      const r = await action(data);
      setResult(r);
      if (r.status === "success") onSaved();
    });
  };
  return { pending, errors: result?.fieldErrors ?? {}, message: result?.status === "error" ? result.message : undefined, run };
}

function StepActions({ pending, onBack, onSkip, submitLabel = "Continue" }: { pending: boolean; onBack?: () => void; onSkip?: () => void; submitLabel?: string }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-auto space-y-3 bg-bg px-5 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex gap-3">
        {onBack && (
          <Button variant="outline" size="lg" onClick={onBack} disabled={pending}>
            Back
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
      {onSkip && (
        <button type="button" onClick={onSkip} disabled={pending} className="w-full rounded py-1 text-center text-sm text-muted hover:text-fg disabled:opacity-50">
          Skip for now
        </button>
      )}
    </div>
  );
}

function submitWith(run: (data: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    run(new FormData(e.currentTarget));
  };
}

function skipWith(run: (data: FormData) => void) {
  return () => {
    const data = new FormData();
    data.set("intent", "skip");
    run(data);
  };
}

// ---------------------------------------------------------------- step 3: account

function AccountStep({
  headingRef,
  value,
  onChange,
  onSaved,
}: {
  headingRef: HeadingRef;
  value: { username: string; saved: boolean; needsPassword: boolean };
  onChange: (username: string) => void;
  onSaved: () => void;
}) {
  const { pending, errors, message, run } = useStepAction(onSaved);
  const [check, setCheck] = useState<UsernameCheck | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(0);

  const onUsername = (input: string) => {
    onChange(input);
    setCheck(null);
    clearTimeout(timer.current);
    const id = ++latest.current;
    if (!USERNAME_PATTERN.test(input.toLowerCase())) return;
    timer.current = setTimeout(async () => {
      const result = await checkUsername(input);
      if (id === latest.current) setCheck(result);
    }, 400);
  };

  const usernameError = errors.username ?? (check?.status === "taken" ? check.message : undefined);
  const usernameHint = check?.status === "available" ? check.message : "3–30 letters, numbers, dots or underscores. Shown on your profile.";

  return (
    <form onSubmit={submitWith((d) => run(saveAccount, d))} noValidate className="flex flex-1 flex-col">
      <Heading headingRef={headingRef} title="Create your account" sub="You're verified. Now pick how people will know you." />
      <div className="space-y-5">
        {message && <FormAlert>{message}</FormAlert>}
        <Field label="Username" error={usernameError} hint={usernameHint}>
          {(p) => (
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-subtle">
                @
              </span>
              <Input
                {...p}
                name="username"
                value={value.username}
                onChange={(e) => onUsername(e.target.value.replace(/\s|^@/g, ""))}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={31}
                required
                className="pl-8"
              />
            </div>
          )}
        </Field>
        <Field
          label={value.needsPassword ? "Password" : "Password (optional)"}
          error={errors.password}
          hint={
            value.needsPassword
              ? `At least ${PASSWORD_MIN} characters. Log in later with your username and this password, or with a one-time code.`
              : `Optional, at least ${PASSWORD_MIN} characters: lets you log in with your username and a password. You can always use a one-time email code. Leave blank to skip or keep your current one.`
          }
        >
          {(p) => <PasswordInput {...p} name="password" autoComplete="new-password" required={value.needsPassword} />}
        </Field>
        <ConsentCheckbox name="terms" error={errors.terms} defaultChecked={value.saved}>
          I agree to the Community Guidelines, Terms of Service and Privacy Policy.
        </ConsentCheckbox>
      </div>
      <StepActions pending={pending} />
    </form>
  );
}

// ---------------------------------------------------------------- step 4: profile

function ProfileStep({
  headingRef,
  value,
  onChange,
  photo,
  onPhoto,
  onBack,
  onSaved,
}: {
  headingRef: HeadingRef;
  value: ProfileDetails;
  onChange: (value: ProfileDetails) => void;
  photo: OnboardingDraft["photo"];
  onPhoto: (photo: OnboardingDraft["photo"]) => void;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { pending, errors, message, run } = useStepAction(onSaved);
  const set = (patch: Partial<ProfileDetails>) => onChange({ ...value, ...patch });

  return (
    <form onSubmit={submitWith((d) => run(saveProfile, d))} noValidate className="flex flex-1 flex-col">
      <Heading headingRef={headingRef} title="Show people who you are" sub="Everything here is optional, and you can change it later." />
      <div className="space-y-7">
        {message && <FormAlert>{message}</FormAlert>}
        <PhotoPicker photo={photo} onPhoto={onPhoto} />

        <Field label="Bio" error={errors.bio} hint={`${value.bio.length}/${BIO_MAX}`}>
          {(p) => (
            <Textarea
              {...p}
              name="bio"
              value={value.bio}
              maxLength={BIO_MAX}
              placeholder="What should people know about you?"
              onChange={(e) => set({ bio: e.target.value })}
            />
          )}
        </Field>

        <ChipGroup legend="Pronouns" error={errors.pronouns}>
          {PRONOUNS.map((p) => (
            <Chip key={p} active={value.pronouns === p} onClick={() => set({ pronouns: value.pronouns === p ? "" : p })}>
              {p}
            </Chip>
          ))}
        </ChipGroup>
        <input type="hidden" name="pronouns" value={value.pronouns} />

        <Field label="City" error={errors.city} hint="Shown on your profile. Others only ever see an approximate distance.">
          {(p) => <Input {...p} name="city" value={value.city} maxLength={CITY_MAX} autoComplete="address-level2" onChange={(e) => set({ city: e.target.value })} />}
        </Field>

        <MultiChips legend="How do you identify?" name="identities" options={IDENTITIES} value={value.identities} onChange={(identities) => set({ identities })} error={errors.identities} />
        <MultiChips
          legend="Interests"
          hint={`${value.interests.length}/${INTERESTS_MAX}`}
          name="interests"
          options={INTERESTS}
          max={INTERESTS_MAX}
          value={value.interests}
          onChange={(interests) => set({ interests })}
          error={errors.interests}
        />
        <MultiChips legend="What are you looking for?" name="lookingFor" options={INTENTS} value={value.lookingFor} onChange={(lookingFor) => set({ lookingFor })} error={errors.lookingFor} />
      </div>
      <StepActions pending={pending} onBack={onBack} onSkip={skipWith((d) => run(saveProfile, d))} />
    </form>
  );
}

/** Uploads straight away (its own server action), so the step form never carries the file. */
function PhotoPicker({ photo, onPhoto }: { photo: OnboardingDraft["photo"]; onPhoto: (photo: OnboardingDraft["photo"]) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (file: File) => {
    const problem = photoFileError(file);
    if (problem) return setError(problem);
    setError(undefined);
    const data = new FormData();
    data.set("photo", file);
    startTransition(async () => {
      const r = await uploadPhoto(data);
      if (r.status === "success" && r.photo) onPhoto(r.photo);
      else setError(r.message ?? "Upload failed. Try again.");
    });
  };

  const remove = () =>
    startTransition(async () => {
      const r = await removePhoto();
      if (r.status === "success") onPhoto(null);
      else setError(r.message);
    });

  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium text-muted">Profile photo</legend>
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2 text-subtle">
          {photo?.url ? (
            <Image src={photo.url} alt="Your profile photo" width={96} height={96} unoptimized className="size-full object-cover" />
          ) : (
            <ImagePlus aria-hidden className="size-6" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" disabled={pending} onClick={() => inputRef.current?.click()}>
              {pending ? "Uploading…" : photo ? "Replace photo" : "Upload photo"}
            </Button>
            {photo && (
              <Button variant="ghost" size="sm" disabled={pending} onClick={remove}>
                Remove
              </Button>
            )}
          </div>
          {photo?.status === "pending" && <Badge>In review</Badge>}
          {photo?.status === "rejected" && <Badge variant="danger">Not approved — try another</Badge>}
          <p className="text-xs text-subtle">JPG, PNG or WebP, up to 8 MB. We remove location data. Others see it once it&apos;s approved.</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a profile photo"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) upload(file);
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------- step 5: preferences

function PreferencesStep({
  headingRef,
  value,
  onChange,
  onBack,
  onSaved,
}: {
  headingRef: HeadingRef;
  value: Preferences;
  onChange: (value: Preferences) => void;
  onBack: () => void;
  onSaved: () => void;
}) {
  const { pending, errors, message, run } = useStepAction(onSaved);
  const set = (patch: Partial<Preferences>) => onChange({ ...value, ...patch });
  const ages = Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) => AGE_MIN + i);

  return (
    <form onSubmit={submitWith((d) => run(savePreferences, d))} noValidate className="flex flex-1 flex-col">
      <Heading headingRef={headingRef} title="Discovery and privacy" sub="Optional. Sensible defaults are already set, and you can change them any time." />
      <div className="space-y-7">
        {message && <FormAlert>{message}</FormAlert>}
        <MultiChips
          legend="Show me"
          hint="Leave empty to see everyone."
          name="interestedIn"
          options={IDENTITIES}
          value={value.interestedIn}
          onChange={(interestedIn) => set({ interestedIn })}
          error={errors.interestedIn}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age from" error={errors.ageMin}>
            {(p) => (
              <Select {...p} name="ageMin" value={value.ageMin} onChange={(e) => set({ ageMin: Number(e.target.value) })}>
                {ages.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Age to" error={errors.ageMax}>
            {(p) => (
              <Select {...p} name="ageMax" value={value.ageMax} onChange={(e) => set({ ageMax: Number(e.target.value) })}>
                {ages.map((a) => (
                  <option key={a} value={a}>
                    {a === AGE_MAX ? `${a}+` : a}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Distance" error={errors.maxDistanceKm} hint="Uses your approximate area once you share one. We never ask for your exact location here.">
          {(p) => (
            <Select
              {...p}
              name="maxDistanceKm"
              value={value.maxDistanceKm ?? ""}
              onChange={(e) => set({ maxDistanceKm: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Any distance</option>
              {DISTANCE_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-muted">Who can see your profile</legend>
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {(
              [
                ["everyone", "All verified members", "Appear in Discover for everyone."],
                ["members", "People in my network", "Only members you follow or who follow you."],
                ["matches", "Matches only", "Stay hidden from Discover."],
              ] as const
            ).map(([option, label, desc]) => (
              <label key={option} className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
                <input
                  type="radio"
                  name="visibility"
                  value={option}
                  checked={value.visibility === option}
                  onChange={() => set({ visibility: option })}
                  className="size-4 accent-accent"
                />
                <span>
                  <span className="block text-sm">{label}</span>
                  <span className="text-xs text-subtle">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          {errors.visibility && <p className="mt-1.5 text-xs text-danger">{errors.visibility}</p>}
        </fieldset>

        <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
          <SwitchRow label="Show approximate distance" hint="Never your exact location." checked={value.showDistance} onChange={(showDistance) => set({ showDistance })} />
          <SwitchRow label="Show when I'm online" hint="Others see a dot when you're active." checked={value.showOnline} onChange={(showOnline) => set({ showOnline })} />
        </div>
        <input type="hidden" name="showDistance" value={String(value.showDistance)} />
        <input type="hidden" name="showOnline" value={String(value.showOnline)} />
      </div>
      <StepActions pending={pending} onBack={onBack} onSkip={skipWith((d) => run(savePreferences, d))} submitLabel="Finish" />
    </form>
  );
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span>
        <span className="block text-sm">{label}</span>
        <span className="text-xs text-subtle">{hint}</span>
      </span>
      <Switch label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

// ---------------------------------------------------------------- shared chips

function ChipGroup({ legend, hint, error, children }: { legend: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 flex w-full justify-between text-[13px] font-medium text-muted">
        {legend}
        {hint && <span className="font-normal text-subtle tabular-nums">{hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

/** Toggle chips that submit as repeated hidden inputs (`name=a&name=b`). */
function MultiChips<T extends string>({
  legend,
  hint,
  name,
  options,
  value,
  onChange,
  max,
  error,
}: {
  legend: string;
  hint?: string;
  name: string;
  options: readonly T[];
  value: T[];
  onChange: (value: T[]) => void;
  max?: number;
  error?: string;
}) {
  const full = max !== undefined && value.length >= max;
  return (
    <ChipGroup legend={legend} hint={hint} error={error}>
      {options.map((option) => {
        const active = value.includes(option);
        return (
          <Chip
            key={option}
            active={active}
            disabled={!active && full}
            onClick={() => onChange(active ? value.filter((v) => v !== option) : [...value, option])}
            className={cn(!active && full && "opacity-40")}
          >
            {active && <Check />}
            {option}
          </Chip>
        );
      })}
      {value.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </ChipGroup>
  );
}

// ---------------------------------------------------------------- done

function Finished({ headingRef, username, photoPending, next }: { headingRef: HeadingRef; username: string; photoPending: boolean; next: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent animate-pop">
        <Check className="size-6" />
      </div>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 font-display text-4xl tracking-tight outline-none">
        You&apos;re in, @{username}
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
        Your account is set up.
        {photoPending && " Your photo will appear to others once it's been reviewed."}
      </p>
      <ButtonLink href={afterOnboardingPath(next)} size="lg" className="mt-8 w-full max-w-xs">
        Start exploring
      </ButtonLink>
    </div>
  );
}
