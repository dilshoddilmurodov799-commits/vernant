import { test } from "node:test";
import assert from "node:assert/strict";
import { splitInternational } from "./countries";
import {
  confirmParamsSchema,
  fieldErrors,
  normalizePhone,
  phoneCodeSchema,
  phoneOnlySchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toInternational,
} from "./schemas";

const validSignUp = {
  username: " Sam.Bear_1 ",
  email: "  sam@example.com ",
  phoneCountry: "US",
  phone: "(312) 555-0142",
  password: "correct horse battery",
  terms: "on",
};

test("sign-up accepts valid input, trims email, lowercases username and joins the phone", () => {
  const r = signUpSchema.safeParse(validSignUp);
  assert.ok(r.success);
  assert.equal(r.data.email, "sam@example.com");
  assert.equal(r.data.username, "sam.bear_1");
  assert.equal(r.data.phone, "+13125550142");
});

test("sign-up rejects missing terms, bad usernames and phones, and weak passwords", () => {
  const cases: Array<[Partial<typeof validSignUp>, string]> = [
    [{ terms: "" }, "terms"],
    [{ username: "" }, "username"],
    [{ username: "ab" }, "username"],
    [{ username: "a".repeat(31) }, "username"],
    [{ username: "sam bear" }, "username"],
    [{ username: "sam@bear" }, "username"],
    [{ password: "short" }, "password"],
    [{ password: " ".repeat(12) }, "password"],
    [{ password: "x".repeat(73) }, "password"],
    [{ email: "nope" }, "email"],
    [{ phone: "" }, "phone"],
    [{ phone: "555" }, "phone"],
    [{ phoneCountry: "ZZ" }, "phone"],
    [{ phoneCountry: "" }, "phone"],
  ];
  for (const [patch, field] of cases) {
    const r = signUpSchema.safeParse({ ...validSignUp, ...patch });
    assert.ok(!r.success, JSON.stringify(patch));
    assert.ok(fieldErrors(r.error)[field], `${field} for ${JSON.stringify(patch)}`);
  }
});

test("sign-in accepts an email or a username", () => {
  const byEmail = signInSchema.safeParse({ identifier: " Sam@Example.com ", password: "x" });
  assert.ok(byEmail.success);
  assert.equal(byEmail.data.identifier, "sam@example.com");
  for (const [input, out] of [["Sam.Bear_1", "sam.bear_1"], ["@sam.bear", "sam.bear"]]) {
    const r = signInSchema.safeParse({ identifier: input, password: "x" });
    assert.ok(r.success, input);
    assert.equal(r.data.identifier, out);
  }
  for (const bad of ["", "ab", "sam bear", "a@", "not an email@"]) {
    const r = signInSchema.safeParse({ identifier: bad, password: "x" });
    assert.ok(!r.success, bad);
    assert.ok(fieldErrors(r.error).identifier, bad);
  }
  assert.ok(!signInSchema.safeParse({ identifier: "a@b.co", password: "" }).success);
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

test("phone numbers must be E.164 with a country code", () => {
  assert.equal(normalizePhone("+44 20 7946.0958"), "+442079460958");
  for (const ok of ["+13125550142", "+44 20 7946 0958", "+998 90 123 45 67"]) assert.ok(phoneOnlySchema.safeParse({ phone: ok }).success, ok);
  for (const bad of ["13125550142", "+0123456789", "+1 555", "+1234567890123456", "+1 312 555 O142", "tel:+13125550142"]) {
    assert.ok(!phoneOnlySchema.safeParse({ phone: bad }).success, bad);
  }
});

test("the picked country code is joined to the number, dropping trunk prefixes", () => {
  const cases: Array<[string, string, string]> = [
    ["US", "312 555 0142", "+13125550142"],
    ["US", "1 312 555 0142", "+13125550142"],
    ["GB", "07946 095 800", "+447946095800"],
    ["UZ", "90 123 45 67", "+998901234567"],
    ["RU", "8 912 345 67 89", "+79123456789"],
    ["HU", "06 20 123 4567", "+36201234567"],
    ["IT", "06 1234 5678", "+390612345678"],
    ["CI", "07 07 12 34 56", "+2250707123456"],
    ["US", "+44 7946 095800", "+447946095800"],
    ["US", "0044 7946 095800", "+447946095800"],
    ["ZZ", "312 555 0142", "3125550142"],
    ["US", "  ", ""],
  ];
  for (const [country, number, out] of cases) assert.equal(toInternational(country, number), out, `${country} ${number}`);

  const r = phoneOnlySchema.safeParse({ phoneCountry: "UZ", phone: "90 123 45 67" });
  assert.ok(r.success);
  assert.equal(r.data.phone, "+998901234567");
});

test("international numbers split back into country and number", () => {
  assert.deepEqual(splitInternational("+13125550142"), { country: "US", number: "3125550142" });
  assert.deepEqual(splitInternational("+79123456789"), { country: "RU", number: "9123456789" });
  assert.deepEqual(splitInternational("+998901234567"), { country: "UZ", number: "901234567" });
  assert.deepEqual(splitInternational("+447946095800"), { country: "GB", number: "7946095800" });
  assert.equal(splitInternational(""), null);
});

test("SMS codes are 6-10 digits", () => {
  const ok = phoneCodeSchema.safeParse({ code: " 123 456 " });
  assert.ok(ok.success);
  assert.equal(ok.data.code, "123456");
  for (const bad of ["", "12345", "12345a", "12345678901"]) assert.ok(!phoneCodeSchema.safeParse({ code: bad }).success, bad);
});
