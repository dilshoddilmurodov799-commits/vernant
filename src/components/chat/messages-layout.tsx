"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BellOff, MessagesSquare, Pin, Search, SearchX } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { useSimulatedLoad } from "@/lib/demo/use-simulated-load";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { CountBadge } from "@/components/ui/primitives";
import { EmptyState, Skeleton } from "@/components/ui/states";

/** Two-pane on desktop; on mobile shows either the list or the open conversation. */
export function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const inConversation = pathname !== "/messages";

  return (
    <div className={cn("flex md:h-dvh", inConversation ? "h-dvh" : "h-[calc(100dvh-8.5rem)]")}>
      <aside className={cn("w-full flex-col border-line md:flex md:w-80 md:border-r lg:w-96", inConversation ? "hidden" : "flex")}>
        <ConversationList activePath={pathname} />
      </aside>
      <section className={cn("min-w-0 flex-1 flex-col", inConversation ? "flex" : "hidden md:flex")}>{children}</section>
    </div>
  );
}

function ConversationList({ activePath }: { activePath: string }) {
  const { state, getUser } = useDemo();
  const ready = useSimulatedLoad("inbox");
  const [query, setQuery] = useState("");

  const conversations = state.conversations
    .filter((c) => !state.blocked[c.userId])
    .map((c) => ({ c, user: getUser(c.userId)!, last: c.messages[c.messages.length - 1] }))
    .filter(({ user }) => !query.trim() || user.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(!!b.c.pinned) - Number(!!a.c.pinned));

  return (
    <>
      <div className="space-y-4 px-4 pt-5 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pr-3 pl-10 text-sm outline-none placeholder:text-subtle focus:border-accent/60"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!ready ? (
          Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))
        ) : conversations.length === 0 ? (
          query ? (
            <EmptyState icon={SearchX} title="No conversations found" description={`Nothing matches “${query}”.`} />
          ) : (
            <EmptyState
              icon={MessagesSquare}
              title="No messages yet"
              description="Match with someone or reply to a story to start a conversation."
              action={<ButtonLink href="/matches">See matches</ButtonLink>}
            />
          )
        ) : (
          <ul>
            {conversations.map(({ c, user, last }) => {
              const href = `/messages/${c.id}`;
              const preview = last ? (last.image ? "Sent a photo" : last.text) : "Say hello";
              return (
                <li key={c.id}>
                  <Link
                    href={href}
                    aria-current={activePath === href ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition-colors",
                      activePath === href ? "bg-surface-2" : "hover:bg-surface",
                    )}
                  >
                    <Avatar name={user.name} seed={user.photo} size="md" online={user.online} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>{user.name}</span>
                        {c.pinned && <Pin className="size-3 shrink-0 text-subtle" aria-label="Pinned" />}
                        {c.muted && <BellOff className="size-3 shrink-0 text-subtle" aria-label="Muted" />}
                        <span className="ml-auto shrink-0 text-[11px] text-subtle">{last?.day === "Today" ? last.time : last?.day}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={cn("truncate text-[13px]", c.unread ? "text-fg" : "text-subtle")}>
                          {last?.from === "me" && "You: "}
                          {preview}
                        </p>
                        <CountBadge count={c.muted ? 0 : c.unread} className="ml-auto" />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
