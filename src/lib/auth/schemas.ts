import { z } from "zod";
import { findCountry } from "./countries";

/**
 * Server-side validation for every auth form. Client checks are UX only; these
 * run inside the server actions before anything reaches Supabase.
 */
export const PASSWORD_MIN = 10;
/** bcrypt (used by Supabase Auth) ignores bytes past 72. */
export const PASSWORD_MAX = 72;

const email = z.string().trim().min(1, "Enter your email address").max(254, "Email is too long").pipe(z.email("Enter a valid email address"));

/** Mirrors the `profiles.username` check constraint. */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Use 3–30 letters, numbers, dots or underscores");

/** Strips spaces, dashes, dots and parentheses: "+1 (312) 555-0142" → "+13125550142". */
export function normalizePhone(value: string) {
  return value.replace(/[\s().-]/g, "");
}

/**
 * Joins the picked country's calling code and the typed number: ("GB", "07946 095 800") →
 * "+447946095800". Drops the national trunk prefix. A number already starting with "+" or "00"
 * is taken as international and the country is ignored.
 */
export function toInternational(country: string, number: string) {
  const n = normalizePhone(number.trim());
  if (!n || n.startsWith("+")) return n;
  if (n.startsWith("00")) return `+${n.slice(2)}`;
  const c = findCountry(country);
  if (!c) return n;
  return `+${c.dial}${c.trunk && n.startsWith(c.trunk) ? n.slice(c.trunk.length) : n}`;
}

/** Form data carries `phoneCountry` + `phone`; validation sees `phone` as one E.164 string. */
function withCountryCode(input: unknown) {
  if (!input || typeof input !== "object") return input;
  const { phone, phoneCountry } = input as Record<string, unknown>;
  if (typeof phone !== "string") return input;
  return { ...input, phone: toInternational(typeof phoneCountry === "string" ? phoneCountry : "", phone) };
}

/** E.164: "+", country code, subscriber number — 8 to 15 digits in total. */
const phone = z
  .string()
  .trim()
  .min(1, "Enter your mobile number")
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Check the country code and number"));

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`)
  .refine((p) => p.trim().length > 0, "Password can't be only spaces");

/** Email or username ("@" prefix allowed). Usernames are resolved to an email on the server. */
const loginIdentifier = z
  .string()
  .trim()
  .min(1, "Enter your email or username")
  .max(254, "Incorrect email, username, or password")
  .transform((v) => v.replace(/^@/, "").toLowerCase())
  .pipe(z.union([z.email(), z.string().regex(USERNAME_PATTERN)], "Enter a valid email or username"));

export const signInSchema = z.object({
  identifier: loginIdentifier,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, "Incorrect email, username, or password"),
  next: z.string().optional(),
});

export const signUpSchema = z.preprocess(
  withCountryCode,
  z.object({
    username,
    email,
    phone,
    password: newPassword,
    terms: z.literal("on", "You must agree to continue"),
  }),
);

export const emailOnlySchema = z.object({ email });

export const phoneOnlySchema = z.preprocess(withCountryCode, z.object({ phone }));

/** SMS codes are 6 digits by default (Supabase allows 6–10). */
export const phoneCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .transform((c) => c.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6,10}$/, "Enter the code from the text message")),
});

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

export const EMAIL_OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;

export const confirmParamsSchema = z.union([
  z.object({ token_hash: z.string().min(1).max(512), type: z.enum(EMAIL_OTP_TYPES) }),
  z.object({ code: z.string().min(1).max(512) }),
]);

/** First message per field, for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
