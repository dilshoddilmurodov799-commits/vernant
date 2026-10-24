"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Eye, KeyRound, Lock, LogOut, Palette, RotateCcw, ShieldCheck, ShieldOff, Trash2, UserRound } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonStyles } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Card, PageHeader, Switch } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ThemeSegmented } from "@/components/ui/theme-toggle";
import type { Settings, Visibility } from "@/lib/types";

const VISIBILITY: Array<{ value: Visibility; label: string }> = [
  { value: "everyone", label: "All verified members" },
  { value: "members", label: "Members I follow or who follow me" },
  { value: "matches", label: "Matches only" },
];

/** `accountEmail` is the signed-in user's own address (from the server session); never shown to others. */
export function SettingsView({ accountEmail }: { accountEmail: string }) {
  const { state, dispatch, getUser } = useDemo();
  const toast = useToast();
  const { settings, me } = state;
  const [profile, setProfile] = useState({ name: me.name, bio: me.bio, city: me.city });
  const set = (patch: Partial<Settings>) => dispatch({ type: "updateSettings", patch });
  const blocked = Object.entries(state.blocked).filter(([, v]) => v).map(([id]) => getUser(id)!).filter(Boolean);
  const profileDirty = profile.name !== me.name || profile.bio !== me.bio || profile.city !== me.city;

  return (
    <div className="mx-auto max-w-2xl px-4 py-5 md:py-8">
      <PageHeader title="Settings" subtitle="Changes apply to this demo session only." />

      <div className="space-y-6">
        <Section icon={Palette} title="Appearance">
          <div className="space-y-3 p-5">
            <ThemeSegmented className="max-w-sm" />
            <p className="text-xs text-subtle">System follows your device setting. Saved on this device.</p>
          </div>
          <Link href="/design" className="flex items-center justify-between px-5 py-4 text-sm transition-colors hover:bg-surface-2">
            Design system reference
            <ChevronRight className="size-4 text-subtle" />
          </Link>
        </Section>

        <Section icon={UserRound} title="Profile">
          <form
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!profile.name.trim()) return;
              dispatch({ type: "updateProfile", patch: { name: profile.name.trim(), bio: profile.bio.trim(), city: profile.city.trim() } });
              toast("Profile updated");
            }}
          >
            <div className="flex items-center gap-4">
              <Avatar name={me.name} seed={me.photo} size="lg" />
              <p className="text-sm text-muted">Photo uploads and verification selfies will use private Supabase Storage buckets.</p>
            </div>
            <Field label="Display name" error={!profile.name.trim() ? "Display name is required" : undefined}>
              {(p) => <Input {...p} value={profile.name} maxLength={40} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />}
            </Field>
            <Field label="Bio" hint={`${profile.bio.length}/300`}>
              {(p) => <Textarea {...p} value={profile.bio} maxLength={300} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />}
            </Field>
            <Field label="City">
              {(p) => <Input {...p} value={profile.city} maxLength={60} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={!profileDirty || !profile.name.trim()}>
                Save changes
              </Button>
            </div>
          </form>
        </Section>

        <Section icon={Eye} title="Privacy">
          <Row label="Who can see my profile" description="Hidden members won't appear in Discover.">
            <Select aria-label="Who can see my profile" value={settings.visibility} onChange={(e) => set({ visibility: e.target.value as Visibility })} className="h-9 w-auto max-w-[180px] text-xs">
              {VISIBILITY.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Who can message me">
            <Select aria-label="Who can message me" value={settings.allowMessagesFrom} onChange={(e) => set({ allowMessagesFrom: e.target.value as Visibility })} className="h-9 w-auto max-w-[180px] text-xs">
              {VISIBILITY.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Row>
          <Row label="Show my distance" description="Others see an approximate distance, never your exact location.">
            <Switch label="Show my distance" checked={settings.showDistance} onChange={(v) => set({ showDistance: v })} />
          </Row>
          <Row label="Show when I'm online">
            <Switch label="Show when I'm online" checked={settings.showOnline} onChange={(v) => set({ showOnline: v })} />
          </Row>
          <Row label="Incognito browsing" description="Browse profiles without appearing in their visitors.">
            <Switch label="Incognito browsing" checked={settings.incognito} onChange={(v) => set({ incognito: v })} />
          </Row>
        </Section>

        <Section icon={Lock} title="Private media">
          <Row label="Private album access" description="Who can view your private photos.">
            <Select
              aria-label="Private album access"
              value={settings.privateAlbumAccess}
              onChange={(e) => set({ privateAlbumAccess: e.target.value as Settings["privateAlbumAccess"] })}
              className="h-9 w-auto text-xs"
            >
              <option value="approved">Only people I approve</option>
              <option value="matches">All my matches</option>
            </Select>
          </Row>
          <Row label="Blur incoming photos" description="Photos in messages stay blurred until you tap them.">
            <Switch label="Blur incoming photos" checked={settings.blurIncomingMedia} onChange={(v) => set({ blurIncomingMedia: v })} />
          </Row>
        </Section>

        <Section icon={ShieldOff} title="Blocked members">
          {blocked.length === 0 ? (
            <p className="p-5 text-sm text-muted">You haven&apos;t blocked anyone. Block from any profile, post, or conversation menu.</p>
          ) : (
            blocked.map((u) => (
              <Row key={u.id} label={u.name} description={`@${u.username}`}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    dispatch({ type: "unblock", userId: u.id });
                    toast(`${u.name.split(" ")[0]} unblocked`);
                  }}
                >
                  Unblock
                </Button>
              </Row>
            ))
          )}
          {state.reports.length > 0 && (
            <p className="border-t border-line px-5 py-3 text-xs text-subtle">
              {state.reports.length} report{state.reports.length > 1 && "s"} submitted this session (demo — not sent).
            </p>
          )}
        </Section>

        <Section icon={Bell} title="Notifications">
          {(
            [
              ["notifyMatches", "New matches"],
              ["notifyMessages", "Messages"],
              ["notifyLikes", "Likes and comments"],
              ["notifyCommunity", "Community events"],
            ] as const
          ).map(([key, label]) => (
            <Row key={key} label={label}>
              <Switch label={label} checked={settings[key]} onChange={(v) => set({ [key]: v })} />
            </Row>
          ))}
        </Section>

        <Section icon={ShieldCheck} title="Account & security">
          <Row label="Email" description={accountEmail || "—"}>
            <Button variant="secondary" size="sm" disabled title="Email change isn't available yet">
              Change
            </Button>
          </Row>
          <Row label="Password">
            <Link href="/reset-password" className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <KeyRound /> Update
            </Link>
          </Row>
          <Row label="Photo verification" description={me.verified ? "Verified" : "Not verified"}>
            <span className={cn("text-xs", me.verified ? "text-accent" : "text-subtle")}>{me.verified ? "Active" : "—"}</span>
          </Row>
        </Section>

        <Card className="divide-y divide-line">
          <Row label="Reset demo data" description="Restore every demo profile, message, and setting.">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                dispatch({ type: "reset" });
                toast("Demo data reset");
              }}
            >
              <RotateCcw /> Reset
            </Button>
          </Row>
          <Row label="Log out">
            <form action={signOut}>
              <Button type="submit" variant="secondary" size="sm">
                <LogOut /> Log out
              </Button>
            </form>
          </Row>
          <Row label="Delete account" description="Permanent deletion will run as a server-side job.">
            <Button variant="danger" size="sm" disabled>
              <Trash2 /> Delete
            </Button>
          </Row>
        </Card>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Bell; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-sm font-medium text-muted">
        <Icon className="size-4" />
        {title}
      </h2>
      <Card className="divide-y divide-line">{children}</Card>
    </section>
  );
}

function Row({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {description && <p className="mt-0.5 text-xs text-subtle">{description}</p>}
      </div>
      {children}
    </div>
  );
}
