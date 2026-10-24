"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase/env";
import { describeAuthError } from "./errors";
import { HOME_PATH, LOGIN_PATH, VERIFY_PHONE_PATH, safeNextPath } from "./paths";
import { emailOnlySchema, fieldErrors, phoneCodeSchema, phoneOnlySchema, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas";

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

/**
 * Account email for a username, via the service-role-only `login_email` RPC, so emails never
 * reach the browser. `null` means no such username; "unavailable" means the lookup can't run
 * (no service-role key, or the migration isn't applied).
 */
async function emailForUsername(username: string): Promise<string | null | "unavailable"> {
  const admin = createAdminClient();
  if (!admin) return "unavailable";
  const { data, error } = await admin.rpc("login_email", { p_username: username });
  if (error) return "unavailable";
  return typeof data === "string" ? data : null;
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
  const values = { identifier: raw.identifier ?? "" };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const { identifier, password } = parsed.data;
  const byEmail = identifier.includes("@");
  const email = byEmail ? identifier : await emailForUsername(identifier);
  if (email === "unavailable") return { status: "error", message: "Username log-in isn't available right now. Use your email address.", values };
  // Unknown usernames get the same answer as a wrong password.
  if (!email) return { status: "error", message: describeAuthError({ code: "invalid_credentials" }), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Confirm your email address first — check your inbox for the link.",
        // Only echo an address the user typed; never reveal the one behind a username.
        unconfirmedEmail: byEmail ? email : undefined,
        values,
      };
    }
    return { status: "error", message: describeAuthError(error), values };
  }
  redirect(safeNextPath(parsed.data.next, HOME_PATH));
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData);
  const values = {
    username: raw.username ?? "",
    email: raw.email ?? "",
    phoneCountry: raw.phoneCountry ?? "",
    phone: raw.phone ?? "",
    terms: raw.terms ?? "",
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const { email, phone, password, username } = parsed.data;
  // Friendly early check (usernames are public). The unique constraint in the profile trigger is the real guard.
  const existing = await emailForUsername(username);
  if (existing && existing !== "unavailable") {
    return { status: "error", fieldErrors: { username: "That username is taken" }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: await siteUrl("/auth/confirm?next=/onboarding"),
      // Copied into public.profiles by the auth.users insert trigger, which re-validates it:
      // metadata is client-writable through the Auth API.
      data: { username },
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { status: "error", message: "We couldn't create an account with these details. If you already have one, log in.", values };
    }
    return { status: "error", message: describeAuthError(error), values };
  }
  // Dashboard "Confirm email" still on: no session yet. The phone is collected on /verify-phone after the email link.
  if (!data.session) return { status: "success", message: email, values };

  // Signed in but locked until the SMS code is entered (proxy + requireUser enforce this).
  const { error: phoneError } = await supabase.auth.updateUser({ phone });
  redirect(phoneError ? `${VERIFY_PHONE_PATH}?error=${encodeURIComponent(phoneError.code ?? "unknown")}` : VERIFY_PHONE_PATH);
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
  if (error && reportable(error)) return { status: "error", message: describeAuthError(error) };
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
  if (error && reportable(error)) return { status: "error", message: describeAuthError(error), values };
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
    return { status: "error", message: describeAuthError(error) };
  }
  redirect(HOME_PATH);
}

/** Texts a verification code to a new number for the signed-in account. */
export async function sendPhoneCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const raw = readForm(formData);
  const values = { phoneCountry: raw.phoneCountry ?? "", phone: raw.phone ?? "" };
  const parsed = phoneOnlySchema.safeParse(raw);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect(`${LOGIN_PATH}?next=${VERIFY_PHONE_PATH}`);

  const { error } = await supabase.auth.updateUser({ phone: parsed.data.phone });
  if (error) return { status: "error", message: describeAuthError(error), values };
  return { status: "success", message: parsed.data.phone };
}

/** Re-sends the code for the number already awaiting verification (read from the server, not the form). */
export async function resendPhoneCode(): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`${LOGIN_PATH}?next=${VERIFY_PHONE_PATH}`);
  if (!data.user.new_phone) return { status: "error", message: "Enter your number again to get a new code." };

  const { error } = await supabase.auth.resend({ type: "phone_change", phone: data.user.new_phone });
  if (error) return { status: "error", message: describeAuthError(error) };
  return { status: "success", message: "New code sent." };
}

export async function verifyPhoneCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = phoneCodeSchema.safeParse(readForm(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;

  const supabase = await createClient();
  // getUser() asks the Auth server, so the pending number can't be swapped by the client.
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`${LOGIN_PATH}?next=${VERIFY_PHONE_PATH}`);
  if (!data.user.new_phone) return { status: "error", message: "Enter your number again to get a new code." };

  const { error } = await supabase.auth.verifyOtp({ phone: data.user.new_phone, token: parsed.data.code, type: "phone_change" });
  if (error) return { status: "error", fieldErrors: { code: describeAuthError(error) } };
  redirect("/onboarding");
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect(LOGIN_PATH);
}
