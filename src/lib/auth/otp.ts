import { describeAuthError } from "./errors";
import type { AuthFormState, OtpMethod } from "./form-state";
import { onboardingPath } from "./paths";
import { RateLimiter } from "./rate-limit";
import { emailCodeStartSchema, emailCodeVerifySchema, fieldErrors, phoneCodeStartSchema, phoneCodeVerifySchema } from "./schemas";

/**
 * Sign-up and log-in with a one-time code through Supabase Auth. Email is always available.
 * SMS and WhatsApp are offered only once the operator has configured and tested that channel
 * in Supabase and set AUTH_SMS_ENABLED / AUTH_WHATSAPP_ENABLED. Supabase generates, sends and
 * checks the codes; this module only forwards the typed code to verifyOtp, and never logs or
 * stores it. The Supabase client is passed in, which keeps this unit-testable.
 */
export const OTP_METHODS: readonly OtpMethod[] = ["email", "sms", "whatsapp"];

export function otpMethodsFromEnv(env: Record<string, string | undefined>): OtpMethod[] {
  const methods: OtpMethod[] = ["email"];
  if (env.AUTH_SMS_ENABLED === "true") methods.push("sms");
  if (env.AUTH_WHATSAPP_ENABLED === "true") methods.push("whatsapp");
  return methods;
}

type AuthResult = { error: { code?: string | null; status?: number } | null };

/** The slice of `supabase.auth` this flow uses. */
export interface OtpAuthClient {
  signInWithOtp(
    credentials:
      | { email: string; options: { shouldCreateUser: boolean; emailRedirectTo?: string } }
      | { phone: string; options: { shouldCreateUser: boolean; channel: "sms" | "whatsapp" } },
  ): Promise<AuthResult>;
  verifyOtp(
    params: { email: string; token: string; type: "email" } | { phone: string; token: string; type: "sms" },
  ): Promise<AuthResult & { data: { session: unknown } }>;
}

const MINUTE = 60_000;

export interface OtpLimits {
  sendPerContact: RateLimiter;
  sendPerIp: RateLimiter;
  verifyPerContact: RateLimiter;
}

/** On top of Supabase's limits (one code per address per 60 s, hourly send caps, per-IP buckets). */
export function createOtpLimits(): OtpLimits {
  return {
    sendPerContact: new RateLimiter(5, 15 * MINUTE),
    sendPerIp: new RateLimiter(20, 15 * MINUTE),
    verifyPerContact: new RateLimiter(10, 15 * MINUTE),
  };
}

/** Shared by every request this server instance handles. */
export const otpLimits = createOtpLimits();

export function tooManyAttempts(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

const UNAVAILABLE = "That sign-in method isn't available.";

function readMethod(raw: Record<string, string>, methods: readonly OtpMethod[]) {
  const method = raw.method || "email";
  return methods.find((m) => m === method) ?? null;
}

/**
 * Step 1: asks Supabase to send a code. New addresses get an account once the code is
 * verified and known ones log in, so the answer is the same either way and never reveals
 * whether an address or number is registered. Only reports success when Supabase accepted it.
 */
export async function requestCode(
  auth: OtpAuthClient,
  raw: Record<string, string>,
  opts: { methods: readonly OtpMethod[]; ip: string; emailRedirectTo?: string; limits?: OtpLimits; now?: number },
): Promise<AuthFormState> {
  const { limits = otpLimits, now = Date.now() } = opts;
  const method = readMethod(raw, opts.methods);
  const values: Record<string, string> =
    method === "sms" || method === "whatsapp"
      ? { phoneCountry: raw.phoneCountry ?? "", phone: raw.phone ?? "", consent: raw.consent ?? "" }
      : { email: raw.email ?? "" };
  if (!method) return { status: "error", message: UNAVAILABLE, values };

  let contact: string;
  if (method === "email") {
    const parsed = emailCodeStartSchema.safeParse(raw);
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values, method };
    contact = parsed.data.email;
  } else {
    const parsed = phoneCodeStartSchema.safeParse(raw);
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error), values, method };
    contact = parsed.data.phone;
  }

  const wait = Math.max(limits.sendPerIp.hit(opts.ip, now), limits.sendPerContact.hit(contact, now));
  if (wait) return { status: "error", message: tooManyAttempts(wait), values, method };

  const { error } =
    method === "email"
      ? await auth.signInWithOtp({ email: contact, options: { shouldCreateUser: true, emailRedirectTo: opts.emailRedirectTo } })
      : await auth.signInWithOtp({ phone: contact, options: { shouldCreateUser: true, channel: method } });
  if (error) return { status: "error", message: describeAuthError(error, method), values, method };
  return { status: "success", method, contact, sentAt: now, values };
}

export type VerifyOutcome = AuthFormState | { status: "verified"; redirectTo: string };

/**
 * Step 2: checks the code with Supabase, which starts the session. Everyone continues to
 * onboarding, which creates or resumes the profile and sends finished accounts on to `next`.
 */
export async function verifyCode(
  auth: OtpAuthClient,
  raw: Record<string, string>,
  opts: { methods: readonly OtpMethod[]; limits?: OtpLimits; now?: number },
): Promise<VerifyOutcome> {
  const { limits = otpLimits, now = Date.now() } = opts;
  const method = readMethod(raw, opts.methods);
  if (!method) return { status: "error", message: UNAVAILABLE };

  let contact: string;
  let next: string | undefined;
  let params: Parameters<OtpAuthClient["verifyOtp"]>[0];
  if (method === "email") {
    const parsed = emailCodeVerifySchema.safeParse(raw);
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
    ({ email: contact, next } = parsed.data);
    params = { email: contact, token: parsed.data.code, type: "email" };
  } else {
    const parsed = phoneCodeVerifySchema.safeParse(raw);
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
    ({ phone: contact, next } = parsed.data);
    // Phone codes verify with type "sms" whichever channel delivered them.
    params = { phone: contact, token: parsed.data.code, type: "sms" };
  }

  // Caps guessing per address even when attempts come from many IPs.
  const wait = limits.verifyPerContact.hit(contact, now);
  if (wait) return { status: "error", fieldErrors: { code: tooManyAttempts(wait) } };

  const { data, error } = await auth.verifyOtp(params);
  if (error || !data.session) return { status: "error", fieldErrors: { code: describeAuthError(error ?? {}, method) } };
  limits.verifyPerContact.reset(contact);
  return { status: "verified", redirectTo: onboardingPath(next) };
}
