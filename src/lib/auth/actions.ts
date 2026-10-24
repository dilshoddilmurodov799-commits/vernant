"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase/env";
import { HOME_PATH, LOGIN_PATH, safeNextPath } from "./paths";
import { emailOnlySchema, fieldErrors, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas";

/**
 * Auth server actions. Every input is re-validated with Zod here; Supabase Auth
 * then applies its own rate limits and password policy. Messages never reveal
 * whether an email address has an account.
 */
export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so the form keeps non-secret input after an error. Never includes passwords. */
  values?: Record<string, string>;
  /** Set when sign-in failed because the address isn't confirmed yet. */
  unconfirmedEmail?: string;
}

const NOT_CONFIGURED: AuthFormState = { status: "error", message: SUPABASE_NOT_CONFIGURED };

function readForm(formData: FormData) {
  return Object.fromEntries([...formData].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** Absolute URL for links in auth emails. Next.js verifies the Origin header on server actions. */
async function siteUrl(path: string) {
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return new URL(path, origin).toString();
}

function describe(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "weak_password":
      return "Choose a stronger password — longer, and not a common one.";
    case "same_password":
      return "Choose a password you haven't used for this account.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    case "signup_disabled":
      return "New sign-ups are paused right now.";
    case "email_address_invalid":
      return "That email address can't receive mail. Try another.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * Errors worth showing on account-lookup flows (resend, reset): rate limits and outages.
 * Anything else is swallowed so responses don't reveal whether an account exists.
 */
function reportable(error: AuthError) {
  return error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit" || !error.status || error.status >= 500;
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData);
  const values = { email: raw.email ?? "" };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Confirm your email address first — check your inbox for the link.",
        unconfirmedEmail: parsed.data.email,
        values,
      };
    }
    return { status: "error", message: describe(error), values };
  }
  redirect(safeNextPath(parsed.data.next, HOME_PATH));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData);
  const values = { displayName: raw.displayName ?? "", email: raw.email ?? "", birthDate: raw.birthDate ?? "", terms: raw.terms ?? "" };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const { email, password, displayName, birthDate } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await siteUrl("/auth/confirm?next=/onboarding"),
      // Private to this user (and the service role). User-editable, so the profile
      // trigger must re-validate birth_date when it copies it into profile_private.
      data: { display_name: displayName, birth_date: birthDate },
    },
  });
  // "Already registered" is reported as success so the form can't be used to probe for accounts.
  if (error && error.code !== "user_already_exists") return { status: "error", message: describe(error), values };
  // Email confirmation disabled in the dashboard → Supabase signs the user in immediately.
  if (data.session) redirect("/onboarding");
  return { status: "success", message: email, values };
}

export async function resendConfirmation(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = emailOnlySchema.safeParse(readForm(formData));
  if (!parsed.success) return { status: "error", message: "Enter a valid email address." };
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: await siteUrl("/auth/confirm?next=/onboarding") },
  });
  if (error && reportable(error)) return { status: "error", message: describe(error) };
  return { status: "success", message: "If that address is waiting for confirmation, a new link is on its way." };
}

export async function requestPasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData);
  const values = { email: raw.email ?? "" };
  const parsed = emailOnlySchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: await siteUrl("/auth/confirm?next=/reset-password"),
  });
  if (error && reportable(error)) return { status: "error", message: describe(error), values };
  return { status: "success", message: parsed.data.email, values };
}

export async function updatePassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse(readForm(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const supabase = await createClient();
  // Server-side authorization: a recovery link must have established a verified session.
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect(`${LOGIN_PATH}?next=/reset-password`);

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "reauthentication_needed") {
      return { status: "error", message: "For security, request a new reset link and try again." };
    }
    return { status: "error", message: describe(error) };
  }
  redirect(HOME_PATH);
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(LOGIN_PATH);
}
