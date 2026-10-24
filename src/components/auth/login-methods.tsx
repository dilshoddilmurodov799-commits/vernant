"use client";

import { useState } from "react";
import type { OtpMethod } from "@/lib/auth/form-state";
import { Segmented } from "@/components/ui/primitives";
import { AuthForm } from "@/components/auth/auth-form";
import { OtpAuth } from "@/components/auth/otp-auth";

type Tab = "password" | "code";

/** Log in with a password (email or username) or a one-time code (email; SMS/WhatsApp when enabled). */
export function LoginMethods({ next = "", codeMethods = ["email"] }: { next?: string; codeMethods?: OtpMethod[] }) {
  const [tab, setTab] = useState<Tab>("password");
  return (
    <div className="space-y-6">
      <Segmented
        label="How to log in"
        value={tab}
        onChange={setTab}
        options={[
          { value: "password", label: "Password" },
          { value: "code", label: codeMethods.length > 1 ? "One-time code" : "Email code" },
        ]}
      />
      {tab === "password" ? <AuthForm next={next} /> : <OtpAuth mode="login" next={next} methods={codeMethods} />}
    </div>
  );
}
