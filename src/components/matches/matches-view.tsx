"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, HeartHandshake, MessageCircle, Send, X } from "lucide-react";
import { conversationIdFor, useDemo } from "@/lib/demo/store";
import { useSimulatedLoad } from "@/lib/demo/use-simulated-load";
import { ButtonLink, buttonStyles } from "@/components/ui/button";
import { PageHeader, Segmented, VerifiedBadge } from "@/components/ui/primitives";
import { Photo } from "@/components/ui/photo";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { User } from "@/lib/types";

type Tab = "matches" | "likes" | "liked";

export function MatchesView() {
  const { state, dispatch, getUser } = useDemo();
  const toast = useToast();
  const ready = useSimulatedLoad("matches");
  const [tab, setTab] = useState<Tab>("matches");

  const resolve = (ids: string[]) => ids.map(getUser).filter((u): u is User => !!u && !state.blocked[u.id]);
  const matches = resolve(state.matches);
  const likesYou = resolve(state.likesYou);
  const youLiked = resolve(state.youLiked);
  const list = tab === "matches" ? matches : tab === "likes" ? likesYou : youLiked;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:py-8 lg:px-8">
      <PageHeader title="Matches" subtitle="Mutual likes unlock messaging without limits." />
      <Segmented
        label="Match lists"
        value={tab}
        onChange={setTab}
        className="mb-6 max-w-md"
        options={[
          { value: "matches", label: "Matches", count: matches.length },
          { value: "likes", label: "Likes you", count: likesYou.length },
          { value: "liked", label: "You liked", count: youLiked.length },
        ]}
      />

      {!ready ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === "matches" ? HeartHandshake : tab === "likes" ? Heart : Send}
          title={tab === "matches" ? "No matches yet" : tab === "likes" ? "No new likes right now" : "You haven't liked anyone yet"}
          description={
            tab === "likes"
              ? "When someone likes your profile, they'll show up here. A complete profile gets noticed more."
              : "Like profiles in Discover. When it's mutual, you'll match."
          }
          action={<ButtonLink href="/discover">Go to Discover</ButtonLink>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((u) => (
            <div key={u.id} className="overflow-hidden rounded-2xl border border-line bg-surface animate-fade-in">
              <Link href={`/profile/${u.username}`} className="block">
                <Photo seed={u.photo} alt={u.name} width={600} height={800} sizes="(max-width: 640px) 50vw, 260px" className="aspect-[4/5]">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent to-50%" />
                  <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                    <p className="flex items-center gap-1 font-medium">
                      {u.name.split(" ")[0]}, {u.age}
                      {u.verified && <VerifiedBadge className="size-3.5" />}
                    </p>
                    <p className="text-xs text-white/70">{u.online ? "Online now" : `Active ${u.lastActive}`}</p>
                  </div>
                </Photo>
              </Link>
              <div className="flex gap-2 p-2.5">
                {tab === "matches" && (
                  <Link href={`/messages/${conversationIdFor(u.id)}`} className={buttonStyles({ variant: "secondary", size: "sm", className: "flex-1" })}>
                    <MessageCircle /> Say hi
                  </Link>
                )}
                {tab === "likes" && (
                  <>
                    <button
                      aria-label={`Pass on ${u.name}`}
                      onClick={() => dispatch({ type: "passProfile", userId: u.id })}
                      className={buttonStyles({ variant: "secondary", size: "icon-sm" })}
                    >
                      <X />
                    </button>
                    <button
                      onClick={() => {
                        dispatch({ type: "likeProfile", userId: u.id });
                        toast(`It's a match with ${u.name.split(" ")[0]}!`);
                      }}
                      className={buttonStyles({ size: "sm", className: "flex-1" })}
                    >
                      <Heart /> Like back
                    </button>
                  </>
                )}
                {tab === "liked" && <p className="w-full py-1.5 text-center text-xs text-subtle">Waiting on {u.name.split(" ")[0]}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
