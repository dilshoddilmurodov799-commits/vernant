"use client";

import { useState } from "react";
import { Bell, Flag, Heart, Inbox, Pencil, Plus, Search, Send, Share2, ShieldOff, Sparkles } from "lucide-react";
import { DEMO_USERS } from "@/lib/demo/data";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, Card, Chip, CountBadge, PageHeader, Segmented, Switch, VerifiedBadge } from "@/components/ui/primitives";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { ThemeSegmented } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { ProfileCard } from "@/components/discover/discover-view";

const COLORS: Array<{ token: string; className: string }> = [
  { token: "bg", className: "bg-bg" },
  { token: "surface", className: "bg-surface" },
  { token: "surface-2", className: "bg-surface-2" },
  { token: "surface-3", className: "bg-surface-3" },
  { token: "surface-4", className: "bg-surface-4" },
  { token: "fg", className: "bg-fg" },
  { token: "muted", className: "bg-muted" },
  { token: "subtle", className: "bg-subtle" },
  { token: "accent", className: "bg-accent" },
  { token: "accent-soft", className: "bg-accent-soft" },
  { token: "online", className: "bg-online" },
  { token: "danger", className: "bg-danger" },
];

/** Living reference for Vernant's tokens and components. Renders in the active theme. */
export function DesignSystemView() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [chips, setChips] = useState<Record<string, boolean>>({ Bear: true });
  const [seg, setSeg] = useState<"grid" | "list" | "map">("grid");
  const [on, setOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [a, b, c] = DEMO_USERS;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 md:py-8 lg:px-8">
      <PageHeader title="Design system" subtitle="Vernant tokens and components, rendered in the current theme." actions={<ThemeSegmented className="w-64" />} />

      <div className="space-y-10">
        <Section title="Color" note="Semantic tokens. Every text pairing meets WCAG AA (4.5:1) in both themes.">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {COLORS.map(({ token, className }) => (
              <div key={token}>
                <div className={`h-14 rounded-xl border border-line ${className}`} />
                <p className="mt-1.5 font-mono text-[11px] text-muted">{token}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography" note="Geist for interface text; Instrument Serif for editorial moments only.">
          <div className="space-y-3">
            <p className="font-display text-5xl leading-none tracking-tight">Room for all of you.</p>
            <p className="text-2xl font-semibold tracking-tight">Page title · 24/semibold</p>
            <p className="text-[15px] font-medium">Section heading · 15/medium</p>
            <p className="max-w-prose text-[15px] leading-relaxed text-fg/90">
              Body · 15/relaxed. Pitmaster on weekends, architect on weekdays. Looking for someone who doesn&apos;t mind smelling like hickory.
            </p>
            <p className="text-sm text-muted">Secondary · 14 muted</p>
            <p className="text-xs text-subtle">Caption · 12 subtle</p>
            <p className="text-xs font-medium tracking-[0.12em] text-subtle uppercase">Overline · 12 tracked</p>
          </div>
        </Section>

        <Section title="Buttons" note="Radius 12px. Press scales to 98%. Focus shows a 2px accent outline.">
          <div className="flex flex-wrap items-center gap-2">
            <Button>
              <Heart /> Primary
            </Button>
            <Button variant="secondary">
              <Send /> Secondary
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">
              <Flag /> Danger
            </Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" variant="secondary" aria-label="Add">
              <Plus />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Share">
              <Share2 />
            </Button>
          </div>
        </Section>

        <Section title="Inputs">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Display name" hint="Shown on your profile">
              {(p) => <Input {...p} placeholder="Alex Mercer" />}
            </Field>
            <Field label="Email" error="Enter a valid email address">
              {(p) => <Input {...p} defaultValue="alex@" />}
            </Field>
            <Field label="Looking for">
              {(p) => (
                <Select {...p} defaultValue="dating">
                  <option value="dating">Dating</option>
                  <option value="friends">Friends</option>
                  <option value="community">Community</option>
                </Select>
              )}
            </Field>
            <div className="relative self-end">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
              <Input type="search" aria-label="Search" placeholder="Search members" className="pl-10" />
            </div>
            <Field label="Bio" className="md:col-span-2">
              {(p) => <Textarea {...p} placeholder="What should people know about you?" />}
            </Field>
          </div>
        </Section>

        <Section title="Selection">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {["Bear", "Chub", "Cub", "Admirer"].map((t) => (
                <Chip key={t} active={!!chips[t]} onClick={() => setChips((s) => ({ ...s, [t]: !s[t] }))}>
                  {t}
                </Chip>
              ))}
            </div>
            <Segmented
              label="View"
              value={seg}
              onChange={setSeg}
              className="max-w-sm"
              options={[
                { value: "grid", label: "Grid" },
                { value: "list", label: "List" },
                { value: "map", label: "Map" },
              ]}
            />
            <label className="flex items-center gap-3 text-sm">
              <Switch label="Show when I'm online" checked={on} onChange={setOn} />
              Show when I&apos;m online
            </label>
          </div>
        </Section>

        <Section title="Badges & avatars">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Neutral</Badge>
            <Badge variant="accent">Bear</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="danger">Reported</Badge>
            <Badge size="sm" variant="accent">
              <Sparkles /> New
            </Badge>
            <CountBadge count={3} />
            <CountBadge count={120} />
            <VerifiedBadge />
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <Avatar name={a.name} seed={a.photo} size="xs" />
            <Avatar name={a.name} seed={a.photo} size="sm" online />
            <Avatar name={b.name} seed={b.photo} size="md" />
            <Avatar name={c.name} seed={c.photo} size="lg" ring="new" />
            <Avatar name={b.name} seed={b.photo} size="lg" ring="seen" />
            <Avatar name="Sam Okafor" size="lg" />
            <Avatar name={a.name} seed={a.photo} size="xl" online />
          </div>
        </Section>

        <Section title="Cards">
          <div className="grid gap-4 md:grid-cols-[repeat(2,minmax(0,220px))_1fr]">
            <ProfileCard user={a} />
            <ProfileCard user={c} matched />
            <Card className="p-5">
              <p className="text-sm font-medium">Card</p>
              <p className="mt-1 text-sm text-muted">Surface + 1px line + 16px radius. Elevation is reserved for floating layers.</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm">
                  <Pencil /> Edit
                </Button>
                <Button size="sm" variant="ghost">
                  Dismiss
                </Button>
              </div>
            </Card>
          </div>
        </Section>

        <Section title="Overlays & feedback">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setDialog(true)}>
              Open dialog
            </Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Open sheet
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">Open menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Marcus Hale</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => toast("Notifications muted", "info")}>
                  <Bell /> Mute
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Inbox /> Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="danger" onSelect={() => toast("Blocked (demo)")}>
                  <ShieldOff /> Block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" onClick={() => toast("Saved to your collection")}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => toast("Couldn't send. Check your connection.", "error")}>
              Error toast
            </Button>
            <Button variant="secondary" onClick={() => setLoading((l) => !l)}>
              {loading ? "Hide" : "Show"} skeleton
            </Button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Card className="p-4">
              {loading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skeleton className="aspect-[4/3] rounded-xl" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar name={a.name} seed={a.photo} size="md" online />
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-subtle">Loaded content</p>
                  </div>
                </div>
              )}
            </Card>
            <Card>
              <EmptyState icon={Inbox} title="No messages yet" description="Empty states explain why and offer a next step." className="py-8" />
            </Card>
            <Card>
              <ErrorState onRetry={() => toast("Retrying…", "info")} className="py-8" />
            </Card>
          </div>
        </Section>
      </div>

      <Dialog open={dialog} onClose={() => setDialog(false)} title="Block Marcus?" description="They won't be able to find your profile or message you. They won't be notified.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDialog(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => setDialog(false)}>
            Block
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        variant="sheet"
        title="Filters"
        description="Bottom sheet on mobile, side drawer on desktop."
        footer={
          <Button className="w-full" onClick={() => setSheet(false)}>
            Done
          </Button>
        }
      >
        <p className="text-sm text-muted">Long content scrolls while the footer stays pinned.</p>
      </Dialog>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-6">
      <div className="mb-4">
        <h2 className="text-[15px] font-medium">{title}</h2>
        {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}
