import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmParamsSchema, fieldErrors, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas";

function yearsAgo(years: number, dayOffset = 0) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + dayOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const validSignUp = {
  displayName: "Sam",
  email: "  sam@example.com ",
  password: "correct horse battery",
  birthDate: yearsAgo(30),
  terms: "on",
};

test("sign-up accepts valid input and trims email", () => {
  const r = signUpSchema.safeParse(validSignUp);
  assert.ok(r.success);
  assert.equal(r.data.email, "sam@example.com");
});

test("sign-up enforces 18+ on the exact birthday boundary", () => {
  assert.ok(signUpSchema.safeParse({ ...validSignUp, birthDate: yearsAgo(18) }).success, "18 today");
  const r = signUpSchema.safeParse({ ...validSignUp, birthDate: yearsAgo(18, 1) });
  assert.ok(!r.success, "18 tomorrow");
  assert.match(fieldErrors(r.error).birthDate, /18 or older/);
});

test("sign-up rejects bad birth dates, missing terms, weak passwords and unsafe names", () => {
  const cases: Array<[Partial<typeof validSignUp>, string]> = [
    [{ birthDate: "not-a-date" }, "birthDate"],
    [{ birthDate: "2001-02-30" }, "birthDate"],
    [{ birthDate: yearsAgo(130) }, "birthDate"],
    [{ terms: "" }, "terms"],
    [{ password: "short" }, "password"],
    [{ password: " ".repeat(12) }, "password"],
    [{ password: "x".repeat(73) }, "password"],
    [{ displayName: "   " }, "displayName"],
    [{ displayName: "<script>" }, "displayName"],
    [{ email: "nope" }, "email"],
  ];
  for (const [patch, field] of cases) {
    const r = signUpSchema.safeParse({ ...validSignUp, ...patch });
    assert.ok(!r.success, JSON.stringify(patch));
    assert.ok(fieldErrors(r.error)[field], `${field} for ${JSON.stringify(patch)}`);
  }
});

test("sign-in requires email and password", () => {
  assert.ok(signInSchema.safeParse({ email: "a@b.co", password: "x" }).success);
  assert.ok(!signInSchema.safeParse({ email: "a@b.co", password: "" }).success);
});

test("reset password requires matching confirmation", () => {
  assert.ok(resetPasswordSchema.safeParse({ password: "a long password", confirmPassword: "a long password" }).success);
  const r = resetPasswordSchema.safeParse({ password: "a long password", confirmPassword: "different one" });
  assert.ok(!r.success);
  assert.ok(fieldErrors(r.error).confirmPassword);
});

test("confirm params accept token-hash or code, and reject unknown types", () => {
  assert.ok(confirmParamsSchema.safeParse({ token_hash: "abc", type: "recovery" }).success);
  assert.ok(confirmParamsSchema.safeParse({ code: "abc" }).success);
  assert.ok(!confirmParamsSchema.safeParse({ token_hash: "abc", type: "admin" }).success);
  assert.ok(!confirmParamsSchema.safeParse({}).success);
});
