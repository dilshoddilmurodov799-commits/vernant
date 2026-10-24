"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, BellOff, Flag, ImagePlus, MessageCircleOff, SendHorizontal, X, ShieldCheck, ShieldOff, User as UserIcon } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Photo } from "@/components/ui/photo";
import { VerifiedBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { SafetyDialogs, type SafetyAction } from "@/components/safety/safety-dialogs";

export function ConversationView({ conversationId }: { conversationId: string }) {
  const { state, dispatch, getUser } = useDemo();
  const toast = useToast();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [safety, setSafety] = useState<SafetyAction>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const conversation = state.conversations.find((c) => c.id === conversationId);
  // Conversations that don't exist yet resolve to the member they'd be with (see conversationIdFor).
  const user = getUser(conversation?.userId ?? `u_${conversationId.replace(/^c_/, "")}`);
  const messages = conversation?.messages ?? [];
  const unread = conversation?.unread ?? 0;

  useEffect(() => {
    if (unread) dispatch({ type: "readConversation", conversationId });
  }, [unread, conversationId, dispatch]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (!user || user.id === state.me.id) {
    return (
      <div className="grid flex-1 place-items-center">
        <EmptyState
          icon={MessageCircleOff}
          title="Conversation not found"
          description="It may have been deleted, or this member is no longer available."
          action={<ButtonLink href="/messages">Back to messages</ButtonLink>}
        />
      </div>
    );
  }

  const first = user.name.split(" ")[0];
  const blocked = !!state.blocked[user.id];

  const send = (e?: { preventDefault: () => void }) => {
    e?.preventDefault();
    const text = draft.trim();
    if ((!text && !attachment) || blocked) return;
    dispatch({ type: "sendMessage", userId: user.id, text: text || undefined, image: attachment ?? undefined });
    setDraft("");
    setAttachment(null);
    setPickerOpen(false);
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-3 backdrop-blur-xl md:px-5">
        <Link href="/messages" aria-label="Back to messages" className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-2 md:hidden">
          <ArrowLeft className="size-5" />
        </Link>
        <Link href={`/profile/${user.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={user.name} seed={user.photo} size="sm" online={user.online} />
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-sm font-medium">
              <span className="truncate">{user.name}</span>
              {user.verified && <VerifiedBadge className="size-3.5" />}
            </span>
            <span className="block text-xs text-subtle">{user.online ? "Online" : `Active ${user.lastActive}`}</span>
          </span>
        </Link>
        <Menu
          items={[
            { label: "View profile", icon: UserIcon, onSelect: () => router.push(`/profile/${user.username}`) },
            ...(conversation
              ? [
                  {
                    label: conversation.muted ? "Unmute" : "Mute",
                    icon: conversation.muted ? Bell : BellOff,
                    onSelect: () => {
                      dispatch({ type: "toggleMute", conversationId });
                      toast(conversation.muted ? "Notifications on" : "Conversation muted");
                    },
                  },
                ]
              : []),
            { label: "Report", icon: Flag, onSelect: () => setSafety("report"), danger: true },
            { label: `Block ${first}`, icon: ShieldOff, onSelect: () => setSafety("block"), danger: true },
          ]}
        />
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-5 md:px-6">
        <div className="mx-auto max-w-2xl space-y-1.5">
          <div className="mx-auto mb-6 flex max-w-sm items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-xs leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
            <p>Meet in public for first dates and tell a friend your plans. Never send money. Report anything that feels off — it&apos;s confidential.</p>
          </div>

          {messages.length === 0 && (
            <div className="py-10 text-center">
              <Avatar name={user.name} seed={user.photo} size="lg" />
              <p className="mt-3 font-medium">Start a conversation with {first}</p>
              <p className="mt-1 text-sm text-subtle">Mention something from their profile — it goes a long way.</p>
            </div>
          )}

          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const newDay = !prev || prev.day !== m.day;
            const mine = m.from === "me";
            const groupedWithNext = next && next.from === m.from && next.day === m.day;
            return (
              <Fragment key={m.id}>
                {newDay && <p className="py-3 text-center text-[11px] font-medium tracking-wide text-subtle uppercase">{m.day}</p>}
                <div className={cn("flex animate-fade-in", mine ? "justify-end" : "justify-start", !groupedWithNext && "mb-3")}>
                  <div className={cn("max-w-[78%] md:max-w-[65%]")}>
                    {m.image && <BlurredMedia seed={m.image} blur={!mine && state.settings.blurIncomingMedia} />}
                    {m.text && (
                      <p
                        className={cn(
                          "rounded-2xl px-3.5 py-2 text-[15px] leading-snug break-words whitespace-pre-wrap",
                          mine ? "rounded-br-md bg-accent text-accent-fg" : "rounded-bl-md bg-surface-3 text-fg",
                          m.image && "mt-1",
                        )}
                      >
                        {m.text}
                      </p>
                    )}
                    {!groupedWithNext && <p className={cn("mt-1 text-[11px] text-subtle", mine && "text-right")}>{m.time}</p>}
                  </div>
                </div>
              </Fragment>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      {blocked ? (
        <p className="border-t border-line p-4 text-center text-sm text-muted">You blocked {first}. Unblock them from Settings to message again.</p>
      ) : (
        <form onSubmit={send} className="shrink-0 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-5">
          {pickerOpen && (
            <div id="attachment-picker" className="mx-auto mb-3 max-w-2xl rounded-2xl border border-line bg-surface p-3 animate-rise">
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-sm font-medium">Attach a photo</p>
                <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close photo picker" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg">
                  <X className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label="Your photos">
                {state.me.gallery.map((seed, i) => (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => {
                      setAttachment(seed);
                      setPickerOpen(false);
                    }}
                    aria-label={`Attach photo ${i + 1}`}
                    className="overflow-hidden rounded-xl border border-line transition-opacity hover:opacity-85"
                  >
                    <Photo seed={seed} alt="" width={160} height={160} sizes="96px" className="aspect-square" />
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] text-subtle">
                Demo: pick from your profile photos. Real uploads will be type- and size-checked, stripped of location data, and scanned before sending.
              </p>
            </div>
          )}
          {attachment && (
            <div className="mx-auto mb-2 flex max-w-2xl">
              <div className="relative">
                <Photo seed={attachment} alt="Photo to send" width={160} height={160} sizes="80px" className="size-20 rounded-xl border border-line" />
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attached photo"
                  className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full border border-line-strong bg-surface-3 text-fg hover:bg-surface-4"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          )}
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <button
              type="button"
              aria-label="Attach photo"
              aria-expanded={pickerOpen}
              aria-controls="attachment-picker"
              onClick={() => setPickerOpen((o) => !o)}
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg",
                (pickerOpen || attachment) && "bg-surface-2 text-fg",
              )}
            >
              <ImagePlus className="size-5" />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
              }}
              rows={1}
              placeholder={`Message ${first}…`}
              aria-label={`Message ${first}`}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] outline-none [field-sizing:content] placeholder:text-subtle focus:border-accent/60"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!draft.trim() && !attachment}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-fg transition-opacity hover:bg-accent-hover disabled:opacity-30"
            >
              <SendHorizontal className="size-5" />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[11px] text-subtle">Demo conversation · messages are not delivered</p>
        </form>
      )}

      <SafetyDialogs user={user} action={safety} onClose={() => setSafety(null)} />
    </div>
  );
}

/** Incoming photos are blurred until tapped when "blur incoming media" is on. */
function BlurredMedia({ seed, blur }: { seed: string; blur: boolean }) {
  const [revealed, setRevealed] = useState(!blur);
  return (
    <button type="button" onClick={() => setRevealed(true)} className="block w-64 overflow-hidden rounded-2xl" aria-label={revealed ? "Photo" : "Tap to view photo"}>
      <Photo seed={seed} alt="Shared photo" width={600} height={600} sizes="256px" className="aspect-square" imgClassName={cn("transition-[filter] duration-300", !revealed && "blur-2xl scale-110")}>
        {!revealed && <span className="absolute inset-0 grid place-items-center text-xs font-medium text-white">Tap to view</span>}
      </Photo>
    </button>
  );
}
