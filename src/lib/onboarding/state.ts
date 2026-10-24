import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session";
import { IDENTITIES, INTENTS, INTERESTS, PRONOUNS } from "@/lib/types";
import { DEFAULT_PREFERENCES, type PhotoStatus, type Preferences } from "./schemas";
import { resumeStep, type OnboardingDraft } from "./steps";

/** Signed preview URLs for your own photo during onboarding. */
const PREVIEW_TTL_SECONDS = 600;

interface ProfileRow {
  username: string;
  bio: string;
  pronouns: string | null;
  city: string | null;
  identities: string[];
  interests: string[];
  looking_for: string[];
  visibility: Preferences["visibility"];
  show_distance: boolean;
  show_online: boolean;
  onboarding_step: number;
  onboarded_at: string | null;
}

interface PreferencesRow {
  interested_in: string[];
  age_min: number;
  age_max: number;
  max_distance_km: number | null;
}

/** Keeps only values the current option lists know, so the client never gets unexpected tags. */
function known<T extends string>(values: string[] | null | undefined, options: readonly T[]) {
  return (values ?? []).filter((v): v is T => (options as readonly string[]).includes(v));
}

/**
 * Everything the signed-in account has saved so far, read through RLS with its own session.
 * "finished" when onboarding is already done; "unavailable" when the data can't be read
 * (e.g. migrations not applied), so the page can show an error instead of a broken form.
 */
export async function loadOnboardingDraft(user: SessionUser): Promise<OnboardingDraft | "finished" | "unavailable"> {
  const supabase = await createClient();
  const [profileRes, prefsRes, photoRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, bio, pronouns, city, identities, interests, looking_for, visibility, show_distance, show_online, onboarding_step, onboarded_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("user_preferences").select("interested_in, age_min, age_max, max_distance_km").eq("user_id", user.id).maybeSingle(),
    supabase.from("profile_photos").select("storage_path, status").eq("user_id", user.id).eq("sort_order", 0).maybeSingle(),
  ]);
  if (profileRes.error || prefsRes.error || photoRes.error) return "unavailable";

  const profile = profileRes.data as ProfileRow | null;
  if (profile?.onboarded_at) return "finished";
  const prefs = prefsRes.data as PreferencesRow | null;
  const photoRow = photoRes.data as { storage_path: string; status: PhotoStatus } | null;

  let photo: OnboardingDraft["photo"] = null;
  if (photoRow) {
    const { data } = await supabase.storage.from("media").createSignedUrl(photoRow.storage_path, PREVIEW_TTL_SECONDS);
    if (data) photo = { url: data.signedUrl, status: photoRow.status };
  }

  return {
    step: resumeStep(profile),
    hasAccount: Boolean(profile),
    // Email accounts from the earlier sign-up flow already log in with a password.
    needsPassword: !profile && !user.email,
    username: profile?.username ?? "",
    profile: {
      bio: profile?.bio ?? "",
      pronouns: known(profile?.pronouns ? [profile.pronouns] : [], PRONOUNS)[0] ?? "",
      city: profile?.city ?? "",
      identities: known(profile?.identities, IDENTITIES),
      interests: known(profile?.interests, INTERESTS),
      lookingFor: known(profile?.looking_for, INTENTS),
    },
    photo,
    preferences: {
      interestedIn: known(prefs?.interested_in, IDENTITIES),
      ageMin: prefs?.age_min ?? DEFAULT_PREFERENCES.ageMin,
      ageMax: prefs?.age_max ?? DEFAULT_PREFERENCES.ageMax,
      maxDistanceKm: prefs?.max_distance_km ?? DEFAULT_PREFERENCES.maxDistanceKm,
      visibility: profile?.visibility ?? DEFAULT_PREFERENCES.visibility,
      showDistance: profile?.show_distance ?? DEFAULT_PREFERENCES.showDistance,
      showOnline: profile?.show_online ?? DEFAULT_PREFERENCES.showOnline,
    },
  };
}
