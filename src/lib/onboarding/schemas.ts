import { z } from "zod";
import { newPassword, username } from "../auth/schemas";
import { IDENTITIES, INTENTS, INTERESTS, PRONOUNS } from "../types";

/**
 * Server-side validation for the onboarding screens. Limits mirror the DB constraints in
 * supabase/migrations (0001 + 0002). Kept dependency-free (relative imports) for tests.
 */

/**
 * Recorded with each acceptance (profile_private.terms_version). No Terms of Service or
 * Privacy Policy is published yet; bump this when they are so members re-accept.
 */
export const TERMS_VERSION = "unpublished-draft";

export const BIO_MAX = 300;
export const CITY_MAX = 60;
export const INTERESTS_MAX = 10;
export const AGE_MIN = 18;
export const AGE_MAX = 99;
/** Discovery radius choices in km; no value means any distance. */
export const DISTANCE_OPTIONS = [10, 25, 50, 100, 250] as const;

export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoStatus = "pending" | "approved" | "rejected";

const unique = <T>(list: T[]) => [...new Set(list)];
const toggle = z.enum(["true", "false"]).transform((v) => v === "true");

/** The password may be left blank when the account already has one (checked by the action). */
export const accountSchema = z.object({
  username,
  password: z.preprocess((v) => (v === "" ? undefined : v), newPassword.optional()),
  terms: z.literal("on", "Agree to the Terms of Service and Privacy Policy to continue"),
});

export const profileDetailsSchema = z.object({
  bio: z.string().trim().max(BIO_MAX, `Keep it under ${BIO_MAX} characters`),
  pronouns: z.union([z.literal(""), z.enum(PRONOUNS)], "Pick pronouns from the list"),
  city: z.string().trim().max(CITY_MAX, `Keep it under ${CITY_MAX} characters`),
  identities: z.array(z.enum(IDENTITIES, "Pick from the list")).transform(unique),
  interests: z
    .array(z.enum(INTERESTS, "Pick from the list"))
    .transform(unique)
    .refine((list) => list.length <= INTERESTS_MAX, `Pick up to ${INTERESTS_MAX}`),
  lookingFor: z.array(z.enum(INTENTS, "Pick from the list")).transform(unique),
});
export type ProfileDetails = z.output<typeof profileDetailsSchema>;

const age = z.coerce.number("Pick an age").int().min(AGE_MIN, `${AGE_MIN} is the minimum`).max(AGE_MAX, `${AGE_MAX} is the maximum`);

export const preferencesSchema = z
  .object({
    interestedIn: z.array(z.enum(IDENTITIES, "Pick from the list")).transform(unique),
    ageMin: age,
    ageMax: age,
    maxDistanceKm: z.string().transform((v, ctx) => {
      if (v === "") return null;
      const km = Number(v);
      if ((DISTANCE_OPTIONS as readonly number[]).includes(km)) return km;
      ctx.addIssue({ code: "custom", message: "Pick a distance from the list" });
      return z.NEVER;
    }),
    visibility: z.enum(["everyone", "members", "matches"], "Pick who can see you"),
    showDistance: toggle,
    showOnline: toggle,
  })
  .refine((v) => v.ageMin <= v.ageMax, { message: "The minimum age can't be above the maximum", path: ["ageMax"] });
export type Preferences = z.output<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  interestedIn: [],
  ageMin: AGE_MIN,
  ageMax: AGE_MAX,
  maxDistanceKm: null,
  visibility: "members",
  showDistance: true,
  showOnline: true,
};

const LIST_FIELDS = new Set(["identities", "interests", "lookingFor", "interestedIn"]);

/** FormData → plain object; repeated list fields become arrays, files are dropped. */
export function readOnboardingForm(formData: FormData) {
  const out: Record<string, string | string[]> = {};
  for (const key of LIST_FIELDS) out[key] = [];
  for (const [key, value] of formData) {
    if (typeof value !== "string") continue;
    if (LIST_FIELDS.has(key)) (out[key] as string[]).push(value);
    else out[key] = value;
  }
  return out;
}

/** Cheap pre-checks before decoding an upload; the server still inspects the bytes. */
export function photoFileError(file: { size: number; type: string }) {
  if (file.size === 0) return "Choose a photo to upload.";
  if (file.size > PHOTO_MAX_BYTES) return `Photos can be up to ${PHOTO_MAX_BYTES / 1024 / 1024} MB.`;
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "Use a JPG, PNG or WebP photo.";
  return null;
}
