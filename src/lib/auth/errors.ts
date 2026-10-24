/** User-facing copy for Supabase Auth error codes. Unknown codes get a generic message. */
export function describeAuthError(error: { code?: string | null }): string {
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
      return "We couldn't text that number. Check it and try again.";
    case "over_sms_send_rate_limit":
      return "Too many codes sent. Wait a minute before requesting another.";
    case "otp_expired":
      return "That code is wrong or has expired. Request a new one.";
    case "phone_provider_disabled":
      return "Phone verification isn't available right now.";
    default:
      return "Something went wrong. Please try again.";
  }
}
