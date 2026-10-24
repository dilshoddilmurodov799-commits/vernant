/** One-time code channels. Email is always on; SMS and WhatsApp only when enabled (lib/auth/otp.ts). */
export type OtpMethod = "email" | "sms" | "whatsapp";

/** State returned by the auth form actions. */
export interface AuthFormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so the form keeps non-secret input after an error. Never includes passwords or codes. */
  values?: Record<string, string>;
  /** Set when sign-in failed because the address isn't confirmed yet. */
  unconfirmedEmail?: string;
  /** One-time code requests: the channel, where the code went (email or E.164 number), and when (ms epoch). */
  method?: OtpMethod;
  contact?: string;
  sentAt?: number;
}
