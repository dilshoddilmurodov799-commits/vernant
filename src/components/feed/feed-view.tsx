"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Newspaper } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { useSimulatedLoad } from "@/lib/demo/use-simulated-load";
import { COMMUNITY_HIGHLIGHTS } from "@/lib/demo/data";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, VerifiedBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { useMemberAction } from "@/components/auth/member-gate";
import { StoryBar, StoryBarSkeleton } from "./story-bar";
import { PostCard, PostCardSkeleton } from "./post-card";

export function FeedView() {
  const { state, dispatch, visibleUsers } = useDemo();
  const member = useMemberAction();
  const ready = useSimulatedLoad("feed");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const posts = state.posts.filter(
    (p) => !hidden[p.id] && !state.blocked[p.authorId] && (p.authorId !== state.me.id || p.time === "now"),
  );
  const suggestions = visibleUsers.filter((u) => !state.following[u.id]).slice(0, 4);

  return (
    <div className="mx-auto flex max-w-5xl gap-10 px-4 py-5 md:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-[560px] min-w-0 space-y-6">
        {ready ? <StoryBar /> : <StoryBarSkeleton />}
        <div className="space-y-6">
          {!ready ? (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Newspaper}
              title="Your feed is quiet"
              description="Follow members and join community events to fill your feed."
              action={<ButtonLink href="/discover">Discover members</ButtonLink>}
            />
          ) : (
            posts.map((post, i) => (
              <PostCard key={post.id} post={post} priority={i === 0} onHide={(id) => setHidden((h) => ({ ...h, [id]: true }))} />
            ))
          )}
          {ready && posts.length > 0 && <p className="py-6 text-center text-sm text-subtle">You&apos;re all caught up.</p>}
        </div>
      </div>

      <aside className="sticky top-8 hidden h-fit w-72 shrink-0 space-y-6 xl:block">
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Suggested for you</h2>
          <div className="space-y-3">
            {suggestions.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <Link href={`/profile/${u.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={u.name} seed={u.photo} size="sm" online={u.online} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 text-sm font-medium">
                      <span className="truncate">{u.name}</span>
                      {u.verified && <VerifiedBadge className="size-3.5" />}
                    </span>
                    <span className="block truncate text-xs text-subtle">{u.identities.join(" · ")}</span>
                  </span>
                </Link>
                <button onClick={() => member(() => dispatch({ type: "toggleFollow", userId: u.id }))} className="text-xs font-medium text-accent hover:text-accent-hover">
                  Follow
                </button>
              </div>
            ))}
          </div>
        </section>
        <Card className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-accent" /> Community this week
          </h2>
          <ul className="space-y-3">
            {COMMUNITY_HIGHLIGHTS.map((e) => (
              <li key={e.title} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <span className="block">{e.title}</span>
                  <span className="text-xs text-subtle">{e.meta}</span>
                </span>
                <span className="text-xs text-muted tabular-nums">{e.going} going</span>
              </li>
            ))}
          </ul>
        </Card>
        <p className="text-[11px] leading-relaxed text-subtle">Demo content · Events are planned for a later milestone.</p>
      </aside>
    </div>
  );
}
