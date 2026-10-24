"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleSlash, Pause, Play, Send, X } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Photo } from "@/components/ui/photo";
import { EmptyState } from "@/components/ui/states";
import { ButtonLink } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useMemberAction } from "@/components/auth/member-gate";

const FRAME_MS = 5000;
const TICK_MS = 50;

export function StoryViewer({ storyId }: { storyId: string }) {
  const { stories, getUser, dispatch } = useDemo();
  const router = useRouter();
  const toast = useToast();
  const member = useMemberAction();
  const storyIndex = stories.findIndex((s) => s.id === storyId);
  const story = stories[storyIndex];
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState("");

  const goTo = (delta: 1 | -1) => {
    if (!story) return;
    const nextFrame = frame + delta;
    if (nextFrame >= 0 && nextFrame < story.frames.length) {
      setFrame(nextFrame);
      setElapsed(0);
      return;
    }
    const nextStory = stories[storyIndex + delta];
    if (nextStory || delta === 1) setPaused(true);
    if (nextStory) router.replace(`/stories/${nextStory.id}`);
    else if (delta === 1) router.push("/feed");
    else setElapsed(0);
  };

  useEffect(() => {
    if (story) dispatch({ type: "seeStory", storyId: story.id });
  }, [story, dispatch]);

  useEffect(() => {
    if (paused || !story) return;
    const t = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(t);
  }, [paused, story]);

  // Advance once the current frame has fully elapsed.
  useEffect(() => {
    if (paused || elapsed < FRAME_MS) return;
    const t = setTimeout(() => goTo(1));
    return () => clearTimeout(t);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight") goTo(1);
      if (e.key === "ArrowLeft") goTo(-1);
      if (e.key === "Escape") router.push("/feed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!story) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <EmptyState
          icon={CircleSlash}
          title="This story is no longer available"
          description="Stories disappear after 24 hours, or the member may have restricted who can see them."
          action={<ButtonLink href="/feed">Back to feed</ButtonLink>}
        />
      </div>
    );
  }

  const user = getUser(story.userId)!;
  const current = story.frames[frame];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="relative h-full w-full overflow-hidden md:h-[92dvh] md:max-h-[860px] md:w-auto md:aspect-[9/16] md:rounded-2xl">
        <Photo key={current.id} seed={current.image} alt={current.caption ?? `Story by ${user.name}`} width={720} height={1280} sizes="(max-width: 768px) 100vw, 480px" priority className="absolute inset-0 animate-fade-in" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent via-25% to-black/70" />

        {/* Tap zones */}
        <button aria-label="Previous" onClick={() => goTo(-1)} className="absolute inset-y-0 left-0 w-1/3" />
        <button aria-label="Next" onClick={() => goTo(1)} className="absolute inset-y-0 right-0 w-2/3" />

        <div className="absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1">
            {story.frames.map((f, i) => (
              <div key={f.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full bg-white"
                  style={{ width: i < frame ? "100%" : i === frame ? `${Math.min(100, (elapsed / FRAME_MS) * 100)}%` : "0%" }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <Link href={`/profile/${user.username}`} className="relative flex items-center gap-2.5">
              <Avatar name={user.name} seed={user.photo} size="sm" />
              <span className="text-sm font-medium text-white">{user.name}</span>
            </Link>
            <span className="text-xs text-white/60">{current.time}</span>
            <div className="relative ml-auto flex items-center gap-1">
              <button onClick={() => setPaused((p) => !p)} aria-label={paused ? "Play" : "Pause"} className="grid size-9 place-items-center rounded-full text-white hover:bg-white/10">
                {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
              </button>
              <Link href="/feed" aria-label="Close stories" className="grid size-9 place-items-center rounded-full text-white hover:bg-white/10">
                <X className="size-6" />
              </Link>
            </div>
          </div>
        </div>

        {current.caption && (
          <p className="pointer-events-none absolute inset-x-0 bottom-24 px-6 text-center font-display text-3xl text-white drop-shadow-lg">{current.caption}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!reply.trim()) return;
            member(() => {
              dispatch({ type: "sendMessage", userId: user.id, text: `Replied to your story: ${reply.trim()}` });
              setReply("");
              setPaused(false);
              toast(`Reply sent to ${user.name.split(" ")[0]}`);
            });
          }}
          className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, 500))}
            onFocus={() => setPaused(true)}
            onBlur={() => !reply && setPaused(false)}
            placeholder={`Reply to ${user.name.split(" ")[0]}…`}
            aria-label="Reply to story"
            className="h-11 min-w-0 flex-1 rounded-full border border-white/30 bg-black/30 px-4 text-sm text-white placeholder:text-white/60 outline-none backdrop-blur focus:border-white/60"
          />
          <button type="submit" aria-label="Send reply" disabled={!reply.trim()} className={cn("grid size-11 place-items-center rounded-full text-white", !reply.trim() && "opacity-50")}>
            <Send className="size-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
