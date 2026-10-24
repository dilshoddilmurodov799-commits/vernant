import { test } from "node:test";
import assert from "node:assert/strict";
import { maskEmail } from "./contact";
import { createOtpLimits, otpMethodsFromEnv, requestCode, verifyCode, type OtpAuthClient } from "./otp";
import { RateLimiter } from "./rate-limit";

type Call = { fn: "signInWithOtp" | "verifyOtp"; args: unknown };

/** Stand-in for supabase.auth: records calls and answers with the given results. */
function fakeAuth({ send = null, verify = { error: null, session: {} } }: { send?: { code?: string; status?: number } | null; verify?: { error: { code?: string } | null; session: unknown } } = {}) {
  const calls: Call[] = [];
  const auth: OtpAuthClient = {
    async signInWithOtp(args) {
      calls.push({ fn: "signInWithOtp", args });
      return { error: send };
    },
    async verifyOtp(args) {
      calls.push({ fn: "verifyOtp", args });
      return { error: verify.error, data: { session: verify.session } };
    },
  };
  return { auth, calls };
}

const EMAIL_ONLY = otpMethodsFromEnv({});
const opts = () => ({ methods: EMAIL_ONLY, ip: "203.0.113.7", limits: createOtpLimits(), now: 1_000_000 });

test("email is the only code channel unless SMS or WhatsApp is explicitly enabled", () => {
  assert.deepEqual(otpMethodsFromEnv({}), ["email"]);
  assert.deepEqual(otpMethodsFromEnv({ AUTH_SMS_ENABLED: "1", AUTH_WHATSAPP_ENABLED: "yes" }), ["email"]);
  assert.deepEqual(otpMethodsFromEnv({ AUTH_SMS_ENABLED: "true" }), ["email", "sms"]);
  assert.deepEqual(otpMethodsFromEnv({ AUTH_SMS_ENABLED: "true", AUTH_WHATSAPP_ENABLED: "true" }), ["email", "sms", "whatsapp"]);
});

test("requesting an email code asks Supabase to send it and create the account if new", async () => {
  const { auth, calls } = fakeAuth();
  const state = await requestCode(auth, { method: "email", email: " Sam@Example.com " }, { ...opts(), emailRedirectTo: "http://localhost/auth/confirm" });
  assert.equal(state.status, "success");
  assert.equal(state.contact, "sam@example.com");
  assert.equal(state.method, "email");
  assert.deepEqual(calls, [
    { fn: "signInWithOtp", args: { email: "sam@example.com", options: { shouldCreateUser: true, emailRedirectTo: "http://localhost/auth/confirm" } } },
  ]);
});

