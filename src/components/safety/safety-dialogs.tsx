"use client";

import { useState } from "react";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import type { ReportReason, User } from "@/lib/types";

const REASONS: ReportReason[] = [
  "Fake or impersonation",
  "Appears under 18",
  "Harassment or hate",
  "Spam or scam",
  "Unsolicited explicit content",
  "Something else",
];

export type SafetyAction = "report" | "block" | null;

/** Report + block flows for a member. Rendered once per surface and toggled by `action`. */
export function SafetyDialogs({ user, action, onClose }: { user: User; action: SafetyAction; onClose: () => void }) {
  const { dispatch } = useDemo();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  const close = () => {
    setReason(null);
    setDetails("");
    onClose();
  };

  return (
    <>
      <Dialog
        open={action === "report"}
        onClose={close}
        title={`Report ${user.name.split(" ")[0]}`}
        description="Reports are confidential. Our moderation team reviews every one."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return;
            dispatch({ type: "report", report: { targetId: user.id, reason, details: details.trim() } });
            toast("Report recorded (demo — not sent to moderation)");
            close();
          }}
          className="space-y-4"
        >
          <fieldset className="space-y-2">
            <legend className="sr-only">Reason</legend>
            {REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors",
                  reason === r ? "border-accent/50 bg-accent-soft" : "border-line hover:border-line-strong",
                )}
              >
                <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--color-accent)]" />
                {r}
              </label>
            ))}
          </fieldset>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} placeholder="Anything else we should know? (optional)" aria-label="Details" rows={3} />
          {reason === "Appears under 18" && (
            <p className="rounded-xl bg-danger-soft px-3.5 py-3 text-xs text-danger">
              Suspected minors are prioritised and the account is hidden pending review.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" disabled={!reason}>
              Submit report
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={action === "block"}
        onClose={close}
        title={`Block ${user.name.split(" ")[0]}?`}
        description="They won't be able to find your profile, see your posts, or message you. They won't be notified."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              dispatch({ type: "block", userId: user.id });
              toast(`${user.name.split(" ")[0]} is blocked`);
              close();
            }}
          >
            Block
          </Button>
        </div>
      </Dialog>
    </>
  );
}
