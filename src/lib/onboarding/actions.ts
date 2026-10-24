"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { describeAuthError } from "@/lib/auth/errors";
import { LOGIN_PATH, ONBOARDING_PATH } from "@/lib/auth/paths";
import { fieldErrors, username as usernameSchema } from "@/lib/auth/schemas";
import { PhotoError, processPhoto } from "@/lib/media/photo";
import {
  accountSchema,
  photoFileError,
  preferencesSchema,
  profileDetailsSchema,
  readOnboardingForm,
  TERMS_VERSION,
  type PhotoStatus,
} from "./schemas";

/**
 * Onboarding server actions. The user id always comes from the verified session (getClaims),
 * never from the form; writes go through RLS with the member's own session, except processed
 * photo uploads (secret key, after validation). Every step is safe to retry.
 */
export interface OnboardingResult {
  status: "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  photo?: { url: string; status: PhotoStatus };
}

export interface UsernameCheck {
  status: "available" | "taken" | "invalid" | "unknown";
  message: string;
}

const UNAVAILABLE: OnboardingResult = { status: "error", message: "We couldn't save that right now. Try again in a moment." };
const ACCOUNT_FIRST: OnboardingResult = { status: "error", message: "Finish the account step first." };
const PREVIEW_TTL_SECONDS = 600;

/** The signed-in account. Onboarding needs a verified email or phone (the database checks again). */
async function currentAccount() {
  if (!isSupabaseConfigured()) redirect(LOGIN_PATH);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect(`${LOGIN_PATH}?next=${ONBOARDING_PATH}`);
  if (!claims.email && !claims.phone) redirect(LOGIN_PATH);
  return { supabase, userId: claims.sub, email: claims.email };
}

/** Live hint while typing. The unique constraint in save_account() is the real guard. */
export async function checkUsername(value: unknown): Promise<UsernameCheck> {
  const parsed = usernameSchema.safeParse(value);
  if (!parsed.success) return { status: "invalid", message: parsed.error.issues[0]?.message ?? "Invalid username" };
  const { supabase } = await currentAccount();
  const { data, error } = await supabase.rpc("username_available", { p_username: parsed.data });
  if (error) return { status: "unknown", message: "Couldn't check that username right now." };
  return data ? { status: "available", message: `@${parsed.data} is available` } : { status: "taken", message: "That username is taken" };
}

/** Account step: username, password (phone-only accounts) and consent. */
export async function saveAccount(formData: FormData): Promise<OnboardingResult> {
  const parsed = accountSchema.safeParse(readOnboardingForm(formData));
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
  const { supabase, userId, email } = await currentAccount();
  const { username, password } = parsed.data;

  // A profile row means this step already ran, and set the password if one was needed.
  const { data: existing, error: readError } = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (readError) return UNAVAILABLE;
  if (!existing && !email && !password) {
    return { status: "error", fieldErrors: { password: "Create a password so you can log in with your username" } };
  }

  if (password) {
    const { error } = await supabase.auth.updateUser({ password });
    // A retry with the same password is fine.
    if (error && error.code !== "same_password") return { status: "error", fieldErrors: { password: describeAuthError(error) } };
  }

  const { error } = await supabase.rpc("save_account", { p_username: username, p_terms_version: TERMS_VERSION });
  if (error?.code === "23505") return { status: "error", fieldErrors: { username: "That username is taken" } };
  if (error?.code === "23514") return { status: "error", fieldErrors: { username: "Use 3–30 letters, numbers, dots or underscores" } };
  if (error) return UNAVAILABLE;
  return { status: "success" };
}

/** Profile step. `intent=skip` moves on without changing anything. */
export async function saveProfile(formData: FormData): Promise<OnboardingResult> {
  const { supabase, userId } = await currentAccount();
  let patch: Record<string, unknown> = {};
  if (formData.get("intent") !== "skip") {
    const parsed = profileDetailsSchema.safeParse(readOnboardingForm(formData));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
    const { bio, pronouns, city, identities, interests, lookingFor } = parsed.data;
    patch = { bio, pronouns: pronouns || null, city: city || null, identities, interests, looking_for: lookingFor };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, onboarding_step: 2 })
    .eq("id", userId)
    .select("id");
  if (error) return UNAVAILABLE;
  return data.length ? { status: "success" } : ACCOUNT_FIRST;
}

