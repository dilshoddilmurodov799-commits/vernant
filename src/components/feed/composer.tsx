"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, ImagePlus, Users } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { DEMO_PHOTO_CHOICES } from "@/lib/demo/data";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Photo } from "@/components/ui/photo";
import { Segmented } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import type { Post } from "@/lib/types";

const MAX = 500;

export function ComposerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useDemo();
  const toast = useToast();
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState(DEMO_PHOTO_CHOICES[0]);
  const [audience, setAudience] = useState<Post["audience"]>("public");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim()) return;
    dispatch({ type: "addPost", caption: caption.trim(), image, audience });
    setCaption("");
    onClose();
    toast("Posted to your feed (demo — not saved)");
    router.push("/feed");
  };

  return (
    <Dialog open={open} onClose={onClose} title="New post" description="Uploads arrive with Supabase Storage. For now, pick a demo photo.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Photo">
          {DEMO_PHOTO_CHOICES.map((seed) => (
            <button
              key={seed}
              type="button"
              role="radio"
              aria-checked={image === seed}
              aria-label={`Demo photo ${seed.slice(-1)}`}
              onClick={() => setImage(seed)}
              className={cn(
                "overflow-hidden rounded-lg ring-2 ring-offset-2 ring-offset-surface transition",
                image === seed ? "ring-accent" : "ring-transparent opacity-60 hover:opacity-100",
              )}
            >
              <Photo seed={seed} alt="" width={120} height={120} sizes="64px" className="aspect-square" />
            </button>
          ))}
        </div>
        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, MAX))}
          placeholder="Share something with the community…"
          aria-label="Caption"
          rows={4}
        />
        <div className="flex items-center justify-between gap-3">
          <Segmented
            label="Audience"
            value={audience}
            onChange={setAudience}
            options={[
              { value: "public", label: "Everyone" },
              { value: "followers", label: "Followers" },
            ]}
            className="w-56"
          />
          <span className="text-xs text-subtle tabular-nums">
            {caption.length}/{MAX}
          </span>
        </div>
        <p className="flex items-center gap-2 text-xs text-subtle">
          {audience === "public" ? <Globe className="size-3.5" /> : <Users className="size-3.5" />}
          {audience === "public" ? "Visible to all verified members." : "Only people who follow you will see this."}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!caption.trim()}>
            <ImagePlus />
            Share
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
