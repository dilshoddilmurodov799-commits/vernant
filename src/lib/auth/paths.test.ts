import { test } from "node:test";
import assert from "node:assert/strict";
import { afterOnboardingPath, isBrowsePath, isGuestOnlyPath, isPublicPath, onboardingPath, safeNextPath } from "./paths";

test("safeNextPath keeps same-origin paths", () => {
  assert.equal(safeNextPath("/messages/c_kai"), "/messages/c_kai");
  assert.equal(safeNextPath("/discover?q=bear#top"), "/discover?q=bear#top");
});

test("safeNextPath rejects open redirects", () => {
  for (const bad of ["//evil.test", "/\\evil.test", "https://evil.test", "evil.test", "javascript:alert(1)", "/%5Cevil.test\\x", ""]) {
    assert.equal(safeNextPath(bad), "/feed", bad);
  }
  assert.equal(safeNextPath(null, "/onboarding"), "/onboarding");
});

test("routes fail closed: only listed pages are public", () => {
  for (const p of ["/", "/login", "/register", "/forgot-password", "/auth/confirm", "/auth/error"]) assert.ok(isPublicPath(p), p);
  for (const p of ["/messages", "/messages/c_kai", "/matches", "/notifications", "/settings", "/onboarding", "/reset-password", "/design", "/auth", "/verify-phone"]) {
    assert.ok(!isPublicPath(p), p);
  }
});

test("guests can browse posts, people, profiles and stories, but not their own profile", () => {
  for (const p of ["/feed", "/discover", "/profile/marcus.hale", "/stories/s_sam"]) {
    assert.ok(isBrowsePath(p), p);
    assert.ok(isPublicPath(p), p);
  }
  for (const p of ["/profile/me", "/profile/", "/profile", "/stories/", "/stories", "/feedback", "/discover/x"]) {
    assert.ok(!isPublicPath(p), p);
  }
});

test("signed-in users are bounced from guest-only pages but can reach reset and confirm", () => {
  assert.ok(isGuestOnlyPath("/login"));
  assert.ok(isGuestOnlyPath("/register"));
  assert.ok(!isGuestOnlyPath("/reset-password"));
  assert.ok(!isGuestOnlyPath("/auth/confirm"));
});

test("after a verified code, everyone goes to onboarding, carrying only a safe destination", () => {
  assert.equal(onboardingPath(""), "/onboarding");
  assert.equal(onboardingPath(undefined), "/onboarding");
  assert.equal(onboardingPath("/profile/marcus.hale"), "/onboarding?next=%2Fprofile%2Fmarcus.hale");
  assert.equal(onboardingPath("//evil.test"), "/onboarding");
  assert.equal(onboardingPath("https://evil.test/x"), "/onboarding");
});

test("finished onboarding goes to next, Discover by default, and never loops back", () => {
  assert.equal(afterOnboardingPath(""), "/discover");
  assert.equal(afterOnboardingPath("/messages/c_kai"), "/messages/c_kai");
  assert.equal(afterOnboardingPath("/onboarding"), "/discover");
  assert.equal(afterOnboardingPath("/onboarding?next=/x"), "/discover");
  assert.equal(afterOnboardingPath("//evil.test"), "/discover");
  assert.equal(afterOnboardingPath("", "/feed"), "/feed");
});
