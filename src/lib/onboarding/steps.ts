import type { PhotoStatus, Preferences, ProfileDetails } from "./schemas";

/**
 * The five sign-up steps in the progress indicator. Steps 1–2 (email or phone, one-time code)
 * run on /register; 3–5 run on /onboarding once the account exists. Kept dependency-free for tests.
 */
export const SIGNUP_STEPS = ["Email", "Verify", "Account", "Profile", "Preferences"] as const;

/** Onboarding screens, in order. */
export const ONBOARDING_STEPS = ["account", "profile", "preferences"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** 1-based position of an onboarding screen in SIGNUP_STEPS. */
export function signupStepNumber(step: OnboardingStep) {
  return ONBOARDING_STEPS.indexOf(step) + 3;
}

export function nextStep(step: OnboardingStep): OnboardingStep | "done" {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) + 1] ?? "done";
}

/** The account step has no "back": the phone number is already verified by then. */
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  return ONBOARDING_STEPS[ONBOARDING_STEPS.indexOf(step) - 1] ?? null;
}

/**
 * Where an unfinished account resumes. `onboarding_step` counts finished screens
 * (1 account, 2 profile, 3 preferences); with no profile row the account screen comes first.
 */
export function resumeStep(profile: { onboarding_step: number } | null): OnboardingStep {
  if (!profile) return "account";
  return profile.onboarding_step >= 2 ? "preferences" : "profile";
}

/** Everything saved so far, so the flow resumes pre-filled. Never contains secrets. */
export interface OnboardingDraft {
  step: OnboardingStep;
  /** The account step has run (profile row exists, password already set if one was needed). */
  hasAccount: boolean;
  /** Phone-only accounts need a password to log in with their username later. */
  needsPassword: boolean;
  username: string;
  profile: ProfileDetails;
  photo: { url: string; status: PhotoStatus } | null;
  preferences: Preferences;
}
