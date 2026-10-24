"use client";

import Link from "next/link";
import { useState } from "react";
import { AtSign, BellOff, CalendarDays, CheckCheck, Heart, HeartHandshake, MessageCircle, ShieldCheck, UserPlus, type LucideIcon } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { useSimulatedLoad } from "@/lib/demo/use-simulated-load";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Photo } from "@/components/ui/photo";
import { PageHeader, Segmented } from "@/components/ui/primitives";
import { EmptyState, Skeleton } from "@/components/ui/states";
import type { AppNotification, NotificationType } from "@/lib/types";

type Filter = "all" | "matches" | "activity" | "mentions";

const FILTERS: Record<Filter, NotificationType[] | null> = {
  all: null,
  matches: ["match", "message"],
  activity: ["like", "comment", "follow", "community", "safety"],
  mentions: ["mention"],
};

const ICONS: Record<NotificationType, LucideIcon> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  match: HeartHandshake,
  message: MessageCircle,
  mention: AtSign,
  safety: ShieldCheck,
  community: CalendarDays,
};

const GROUPS: AppNotification["group"][] = ["Today", "This week", "Earlier"];

export function NotificationsView() {
  const { state, dispatch, getUser, unreadNotifications } = useDemo();
  const ready = useSimulatedLoad("notifications");
  const [filter, setFilter] = useState<Filter>("all");

  const types = FILTERS[filter];
  const items = state.notifications.filter(
    (n) => (!types || types.includes(n.type)) && !(n.actorId && state.blocked[n.actorId]),
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:py-8">
      <PageHeader
        title="Notifications"
        subtitle={unreadNotifications ? `${unreadNotifications} unread` : "You're up to date"}
        actions={
          <Button variant="ghost" size="sm" disabled={!unreadNotifications} onClick={() => dispatch({ type: "readAllNotifications" })}>
            <CheckCheck /> Mark all read
          </Button>
        }
      />
      <Segmented
        label="Filter notifications"
        value={filter}
        onChange={setFilter}
        className="mb-6"
        options={[
          { value: "all", label: "All" },
          { value: "matches", label: "Matches" },
          { value: "activity", label: "Activity" },
          { value: "mentions", label: "Mentions" },
        ]}
      />

      {!ready ? (
        <div className="space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={BellOff} title="Nothing here yet" description="When someone interacts with you, it'll show up here." />
      ) : (
        <div className="space-y-6">
          {GROUPS.map((group) => {
            const groupItems = items.filter((n) => n.group === group);
            if (!groupItems.length) return null;
            return (
              <section key={group}>
                <h2 className="mb-2 px-2 text-xs font-medium tracking-[0.12em] text-subtle uppercase">{group}</h2>
                <ul className="space-y-0.5">
                  {groupItems.map((n) => {
                    const actor = n.actorId ? getUser(n.actorId) : undefined;
                    const Icon = ICONS[n.type];
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          onClick={() => dispatch({ type: "readNotification", id: n.id })}
                          className={cn("flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface", !n.read && "bg-surface/60")}
                        >
                          <span className="relative">
                            {actor ? (
                              <Avatar name={actor.name} seed={actor.photo} size="md" />
                            ) : (
                              <span className="grid size-11 place-items-center rounded-full border border-line bg-surface-2 text-accent">
                                <Icon className="size-5" />
                              </span>
                            )}
                            {actor && (
                              <span className="absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full bg-surface-3 ring-2 ring-bg">
                                <Icon className={cn("size-3", n.type === "like" || n.type === "match" ? "fill-accent text-accent" : "text-fg")} />
                              </span>
                            )}
                          </span>
                          <p className="min-w-0 flex-1 text-sm leading-snug">
                            {actor && n.type !== "match" && <span className="font-medium">{actor.name} </span>}
                            <span className={n.read ? "text-muted" : "text-fg"}>{n.text}</span>
                            <span className="ml-1.5 text-xs text-subtle">{n.time}</span>
                          </p>
                          {n.image && <Photo seed={n.image} alt="" width={100} height={100} sizes="44px" className="size-11 shrink-0 rounded-lg" />}
                          {!n.read && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
