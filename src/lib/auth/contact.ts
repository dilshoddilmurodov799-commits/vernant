import { maskPhone } from "./countries";
import type { OtpMethod } from "./form-state";

/** "sam.bear@example.com" → "s•••r@example.com": recognisable to its owner, not readable over a shoulder. */
export function maskEmail(value: string) {
  const at = value.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = value.slice(0, at);
  const hidden = local.length <= 2 ? `${local[0]}•` : `${local[0]}•••${local.at(-1)}`;
  return `${hidden}${value.slice(at)}`;
}

/** Where a code went, masked for display. */
export function maskContact(method: OtpMethod, contact: string) {
  return method === "email" ? maskEmail(contact) : maskPhone(contact);
}
