"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED } from "@/lib/supabase/env";
import { describeAuthError } from "./errors";
import type { AuthFormState } from "./form-state";
import { otpMethodsFromEnv, requestCode, verifyCode } from "./otp";
import { HOME_PATH, LOGIN_PATH, VERIFY_PHONE_PATH, safeNextPath } from "./paths";
import { emailOnlySchema, fieldErrors, phoneCodeSchema, phoneOnlySchema, resetPasswordSchema, signInSchema } from "./schemas";

export type { AuthFormState } from "./form-state";

/**
 * Auth server actions. Every input is re-validated with Zod here; Supabase Auth
 * then applies its own rate limits and password policy. Messages never reveal
 * whether an email address or phone number has an account.
 */
const NOT_CONFIGURED: AuthFormState = { status: "error", message: SUPABASE_NOT_CONFIGURED };
const PHONE_UNAVAILABLE: AuthFormState = { status: "error", message: "Adding a phone number isn't available yet." };

function readForm(formData: FormData) {
  return Object.fromEntries([...formData].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

/** The visitor's IP for app-side rate limits. Only as trustworthy as the proxy that sets it. */
async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Absolute URL for links in auth emails. Next.js verifies the Origin header on server actions. */
async function siteUrl(path: string) {
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return new URL(path, origin).toString();
}

/**
 * Log-in identity for a username, via the service-role-only `login_identity` RPC, so emails
 * and numbers never reach the browser. Phone-first accounts have no email, so they sign in
 * with their phone number and password. `null` means no such username; "unavailable" means
 * the lookup can't run (no secret key, or the migrations aren't applied).
 */
async function identityForUsername(username: string): Promise<{ email: string } | { phone: string } | null | "unavailable"> {
  const admin = createAdminClient();
  if (!admin) return "unavailable";
  const { data, error } = await admin.rpc("login_identity", { p_username: username });
  if (error) return "unavailable";
  const row = (Array.isArray(data) ? data[0] : null) as { email: string | null; phone: string | null } | null;
  if (row?.email) return { email: row.email };
  if (row?.phone) return { phone: row.phone };
  return null;
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
  const credentials = byEmail ? { email: identifier } : await identityForUsername(identifier);
  if (credentials === "unavailable") {
    return { status: "error", message: "Username log-in isn't available right now. Use your email address or a one-time code.", values };
  }
  // Unknown usernames get the same answer as a wrong password.
  if (!credentials) return { status: "error", message: describeAuthError({ code: "invalid_credentials" }), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ ...credentials, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message: "Confirm your email address first — check your inbox for the link.",
        // Only echo an address the user typed; never reveal the one behind a username.
        unconfirmedEmail: byEmail ? identifier : undefined,
        values,
      };
    }
    return { status: "error", message: describeAuthError(error), values };
  }
  redirect(safeNextPath(parsed.data.next, HOME_PATH));
}

/** Sign-up and code log-in, step 1 (lib/auth/otp.ts). Also used to resend. */
export async function requestSignInCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  return requestCode(supabase.auth, readForm(formData), {
    methods: otpMethodsFromEnv(process.env),
    ip: await clientIp(),
    // Only used if the email template still sends a link instead of {{ .Token }}.
    emailRedirectTo: await siteUrl("/auth/confirm?next=/onboarding"),
  });
}

/** Step 2: verifies the code (lib/auth/otp.ts) and continues to onboarding. */
export async function verifySignInCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const result = await verifyCode(supabase.auth, readForm(formData), { methods: otpMethodsFromEnv(process.env) });
  if (result.status === "verified") redirect(result.redirectTo);
  return result;
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

/** Texts a verification code to a new number for the signed-in account (only with SMS enabled). */
export async function sendPhoneCode(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  if (!otpMethodsFromEnv(process.env).includes("sms")) return PHONE_UNAVAILABLE;
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
  if (!otpMethodsFromEnv(process.env).includes("sms")) return PHONE_UNAVAILABLE;
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
