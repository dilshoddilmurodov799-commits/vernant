"use client";

import Link from "next/link";
import { useState } from "react";
import { Camera, Flag, Grid3X3, Heart, Images, Link2, Lock, MapPin, MessageCircle, Pencil, Ruler, ShieldOff, UserX } from "lucide-react";
import { conversationIdFor, useDemo } from "@/lib/demo/store";
import { cn, formatCount } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import { Photo } from "@/components/ui/photo";
import { Badge, Segmented, VerifiedBadge } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { SafetyDialogs, type SafetyAction } from "@/components/safety/safety-dialogs";

type Tab = "posts" | "photos" | "private";

export function ProfileView({ username }: { username: string }) {
  const { state, dispatch, getUserByUsername } = useDemo();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("posts");
  const [safety, setSafety] = useState<SafetyAction>(null);
  const [requested, setRequested] = useState(false);
  const user = getUserByUsername(username);

  if (!user) {
    return (
      <EmptyState
        icon={UserX}
        title="Profile not found"
        description="This member may have deleted their account, changed their username, or hidden their profile."
        action={<ButtonLink href="/discover">Back to Discover</ButtonLink>}
        className="py-28"
      />
    );
  }

  const isMe = user.id === state.me.id;
  const first = user.name.split(" ")[0];

  if (state.blocked[user.id]) {
    return (
      <EmptyState
        icon={ShieldOff}
        title={`You blocked ${first}`}
        description="You won't see each other's profiles, posts, or messages."
        action={
          <Button variant="secondary" onClick={() => dispatch({ type: "unblock", userId: user.id })}>
            Unblock
          </Button>
        }
        className="py-28"
      />
    );
  }

  const posts = state.posts.filter((p) => p.authorId === user.id);
  const following = !!state.following[user.id];
  const matched = state.matches.includes(user.id);
  const liked = matched || state.youLiked.includes(user.id);
  const followers = user.stats.followers + (following ? 1 : 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10 lg:px-8">
      <section className="flex flex-col gap-6 md:flex-row md:items-start md:gap-12">
        <div className="flex items-center gap-5 md:block">
          <Avatar name={user.name} seed={user.photo} size="xl" online={user.online && (!isMe || state.settings.showOnline)} />
          <dl className="flex flex-1 justify-around text-center md:hidden">
            <Stat label="Posts" value={user.stats.posts} />
            <Stat label="Followers" value={followers} />
            <Stat label="Following" value={user.stats.following} />
          </dl>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {user.name}
              {user.verified && <VerifiedBadge className="size-5" />}
            </h1>
            <span className="text-sm text-muted">
              {user.age} · {user.pronouns}
            </span>
          </div>
          <p className="mt-1 text-sm text-subtle">
            @{user.username} · {user.online ? "Online now" : `Active ${user.lastActive}`}
          </p>

          <dl className="mt-4 hidden gap-8 md:flex">
            <Stat label="posts" value={user.stats.posts} inline />
            <Stat label="followers" value={followers} inline />
            <Stat label="following" value={user.stats.following} inline />
          </dl>

          <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-fg/90">{user.bio}</p>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {user.city}
              {!isMe && ` · ${user.distanceKm} km away`}
            </span>
            {user.height && (
              <span className="flex items-center gap-1.5">
                <Ruler className="size-4" />
                {user.height}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {user.identities.map((i) => (
              <Badge key={i} variant="accent">
                {i}
              </Badge>
            ))}
            {user.lookingFor.map((i) => (
              <Badge key={i}>Looking for {i.toLowerCase()}</Badge>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {isMe ? (
              <>
                <ButtonLink href="/settings" variant="secondary">
                  <Pencil /> Edit profile
                </ButtonLink>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(location.href).catch(() => {});
                    toast("Profile link copied");
                  }}
                >
                  <Link2 /> Share
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={liked ? "secondary" : "primary"}
                  disabled={liked}
                  onClick={() => {
                    const mutual = state.likesYou.includes(user.id);
                    dispatch({ type: "likeProfile", userId: user.id });
                    toast(mutual ? `It's a match with ${first}!` : `You liked ${first}`);
                  }}
                >
                  <Heart className={cn(liked && "fill-accent text-accent")} />
                  {matched ? "Matched" : liked ? "Liked" : "Like"}
                </Button>
                <ButtonLink href={`/messages/${conversationIdFor(user.id)}`} variant="secondary">
                  <MessageCircle /> Message
                </ButtonLink>
                <Button variant="outline" onClick={() => dispatch({ type: "toggleFollow", userId: user.id })}>
                  {following ? "Following" : "Follow"}
                </Button>
                <Menu
                  items={[
                    { label: "Report", icon: Flag, onSelect: () => setSafety("report"), danger: true },
                    { label: `Block ${first}`, icon: ShieldOff, onSelect: () => setSafety("block"), danger: true },
                  ]}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {user.interests.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-medium tracking-[0.12em] text-subtle uppercase">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {user.interests.map((i) => (
              <Badge key={i}>{i}</Badge>
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 border-t border-line pt-5">
        <Segmented
          label="Profile sections"
          value={tab}
          onChange={setTab}
          className="mx-auto max-w-md"
          options={[
            { value: "posts", label: "Posts" },
            { value: "photos", label: "Photos" },
            { value: "private", label: "Private" },
          ]}
        />

        <div className="mt-5">
          {tab === "posts" &&
            (posts.length === 0 ? (
              <EmptyState
                icon={Grid3X3}
                title={isMe ? "Share your first post" : "No posts yet"}
                description={isMe ? "Posts appear on your profile and in your followers' feeds." : `When ${first} posts, you'll see it here.`}
              />
            ) : (
              <div className="grid grid-cols-3 gap-1 md:gap-3">
                {posts.map((p) => (
                  <Photo key={p.id} seed={p.images[0]} alt={p.caption} width={500} height={500} sizes="(max-width: 768px) 33vw, 280px" className="aspect-square rounded-md md:rounded-xl">
                    {p.images.length > 1 && <Images className="absolute top-2 right-2 size-4 text-white drop-shadow" />}
                    <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50 text-sm font-medium text-white opacity-0 transition-opacity hover:opacity-100">
                      <span className="flex items-center gap-1.5">
                        <Heart className="size-4 fill-white" /> {formatCount(p.likes)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MessageCircle className="size-4 fill-white" /> {p.comments.length}
                      </span>
                    </div>
                  </Photo>
                ))}
              </div>
            ))}

          {tab === "photos" && (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
              {user.gallery.map((seed, i) => (
                <Photo key={seed} seed={seed} alt={`${first}'s photo ${i + 1}`} width={600} height={800} sizes="(max-width: 768px) 50vw, 300px" className="aspect-[3/4] rounded-xl" />
              ))}
              {isMe && (
                <div className="grid aspect-[3/4] place-items-center rounded-xl border border-dashed border-line-strong text-center text-xs text-subtle">
                  <span>
                    <Camera className="mx-auto mb-2 size-5" />
                    Uploads arrive with
                    <br />
                    secure storage
                  </span>
                </div>
              )}
            </div>
          )}

          {tab === "private" && (
            <PrivateAlbum
              count={user.privateAlbumCount}
              isMe={isMe}
              first={first}
              requested={requested}
              onRequest={() => {
                setRequested(true);
                toast(`Access requested from ${first} (demo)`);
              }}
            />
          )}
        </div>
      </div>

      {!isMe && <SafetyDialogs user={user} action={safety} onClose={() => setSafety(null)} />}
      {isMe && (
        <p className="mt-10 text-center text-xs text-subtle">
          Member since {user.joined} · <Link href="/settings" className="underline-offset-2 hover:underline">Privacy settings</Link>
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, inline }: { label: string; value: number; inline?: boolean }) {
  return inline ? (
    <div className="text-sm">
      <dd className="inline font-semibold tabular-nums">{formatCount(value)}</dd> <dt className="inline text-muted">{label}</dt>
    </div>
  ) : (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{formatCount(value)}</dd>
    </div>
  );
}

function PrivateAlbum({
  count,
  isMe,
  first,
  requested,
  onRequest,
}: {
  count: number;
  isMe: boolean;
  first: string;
  requested: boolean;
  onRequest: () => void;
}) {
  if (count === 0) {
    return <EmptyState icon={Lock} title="No private photos" description={isMe ? "Private photos are only visible to people you approve." : `${first} hasn't added a private album.`} />;
  }
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line">
      <div className="grid grid-cols-3 gap-1 blur-2xl" aria-hidden>
        {Array.from({ length: Math.min(count, 6) }, (_, i) => (
          <div key={i} className="aspect-square" style={{ background: `hsl(${(i * 47) % 360} 18% ${18 + (i % 3) * 5}%)` }} />
        ))}
      </div>
      <div className="absolute inset-0 grid place-items-center bg-black/40 p-6 text-center">
        <div>
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-black/50 backdrop-blur">
            <Lock className="size-5" />
          </span>
          <p className="font-medium">
            {count} private {count === 1 ? "photo" : "photos"}
          </p>
          <p className="mt-1 max-w-xs text-sm text-white/70">
            {isMe
              ? "Only members you approve can view these. Access can be revoked at any time."
              : "Private media is shared by request only, and the owner can revoke access at any time."}
          </p>
          {!isMe && (
            <Button className="mt-4" onClick={onRequest} disabled={requested}>
              {requested ? "Request sent" : "Request access"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
