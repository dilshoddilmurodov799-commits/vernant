/**
 * User-facing copy for Supabase Auth error codes. Unknown codes get a generic message.
 * `channel` picks the wording for one-time codes sent by email, SMS or WhatsApp.
 */
export function describeAuthError(error: { code?: string | null; status?: number }, channel: "email" | "sms" | "whatsapp" = "sms"): string {
  const whatsApp = channel === "whatsapp";
  const byEmail = channel === "email";
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email, username, or password.";
    case "weak_password":
      return "Choose a stronger password — longer, and not a common one.";
    case "same_password":
      return "Choose a password you haven't used for this account.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    case "signup_disabled":
      return "New sign-ups are paused right now.";
    case "email_address_invalid":
      return "That email address can't receive mail. Try another.";
    case "phone_exists":
      return "That number is already linked to another account.";
    case "sms_send_failed":
      return whatsApp
        ? "We couldn't send a WhatsApp message to that number. Check that it uses WhatsApp, then try again."
        : "We couldn't text that number. Check it and try again.";
    case "over_sms_send_rate_limit":
      return "Too many codes sent. Wait a minute before requesting another.";
    case "otp_expired":
      return "That code is wrong or has expired. Request a new one.";
    case "phone_provider_disabled":
    case "email_provider_disabled":
    case "otp_disabled":
      if (byEmail) return "Email codes aren't available right now.";
      return whatsApp ? "WhatsApp codes aren't available right now." : "Phone verification isn't available right now.";
    case "email_address_not_authorized":
      return "We can't email that address right now. Try again later or use another address.";
    case "captcha_failed":
      return "The security check failed. Reload the page and try again.";
    case "user_banned":
      return "This account has been suspended.";
    case "reauthentication_needed":
      return "For security, log in again before changing your password.";
    default:
      if (byEmail && (error.status ?? 0) >= 500) return "We couldn't send the email. Try again in a moment.";
      return "Something went wrong. Please try again.";
  }
}
