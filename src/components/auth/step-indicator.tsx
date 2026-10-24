import { SIGNUP_STEPS } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

/** "Profile · Step 4 of 5" over a segmented progress bar. `step` is 1-based; `label` overrides the step's name. */
export function StepIndicator({ step, label, className }: { step: number; label?: string; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      <p className="text-xs text-subtle">
        <span className="font-medium tracking-[0.14em] text-accent uppercase">{label ?? SIGNUP_STEPS[step - 1]}</span>
        <span aria-hidden> · </span>
        <span className="tabular-nums">
          Step {step} of {SIGNUP_STEPS.length}
        </span>
      </p>
      <div aria-hidden className="flex gap-1.5">
        {SIGNUP_STEPS.map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full transition-colors", i < step ? "bg-accent" : "bg-surface-3")} />
        ))}
      </div>
    </div>
  );
}
