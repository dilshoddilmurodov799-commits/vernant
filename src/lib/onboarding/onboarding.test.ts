import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accountSchema,
  DEFAULT_PREFERENCES,
  photoFileError,
  PHOTO_MAX_BYTES,
  preferencesSchema,
  profileDetailsSchema,
  readOnboardingForm,
} from "./schemas";
import { nextStep, previousStep, resumeStep, signupStepNumber, SIGNUP_STEPS } from "./steps";
import { fieldErrors } from "../auth/schemas";

test("the indicator counts five sign-up steps; onboarding is steps 3-5", () => {
  assert.equal(SIGNUP_STEPS.length, 5);
  assert.equal(signupStepNumber("account"), 3);
  assert.equal(signupStepNumber("profile"), 4);
  assert.equal(signupStepNumber("preferences"), 5);
});

test("steps move forward to done, and back never returns to phone verification", () => {
  assert.equal(nextStep("account"), "profile");
  assert.equal(nextStep("profile"), "preferences");
  assert.equal(nextStep("preferences"), "done");
  assert.equal(previousStep("preferences"), "profile");
  assert.equal(previousStep("profile"), "account");
  assert.equal(previousStep("account"), null);
});

test("unfinished accounts resume at the first screen they haven't saved", () => {
  assert.equal(resumeStep(null), "account");
  assert.equal(resumeStep({ onboarding_step: 0 }), "profile");
  assert.equal(resumeStep({ onboarding_step: 1 }), "profile");
  assert.equal(resumeStep({ onboarding_step: 2 }), "preferences");
  assert.equal(resumeStep({ onboarding_step: 3 }), "preferences");
});

test("account step: lowercased username, consent required, password optional but strong when given", () => {
  const ok = accountSchema.safeParse({ username: " Sam.Bear_1 ", password: "", terms: "on" });
  assert.ok(ok.success);
  assert.equal(ok.data.username, "sam.bear_1");
  assert.equal(ok.data.password, undefined);
  assert.ok(accountSchema.safeParse({ username: "sam", password: "correct horse battery", terms: "on" }).success);
  for (const [input, field] of [
    [{ username: "sam", terms: "" }, "terms"],
    [{ username: "sam" }, "terms"],
    [{ username: "s", terms: "on" }, "username"],
    [{ username: "sam bear", terms: "on" }, "username"],
    [{ username: "sam", password: "short", terms: "on" }, "password"],
    [{ username: "sam", password: "x".repeat(73), terms: "on" }, "password"],
  ] as const) {
    const r = accountSchema.safeParse(input);
    assert.ok(!r.success, JSON.stringify(input));
    assert.ok(fieldErrors(r.error)[field], `${field} for ${JSON.stringify(input)}`);
  }
});

test("profile details accept only known options and enforce limits", () => {
  const form = new FormData();
  form.set("bio", "  Weekend baker.  ");
  form.set("pronouns", "he/him");
  form.set("city", "Portland");
  for (const v of ["Bear", "Bear", "Otter"]) form.append("identities", v);
  form.append("interests", "Baking");
  form.append("lookingFor", "Dating");
  const ok = profileDetailsSchema.safeParse(readOnboardingForm(form));
  assert.ok(ok.success);
  assert.equal(ok.data.bio, "Weekend baker.");
  assert.deepEqual(ok.data.identities, ["Bear", "Otter"]);

  const empty = profileDetailsSchema.safeParse(readOnboardingForm(new FormData()));
  assert.ok(!empty.success, "bio, pronouns and city must be present (the form always sends them)");
  const skipped = profileDetailsSchema.safeParse({ bio: "", pronouns: "", city: "", identities: [], interests: [], lookingFor: [] });
  assert.ok(skipped.success, "every field can be left empty");

  const base = { bio: "", pronouns: "", city: "", identities: [], interests: [], lookingFor: [] };
  assert.ok(!profileDetailsSchema.safeParse({ ...base, bio: "x".repeat(301) }).success);
  assert.ok(!profileDetailsSchema.safeParse({ ...base, pronouns: "xe/xem; drop table" }).success);
  assert.ok(!profileDetailsSchema.safeParse({ ...base, identities: ["Admin"] }).success);
  const elevenInterests = ["Art", "Baking", "BBQ", "Board games", "Camping", "Coffee", "Cooking", "Cycling", "Dogs", "Film", "Gaming"];
  assert.ok(!profileDetailsSchema.safeParse({ ...base, interests: elevenInterests }).success);
});

test("preferences validate ranges, distance options and switches", () => {
  const valid = { interestedIn: ["Chub"], ageMin: "25", ageMax: "40", maxDistanceKm: "50", visibility: "everyone", showDistance: "false", showOnline: "true" };
  const ok = preferencesSchema.safeParse(valid);
  assert.ok(ok.success);
  assert.deepEqual(ok.data, { interestedIn: ["Chub"], ageMin: 25, ageMax: 40, maxDistanceKm: 50, visibility: "everyone", showDistance: false, showOnline: true });
  assert.equal(preferencesSchema.safeParse({ ...valid, maxDistanceKm: "" }).data?.maxDistanceKm, null);
  for (const patch of [
    { ageMin: "17" },
    { ageMax: "100" },
    { ageMin: "50", ageMax: "30" },
    { maxDistanceKm: "33" },
    { visibility: "public" },
    { showOnline: "yes" },
    { interestedIn: ["Robot"] },
  ]) {
    assert.ok(!preferencesSchema.safeParse({ ...valid, ...patch }).success, JSON.stringify(patch));
  }
  assert.equal(DEFAULT_PREFERENCES.visibility, "members");
});

test("photo pre-checks reject empty, oversized and non-image uploads", () => {
  assert.equal(photoFileError({ size: 1000, type: "image/jpeg" }), null);
  assert.ok(photoFileError({ size: 0, type: "image/jpeg" }));
  assert.ok(photoFileError({ size: PHOTO_MAX_BYTES + 1, type: "image/png" }));
  assert.ok(photoFileError({ size: 1000, type: "image/svg+xml" }));
  assert.ok(photoFileError({ size: 1000, type: "image/heic" }));
});
