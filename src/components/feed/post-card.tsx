"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, EyeOff, Flag, Heart, Link2, MessageCircle, Send, ShieldOff, Users } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { cn, formatCount } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Photo } from "@/components/ui/photo";
import { Menu } from "@/components/ui/menu";
import { VerifiedBadge } from "@/components/ui/primitives";
import { Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useMemberAction } from "@/components/auth/member-gate";
import { SafetyDialogs, type SafetyAction } from "@/components/safety/safety-dialogs";
import type { Post } from "@/lib/types";

export function PostCard({ post, onHide, priority }: { post: Post; onHide?: (id: string) => void; priority?: boolean }) {
  const { state, dispatch, getUser } = useDemo();
  const toast = useToast();
  const member = useMemberAction();
  const author = getUser(post.authorId);
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");
  const [safety, setSafety] = useState<SafetyAction>(null);
  const commentRef = useRef<HTMLInputElement>(null);

  if (!author) return null;
  const liked = !!state.likedPosts[post.id];
  const saved = !!state.savedPosts[post.id];
  const isMine = author.id === state.me.id;
  const following = !!state.following[author.id];
  const visibleComments = showComments ? post.comments : post.comments.slice(-1);

  const like = () => member(() => dispatch({ type: "togglePostLike", postId: post.id }));
  const doubleTapLike = () =>
    member(() => {
      if (!liked) like();
      setBurst((b) => b + 1);
    });

  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-surface animate-rise">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={`/profile/${author.username}`} className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={author.name} seed={author.photo} size="sm" online={author.online} />
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-sm font-medium">
              <span className="truncate">{author.name}</span>
              {author.verified && <VerifiedBadge className="size-3.5" />}
            </p>
            <p className="truncate text-xs text-subtle">
              {[post.location, post.time === "now" ? "Just now" : post.time].filter(Boolean).join(" · ")}
              {post.audience === "followers" && (
                <span className="ml-1.5 inline-flex items-center gap-1 align-[-2px]">
                  · <Users className="size-3" /> Followers
                </span>
              )}
            </p>
          </div>
        </Link>
        {!isMine && (
          <button
            type="button"
            aria-pressed={following}
            onClick={() =>
              member(() => {
                dispatch({ type: "toggleFollow", userId: author.id });
                toast(following ? `Unfollowed ${author.name.split(" ")[0]}` : `Following ${author.name.split(" ")[0]}`);
              })
            }
            className={cn(
              "h-8 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors",
              following ? "text-muted hover:bg-surface-2 hover:text-fg" : "bg-surface-3 text-fg hover:bg-surface-4",
            )}
          >
            {following ? "Following" : "Follow"}
          </button>
        )}
        <Menu
          items={[
            {
              label: "Copy link",
              icon: Link2,
              onSelect: () => {
                void navigator.clipboard?.writeText(`${location.origin}/profile/${author.username}`).catch(() => {});
                toast("Link copied");
              },
            },
            ...(isMine
              ? []
              : [
                  { label: "Hide post", icon: EyeOff, onSelect: () => onHide?.(post.id) },
                  { label: "Report", icon: Flag, onSelect: () => member(() => setSafety("report")), danger: true },
                  { label: `Block ${author.name.split(" ")[0]}`, icon: ShieldOff, onSelect: () => member(() => setSafety("block")), danger: true },
                ]),
          ]}
        />
      </header>

      <div className="relative" onDoubleClick={doubleTapLike}>
        <Photo
          seed={post.images[index]}
          alt={`Photo by ${author.name}`}
          width={1000}
          height={1250}
          priority={priority && index === 0}
          sizes="(max-width: 768px) 100vw, 600px"
          className="aspect-[4/5] w-full select-none"
        />
        {burst > 0 && (
          <Heart key={burst} aria-hidden className="pointer-events-none absolute inset-0 m-auto size-24 fill-white text-white drop-shadow-xl animate-pop" />
        )}
        {post.images.length > 1 && (
          <>
            {index > 0 && (
              <button onClick={() => setIndex(index - 1)} aria-label="Previous photo" className="absolute top-1/2 left-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70">
                <ChevronLeft className="size-4" />
              </button>
            )}
            {index < post.images.length - 1 && (
              <button onClick={() => setIndex(index + 1)} aria-label="Next photo" className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70">
                <ChevronRight className="size-4" />
              </button>
            )}
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
              {post.images.map((_, i) => (
                <span key={i} className={cn("size-1.5 rounded-full transition-colors", i === index ? "bg-white" : "bg-white/40")} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-4 pt-3 pb-4">
        <div className="-ml-2 flex items-center">
          <ActionButton label={liked ? "Unlike" : "Like"} onClick={like} active={liked}>
            <Heart className={cn("size-[22px] transition-transform", liked && "scale-110 fill-accent text-accent")} />
          </ActionButton>
          <ActionButton
            label="Comment"
            onClick={() => {
              setShowComments(true);
              commentRef.current?.focus();
            }}
          >
            <MessageCircle className="size-[22px]" />
          </ActionButton>
          <ActionButton
            label="Share"
            onClick={() => {
              void navigator.clipboard?.writeText(`${location.origin}/profile/${author.username}`).catch(() => {});
              toast("Link copied to share");
            }}
          >
            <Send className="size-[21px]" />
          </ActionButton>
          <ActionButton
            label={saved ? "Remove from saved" : "Save"}
            onClick={() =>
              member(() => {
                dispatch({ type: "togglePostSave", postId: post.id });
                toast(saved ? "Removed from saved" : "Saved to your collection");
              })
            }
            className="ml-auto"
          >
            <Bookmark className={cn("size-[22px]", saved && "fill-fg")} />
          </ActionButton>
        </div>
        <p className="mt-1.5 text-sm font-medium tabular-nums">{formatCount(post.likes)} likes</p>
        <p className="mt-1 text-sm leading-relaxed">
          <Link href={`/profile/${author.username}`} className="mr-1.5 font-medium">
            {author.username}
          </Link>
          <span className="text-fg/90">{post.caption}</span>
        </p>

        {post.comments.length > 1 && !showComments && (
          <button onClick={() => setShowComments(true)} className="mt-1.5 text-sm text-subtle hover:text-muted">
            View all {post.comments.length} comments
          </button>
        )}
        {visibleComments.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {visibleComments.map((c) => {
              const u = getUser(c.authorId);
              if (!u || state.blocked[u.id]) return null;
              return (
                <li key={c.id} className="text-sm">
                  <Link href={`/profile/${u.username}`} className="mr-1.5 font-medium">
                    {u.username}
                  </Link>
                  <span className="text-fg/80">{c.text}</span>
                </li>
              );
            })}
          </ul>
        )}

        {showComments && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              member(() => {
                dispatch({ type: "addComment", postId: post.id, text: comment.trim() });
                setComment("");
              });
            }}
            className="mt-3 flex items-center gap-2 border-t border-line pt-3"
          >
            <Avatar name={state.me.name} seed={state.me.photo} size="xs" />
            <input
              ref={commentRef}
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 300))}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
            />
            <button type="submit" disabled={!comment.trim()} className="text-sm font-medium text-accent disabled:opacity-40">
              Post
            </button>
          </form>
        )}
      </div>

      <SafetyDialogs user={author} action={safety} onClose={() => setSafety(null)} />
    </article>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  active,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("grid size-10 place-items-center rounded-xl text-fg transition-colors hover:bg-surface-2 active:scale-95", className)}
    >
      {children}
    </button>
  );
}

export function PostCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="size-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="aspect-[4/5] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
    </div>
  );
}