/**
 * Primary profile photo. Validated and re-encoded on the server (EXIF/GPS stripped), stored
 * in the private `media` bucket, and recorded as `pending`: nobody else sees it until
 * moderation approves it. No automated scanner is connected yet, so review is manual.
 */
export async function uploadPhoto(formData: FormData): Promise<OnboardingResult> {
  const { supabase, userId } = await currentAccount();
  const file = formData.get("photo");
  if (!(file instanceof File)) return { status: "error", message: "Choose a photo to upload." };
  const problem = photoFileError(file);
  if (problem) return { status: "error", message: problem };

  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Photo uploads aren't available yet. Skip this for now and add one later." };

  let processed: Awaited<ReturnType<typeof processPhoto>>;
  try {
    processed = await processPhoto(Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return { status: "error", message: e instanceof PhotoError ? e.message : "We couldn't process that photo." };
  }

  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const bucket = admin.storage.from("media");
  const { error: uploadError } = await bucket.upload(path, processed.data, { contentType: "image/webp", upsert: false });
  if (uploadError) return UNAVAILABLE;

  const { data: previous } = await admin.from("profile_photos").select("storage_path").eq("user_id", userId).eq("sort_order", 0).maybeSingle();
  const { error: rowError } = await admin
    .from("profile_photos")
    .upsert(
      { user_id: userId, storage_path: path, sort_order: 0, status: "pending", width: processed.width, height: processed.height },
      { onConflict: "user_id,sort_order" },
    );
  if (rowError) {
    await bucket.remove([path]);
    return rowError.code === "23503" ? ACCOUNT_FIRST : UNAVAILABLE;
  }
  if (previous?.storage_path) await bucket.remove([previous.storage_path]);

  // Preview through the member's own session (storage RLS allows reading your own folder).
  const { data: signed } = await supabase.storage.from("media").createSignedUrl(path, PREVIEW_TTL_SECONDS);
  return { status: "success", photo: { url: signed?.signedUrl ?? "", status: "pending" } };
}

export async function removePhoto(): Promise<OnboardingResult> {
  const { supabase, userId } = await currentAccount();
  const { data, error } = await supabase.from("profile_photos").delete().eq("user_id", userId).eq("sort_order", 0).select("storage_path");
  if (error) return UNAVAILABLE;
  const paths = data.map((row) => row.storage_path as string);
  if (paths.length) await supabase.storage.from("media").remove(paths);
  return { status: "success" };
}

/** Last step: saves preferences (unless skipped) and marks onboarding finished. */
export async function savePreferences(formData: FormData): Promise<OnboardingResult> {
  const { supabase, userId } = await currentAccount();
  if (formData.get("intent") !== "skip") {
    const parsed = preferencesSchema.safeParse(readOnboardingForm(formData));
    if (!parsed.success) return { status: "error", fieldErrors: fieldErrors(parsed.error) };
    const p = parsed.data;
    const [prefs, profile] = await Promise.all([
      supabase.from("user_preferences").upsert({
        user_id: userId,
        interested_in: p.interestedIn,
        age_min: p.ageMin,
        age_max: p.ageMax,
        max_distance_km: p.maxDistanceKm,
      }),
      supabase.from("profiles").update({ visibility: p.visibility, show_distance: p.showDistance, show_online: p.showOnline }).eq("id", userId),
    ]);
    if (prefs.error?.code === "23503") return ACCOUNT_FIRST;
    if (prefs.error || profile.error) return UNAVAILABLE;
  }

  const { error } = await supabase.rpc("complete_onboarding");
  if (error?.code === "55000") return ACCOUNT_FIRST;
  if (error) return UNAVAILABLE;
  return { status: "success" };
}
