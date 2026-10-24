"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { COUNTRIES, DEFAULT_COUNTRY, findCountry } from "@/lib/auth/countries";
import { Field, Input } from "@/components/ui/field";

/**
 * Country calling code + national number. The native select stays the real control (keyboard,
 * screen readers, mobile pickers) but is drawn transparently over a compact "US +1" label. The
 * server joins both into E.164. A select's defaultValue only applies on mount, so give this a
 * `key` that changes with `defaultCountry`.
 */
export function PhoneField({
  error,
  hint,
  defaultCountry,
  defaultNumber,
}: {
  error?: string;
  hint?: string;
  defaultCountry?: string;
  defaultNumber?: string;
}) {
  const [country, setCountry] = useState(() => findCountry(defaultCountry ?? "") ?? findCountry(DEFAULT_COUNTRY)!);

  return (
    <Field label="Mobile number" error={error} hint={hint}>
      {(p) => (
        <div className="flex gap-2">
          <div className="relative w-28 shrink-0">
            <select
              name="phoneCountry"
              defaultValue={country.code}
              onChange={(e) => setCountry(findCountry(e.target.value) ?? country)}
              aria-label="Country code"
              aria-invalid={p["aria-invalid"]}
              className="peer absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} (+{c.dial})
                </option>
              ))}
            </select>
            <div
              aria-hidden
              className="pointer-events-none flex h-11 items-center justify-between rounded-xl border border-line bg-surface-2 pr-2.5 pl-3.5 text-sm text-fg transition-colors peer-hover:border-line-strong peer-focus:border-accent/60 peer-focus:bg-surface peer-focus:ring-4 peer-focus:ring-accent/15 peer-aria-invalid:border-danger/60"
            >
              <span className="tabular-nums">
                {country.code} +{country.dial}
              </span>
              <ChevronDown className="size-4 text-subtle" />
            </div>
          </div>
          <Input
            {...p}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            maxLength={24}
            defaultValue={defaultNumber}
            required
            className="min-w-0 flex-1"
          />
        </div>
      )}
    </Field>
  );
}
