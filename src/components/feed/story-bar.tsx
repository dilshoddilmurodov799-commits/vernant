"use client";

import Link from "next/link";
import { useDemo } from "@/lib/demo/store";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/states";

export function StoryBar() {
  const { stories, getUser, state } = useDemo();
  // Unseen stories first, like most story UIs.
  const ordered = [...stories].sort((a, b) => Number(!!state.seenStories[a.id]) - Number(!!state.seenStories[b.id]));

  return (
    <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" aria-label="Stories">
      {ordered.map((story) => {
        const user = getUser(story.userId);
        if (!user) return null;
        return (
          <Link key={story.id} href={`/stories/${story.id}`} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 group">
            <Avatar name={user.name} seed={user.photo} size="lg" ring={state.seenStories[story.id] ? "seen" : "new"} className="transition-transform group-hover:scale-[1.03]" />
            <span className="w-full truncate text-center text-xs text-muted">{user.name.split(" ")[0]}</span>
          </Link>
        );
      })}
    </div>
  );
}

export function StoryBarSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden pb-1">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex w-[72px] shrink-0 flex-col items-center gap-2">
          <Skeleton className="size-[74px] rounded-full" />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}
