import { z } from "zod";
import { ageFromBirthDate } from "../utils";

/**
 * Server-side validation for every auth form. Client checks are UX only; these
 * run inside the server actions before anything reaches Supabase.
 */
export const MIN_AGE = 18;
export const PASSWORD_MIN = 10;
/** bcrypt (used by Supabase Auth) ignores bytes past 72. */
export const PASSWORD_MAX = 72;

const email = z.string().trim().min(1, "Enter your email address").max(254, "Email is too long").pipe(z.email("Enter a valid email address"));

const newPassword = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters`)
  .refine((p) => p.trim().length > 0, "Password can't be only spaces");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(PASSWORD_MAX, "Incorrect email or password"),
  next: z.string().optional(),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Enter a display name")
    .max(40, "Use at most 40 characters")
    .regex(/^[^\p{Cc}<>]+$/u, "Display name contains characters that aren't allowed"),
  email,
  password: newPassword,
  birthDate: z.iso.date("Enter your date of birth").superRefine((value, ctx) => {
    const age = ageFromBirthDate(value);
    if (age === null || age > 120 || age < 0) ctx.addIssue({ code: "custom", message: "Enter a valid date of birth" });
    else if (age < MIN_AGE) ctx.addIssue({ code: "custom", message: `You must be ${MIN_AGE} or older to join` });
  }),
  terms: z.literal("on", "You must confirm to continue"),
});

export const emailOnlySchema = z.object({ email });

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
