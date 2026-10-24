import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPhone, splitInternational } from "./countries";
import { describeAuthError } from "./errors";
import {
  confirmParamsSchema,
  fieldErrors,
  normalizePhone,
  phoneCodeSchema,
  phoneOnlySchema,
  resetPasswordSchema,
  signInSchema,
  toInternational,
  emailCodeStartSchema,
  emailCodeVerifySchema,
  phoneCodeStartSchema,
  phoneCodeVerifySchema,
} from "./schemas";

const validStart = { phoneCountry: "US", phone: "(312) 555-0142", consent: "on" };

test("email code step 1 trims and lowercases the address", () => {
  const r = emailCodeStartSchema.safeParse({ email: "  Sam.Bear@Example.COM " });
  assert.ok(r.success);
  assert.equal(r.data.email, "sam.bear@example.com");
  for (const bad of ["", "sam", "sam@", "@example.com", `${"a".repeat(250)}@x.co`]) {
    const bad1 = emailCodeStartSchema.safeParse({ email: bad });
    assert.ok(!bad1.success, bad);
    assert.ok(fieldErrors(bad1.error).email, bad);
  }
  assert.ok(!emailCodeStartSchema.safeParse({}).success);
});

test("email code step 2 needs the address and a numeric code", () => {
  const ok = emailCodeVerifySchema.safeParse({ email: "Sam@Example.com", code: " 123 456 ", next: "/discover" });
  assert.ok(ok.success);
  assert.deepEqual(ok.data, { email: "sam@example.com", code: "123456", next: "/discover" });
  for (const [email, code] of [
    ["sam@example.com", ""],
    ["sam@example.com", "12a456"],
    ["sam@example.com", "123"],
    ["", "123456"],
    ["not-an-email", "123456"],
  ]) {
    assert.ok(!emailCodeVerifySchema.safeParse({ email, code }).success, `${email} / ${code}`);
  }
});

test("phone code step 1 joins the country code and requires consent", () => {
  const r = phoneCodeStartSchema.safeParse(validStart);
  assert.ok(r.success);
  assert.equal(r.data.phone, "+13125550142");

  const cases: Array<[Partial<typeof validStart>, string]> = [
    [{ consent: "" }, "consent"],
    [{ consent: "yes" }, "consent"],
    [{ phone: "" }, "phone"],
    [{ phone: "555" }, "phone"],
    [{ phoneCountry: "ZZ" }, "phone"],
    [{ phoneCountry: "" }, "phone"],
  ];
  for (const [patch, field] of cases) {
    const bad = phoneCodeStartSchema.safeParse({ ...validStart, ...patch });
    assert.ok(!bad.success, JSON.stringify(patch));
    assert.ok(fieldErrors(bad.error)[field], `${field} for ${JSON.stringify(patch)}`);
  }
});

test("phone code step 2 needs the E.164 number from step 1 and a numeric code", () => {
  const ok = phoneCodeVerifySchema.safeParse({ phone: "+447946095800", code: "123 456", next: "/discover" });
  assert.ok(ok.success);
  assert.equal(ok.data.code, "123456");
  for (const [phone, code] of [
    ["07946095800", "123456"],
    ["+44 7946 095800", "123456"],
    ["", "123456"],
    ["+447946095800", ""],
    ["+447946095800", "12a456"],
    ["+447946095800", "123"],
  ]) {
    assert.ok(!phoneCodeVerifySchema.safeParse({ phone, code }).success, `${phone} / ${code}`);
  }
});

test("code failures get channel-specific wording", () => {
  assert.match(describeAuthError({ code: "otp_expired" }, "email"), /wrong or has expired/);
  assert.match(describeAuthError({ code: "over_email_send_rate_limit" }, "email"), /Too many attempts/);
  assert.match(describeAuthError({ code: "email_address_not_authorized" }, "email"), /can't email that address/);
  assert.match(describeAuthError({ code: "email_provider_disabled" }, "email"), /Email codes aren't available/);
  assert.match(describeAuthError({ code: "unexpected_failure", status: 500 }, "email"), /couldn't send the email/);
  assert.match(describeAuthError({ code: "unexpected_failure", status: 500 }), /Something went wrong/);
  assert.match(describeAuthError({ code: "sms_send_failed" }, "whatsapp"), /couldn't send a WhatsApp message/);
  assert.match(describeAuthError({ code: "sms_send_failed" }), /couldn't text/);
  assert.match(describeAuthError({ code: "phone_provider_disabled" }, "whatsapp"), /WhatsApp codes aren't available/);
  assert.match(describeAuthError({ code: "over_sms_send_rate_limit" }, "whatsapp"), /Wait a minute/);
  assert.match(describeAuthError({ code: "otp_expired" }, "whatsapp"), /wrong or has expired/);
  assert.match(describeAuthError({ code: "something_new" }, "whatsapp"), /Something went wrong/);
});

test("masked numbers keep the country code and last two digits only", () => {
  assert.equal(maskPhone("+447946095800"), "+44 ••••••••00");
  assert.equal(maskPhone("+13125550142"), "+1 ••••••••42");
  assert.equal(maskPhone("+998901234567"), "+998 •••••••67");
  assert.ok(!maskPhone("+13125550142").includes("555"));
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

test("one-time codes are 4-10 digits (Supabase 6-10, Twilio Verify 4-10)", () => {
  const ok = phoneCodeSchema.safeParse({ code: " 123 456 " });
  assert.ok(ok.success);
  assert.equal(ok.data.code, "123456");
  assert.ok(phoneCodeSchema.safeParse({ code: "1234" }).success);
  for (const bad of ["", "123", "12345a", "12345678901"]) assert.ok(!phoneCodeSchema.safeParse({ code: bad }).success, bad);
});
