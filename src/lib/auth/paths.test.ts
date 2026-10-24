import { test } from "node:test";
import assert from "node:assert/strict";
import { isGuestOnlyPath, isPublicPath, safeNextPath } from "./paths";

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
  for (const p of ["/feed", "/messages/c_kai", "/settings", "/onboarding", "/reset-password", "/design", "/stories/s_sam", "/auth"]) {
    assert.ok(!isPublicPath(p), p);
  }
});

test("signed-in users are bounced from guest-only pages but can reach reset and confirm", () => {
  assert.ok(isGuestOnlyPath("/login"));
  assert.ok(isGuestOnlyPath("/register"));
  assert.ok(!isGuestOnlyPath("/reset-password"));
  assert.ok(!isGuestOnlyPath("/auth/confirm"));
});