test("invalid input and disabled channels never reach Supabase", async () => {
  const { auth, calls } = fakeAuth();
  const bad = await requestCode(auth, { method: "email", email: "not-an-email" }, opts());
  assert.equal(bad.status, "error");
  assert.ok(bad.fieldErrors?.email);
  const whatsapp = await requestCode(auth, { method: "whatsapp", phoneCountry: "US", phone: "3125550100", consent: "on" }, opts());
  assert.equal(whatsapp.status, "error");
  assert.match(whatsapp.message ?? "", /isn't available/);
  const unknown = await requestCode(auth, { method: "carrier-pigeon", email: "sam@example.com" }, opts());
  assert.equal(unknown.status, "error");
  assert.equal(calls.length, 0);
});

test("provider failures are reported and never shown as sent", async () => {
  for (const [send, pattern] of [
    [{ code: "over_email_send_rate_limit", status: 429 }, /Too many attempts/],
    [{ code: "email_address_not_authorized", status: 400 }, /can't email that address/],
    [{ code: "unexpected_failure", status: 500 }, /couldn't send the email/],
  ] as const) {
    const { auth } = fakeAuth({ send });
    const state = await requestCode(auth, { method: "email", email: "sam@example.com" }, opts());
    assert.equal(state.status, "error", send.code);
    assert.match(state.message ?? "", pattern);
    assert.equal(state.contact, undefined);
    assert.equal(state.sentAt, undefined);
  }
});

test("code requests are rate limited per address and per IP", async () => {
  const { auth, calls } = fakeAuth();
  const o = opts();
  for (let i = 0; i < 5; i++) assert.equal((await requestCode(auth, { method: "email", email: "sam@example.com" }, o)).status, "success");
  const blocked = await requestCode(auth, { method: "email", email: "SAM@example.com" }, o);
  assert.equal(blocked.status, "error");
  assert.match(blocked.message ?? "", /Too many attempts/);
  assert.equal(calls.length, 5, "the blocked request never reached Supabase");

  const ipOpts = { ...opts(), ip: "198.51.100.1" };
  let lastStatus = "";
  for (let i = 0; i < 21; i++) lastStatus = (await requestCode(auth, { method: "email", email: `user${i}@example.com` }, ipOpts)).status;
  assert.equal(lastStatus, "error", "the 21st request from one IP is refused");
});

test("a correct email code signs in and continues to onboarding with a safe next", async () => {
  const { auth, calls } = fakeAuth();
  const result = await verifyCode(auth, { method: "email", email: "Sam@Example.com", code: "123 456", next: "/profile/marcus.hale" }, opts());
  assert.deepEqual(result, { status: "verified", redirectTo: "/onboarding?next=%2Fprofile%2Fmarcus.hale" });
  assert.deepEqual(calls, [{ fn: "verifyOtp", args: { email: "sam@example.com", token: "123456", type: "email" } }]);

  const unsafe = await verifyCode(fakeAuth().auth, { method: "email", email: "sam@example.com", code: "123456", next: "//evil.test" }, opts());
  assert.deepEqual(unsafe, { status: "verified", redirectTo: "/onboarding" });
});

test("wrong, expired or session-less verifications fail on the code field", async () => {
  for (const verify of [
    { error: { code: "otp_expired" }, session: null },
    { error: { code: "over_request_rate_limit" }, session: null },
    { error: null, session: null },
  ]) {
    const { auth } = fakeAuth({ verify });
    const result = await verifyCode(auth, { method: "email", email: "sam@example.com", code: "000000" }, opts());
    assert.equal(result.status, "error");
    assert.ok("fieldErrors" in result && result.fieldErrors?.code, JSON.stringify(verify));
  }
  const malformed = await verifyCode(fakeAuth().auth, { method: "email", email: "sam@example.com", code: "abc" }, opts());
  assert.equal(malformed.status, "error");
});

test("guessing is capped per address; a success clears the counter", async () => {
  const o = opts();
  const wrong = fakeAuth({ verify: { error: { code: "otp_expired" }, session: null } });
  for (let i = 0; i < 10; i++) await verifyCode(wrong.auth, { method: "email", email: "sam@example.com", code: "000000" }, o);
  const blocked = await verifyCode(wrong.auth, { method: "email", email: "sam@example.com", code: "000000" }, o);
  assert.ok("fieldErrors" in blocked && /Too many attempts/.test(blocked.fieldErrors?.code ?? ""));
  assert.equal(wrong.calls.length, 10, "the 11th guess never reached Supabase");

  const other = opts();
  await verifyCode(wrong.auth, { method: "email", email: "kai@example.com", code: "000000" }, other);
  assert.equal((await verifyCode(fakeAuth().auth, { method: "email", email: "kai@example.com", code: "123456" }, other)).status, "verified");
  assert.equal(other.limits.verifyPerContact.hit("kai@example.com", other.now), 0, "counter was reset after success");
});

test("phone codes use type sms, only when that channel is enabled", async () => {
  const { auth, calls } = fakeAuth();
  const methods = otpMethodsFromEnv({ AUTH_SMS_ENABLED: "true" });
  const sent = await requestCode(auth, { method: "sms", phoneCountry: "GB", phone: "07946 095800", consent: "on" }, { ...opts(), methods });
  assert.equal(sent.contact, "+447946095800");
  const result = await verifyCode(auth, { method: "sms", phone: "+447946095800", code: "123456" }, { ...opts(), methods });
  assert.equal(result.status, "verified");
  assert.deepEqual(calls.map((c) => c.args), [
    { phone: "+447946095800", options: { shouldCreateUser: true, channel: "sms" } },
    { phone: "+447946095800", token: "123456", type: "sms" },
  ]);
});

test("rate limiter windows reset and report seconds to wait", () => {
  const limiter = new RateLimiter(2, 60_000, 3);
  assert.equal(limiter.hit("a", 0), 0);
  assert.equal(limiter.hit("a", 1_000), 0);
  assert.equal(limiter.hit("a", 2_000), 58);
  assert.equal(limiter.hit("a", 60_000), 0, "new window");
  for (const k of ["b", "c", "d", "e"]) limiter.hit(k, 61_000);
  assert.equal(limiter.hit("e", 61_500), 0, "bounded memory keeps working");
});

test("masked emails keep the domain and hide the name", () => {
  assert.equal(maskEmail("sam.bear@example.com"), "s•••r@example.com");
  assert.equal(maskEmail("jo@example.com"), "j•@example.com");
  assert.equal(maskEmail("j@example.com"), "j•@example.com");
  assert.equal(maskEmail("nonsense"), "•••");
});
