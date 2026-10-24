"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck, Heart, MapPin, MessageCircle, Search, SearchX, SlidersHorizontal, Sparkles, Undo2, X, Zap } from "lucide-react";
import { conversationIdFor, useDemo } from "@/lib/demo/store";
import { useSimulatedLoad } from "@/lib/demo/use-simulated-load";
import { IDENTITIES, INTENTS, type Identity, type Intent, type User } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Photo } from "@/components/ui/photo";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { Badge, Chip, CountBadge, PageHeader, VerifiedBadge } from "@/components/ui/primitives";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";

type Quick = "online" | "new" | "verified";
const QUICK: Array<{ id: Quick; label: string; icon: typeof Zap }> = [
  { id: "online", label: "Online now", icon: Zap },
  { id: "new", label: "New", icon: Sparkles },
  { id: "verified", label: "Verified", icon: BadgeCheck },
];

const MIN_AGE = 18;
const MAX_AGE = 80;
const ANY_DISTANCE = 100;
const AGES = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => MIN_AGE + i);

interface Filters {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  identities: Identity[];
  intents: Intent[];
}
const DEFAULT_FILTERS: Filters = { ageMin: MIN_AGE, ageMax: MAX_AGE, distanceKm: ANY_DISTANCE, identities: [], intents: [] };
const NO_QUICK: Record<Quick, boolean> = { online: false, new: false, verified: false };

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function DiscoverView() {
  const { visibleUsers, state, dispatch } = useDemo();
  const toast = useToast();
  const ready = useSimulatedLoad("discover");
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState(NO_QUICK);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [lastPassed, setLastPassed] = useState<User | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visibleUsers
      .filter((u) => !state.passed[u.id])
      .filter((u) => !q || [u.name, u.username, u.city, ...u.interests].some((s) => s.toLowerCase().includes(q)))
      .filter((u) => !quick.online || u.online)
      .filter((u) => !quick.new || u.isNew)
      .filter((u) => !quick.verified || u.verified)
      .filter((u) => u.age >= filters.ageMin && u.age <= filters.ageMax)
      .filter((u) => filters.distanceKm >= ANY_DISTANCE || u.distanceKm <= filters.distanceKm)
      .filter((u) => !filters.identities.length || filters.identities.some((i) => u.identities.includes(i)))
      .filter((u) => !filters.intents.length || filters.intents.some((i) => u.lookingFor.includes(i)))
      .sort((a, b) => Number(b.online) - Number(a.online) || a.distanceKm - b.distanceKm);
  }, [visibleUsers, state.passed, query, quick, filters]);

  const drawerCount =
    Number(filters.ageMin !== MIN_AGE || filters.ageMax !== MAX_AGE) +
    Number(filters.distanceKm < ANY_DISTANCE) +
    filters.identities.length +
    filters.intents.length;
  const filtered = !!query || drawerCount > 0 || Object.values(quick).some(Boolean);
  const clear = () => {
    setQuery("");
    setQuick(NO_QUICK);
    setFilters(DEFAULT_FILTERS);
  };

  const like = (u: User) => {
    const first = u.name.split(" ")[0];
    const mutual = state.likesYou.includes(u.id);
    dispatch({ type: "likeProfile", userId: u.id });
    toast(mutual ? `It's a match with ${first}!` : `You liked ${first}`);
  };
  const pass = (u: User) => {
    dispatch({ type: "passProfile", userId: u.id });
    setLastPassed(u);
    if (previewId === u.id) setPreviewId(null);
  };
  const undoPass = () => {
    if (!lastPassed) return;
    dispatch({ type: "undoPass", userId: lastPassed.id });
    setLastPassed(null);
  };

  const preview = previewId ? visibleUsers.find((u) => u.id === previewId) : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 md:py-8 lg:px-8">
      <PageHeader title="Discover" subtitle="Members near Chicago, IL · demo profiles" />

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search names, cities, interests"
              aria-label="Search members"
              className="h-11 w-full rounded-xl border border-line bg-surface-2 pr-4 pl-10 text-sm outline-none placeholder:text-subtle focus:border-accent/60"
            />
          </div>
          <Button variant="secondary" className="h-11" onClick={() => setFiltersOpen(true)} aria-haspopup="dialog">
            <SlidersHorizontal />
            <span className="hidden sm:inline">Filters</span>
            <CountBadge count={drawerCount} />
            {drawerCount > 0 && <span className="sr-only">{drawerCount} active</span>}
          </Button>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {QUICK.map(({ id, label, icon: Icon }) => (
            <Chip key={id} active={quick[id]} onClick={() => setQuick((q) => ({ ...q, [id]: !q[id] }))}>
              <Icon />
              {label}
            </Chip>
          ))}
          {filters.distanceKm < ANY_DISTANCE && (
            <Chip active onClick={() => setFilters((f) => ({ ...f, distanceKm: ANY_DISTANCE }))} aria-label={`Remove filter: within ${filters.distanceKm} km`}>
              <MapPin />
              Within {filters.distanceKm} km
              <X />
            </Chip>
          )}
          {[...filters.intents, ...filters.identities].map((v) => (
            <Chip
              key={v}
              active
              aria-label={`Remove filter: ${v}`}
              onClick={() =>
                setFilters((f) => ({
                  ...f,
                  intents: f.intents.filter((x) => x !== v),
                  identities: f.identities.filter((x) => x !== v),
                }))
              }
            >
              {v}
              <X />
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {lastPassed && (
          <div role="status" className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm text-muted animate-fade-in">
            <span className="flex-1">Passed on {lastPassed.name.split(" ")[0]}. They won&apos;t show up in Discover.</span>
            <Button size="sm" variant="ghost" onClick={undoPass}>
              <Undo2 />
              Undo
            </Button>
          </div>
        )}

        {!ready ? (
          <Grid>
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))}
          </Grid>
        ) : results.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="No members match these filters"
              description="Try widening your distance or age range, or removing a filter."
              action={
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Sparkles} title="You've seen everyone nearby" description="Check back later — new members join every day." />
          )
        ) : (
          <>
            {filtered && (
              <p className="mb-3 text-sm text-muted" aria-live="polite">
                {results.length} {results.length === 1 ? "member" : "members"}
                <button onClick={clear} className="ml-3 rounded text-accent hover:text-accent-hover">
                  Clear all
                </button>
              </p>
            )}
            <Grid>
              {results.map((u, i) => (
                <ProfileCard
                  key={u.id}
                  user={u}
                  liked={state.youLiked.includes(u.id)}
                  matched={state.matches.includes(u.id)}
                  priority={i < 4}
                  onOpen={() => setPreviewId(u.id)}
                  onLike={() => like(u)}
                  onPass={() => pass(u)}
                />
              ))}
            </Grid>
          </>
        )}
      </div>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        resultCount={results.length}
      />

      {preview && (
        <ProfilePreview
          key={preview.id}
          user={preview}
          liked={state.youLiked.includes(preview.id)}
          matched={state.matches.includes(preview.id)}
          onClose={() => setPreviewId(null)}
          onLike={() => like(preview)}
          onPass={() => pass(preview)}
        />
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">{children}</div>;
}

function FilterSheet({
  open,
  onClose,
  filters,
  onChange,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  resultCount: number;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="sheet"
      title="Filters"
      description="Results update as you go."
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset
          </Button>
          <Button className="flex-1" onClick={onClose}>
            Show {resultCount} {resultCount === 1 ? "member" : "members"}
          </Button>
        </div>
      }
    >
      <div className="space-y-7">
        <fieldset>
          <legend className="text-[13px] font-medium text-muted">Age</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="From">
              {(p) => (
                <Select {...p} value={filters.ageMin} onChange={(e) => set({ ageMin: Number(e.target.value) })}>
                  {AGES.filter((a) => a <= filters.ageMax).map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="To">
              {(p) => (
                <Select {...p} value={filters.ageMax} onChange={(e) => set({ ageMax: Number(e.target.value) })}>
                  {AGES.filter((a) => a >= filters.ageMin).map((a) => (
                    <option key={a} value={a}>
                      {a === MAX_AGE ? `${a}+` : a}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </fieldset>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="distance" className="text-[13px] font-medium text-muted">
              Distance
            </label>
            <span className="text-sm tabular-nums">{filters.distanceKm >= ANY_DISTANCE ? "Any" : `Within ${filters.distanceKm} km`}</span>
          </div>
          <input
            id="distance"
            type="range"
            min={1}
            max={ANY_DISTANCE}
            value={filters.distanceKm}
            onChange={(e) => set({ distanceKm: Number(e.target.value) })}
            aria-valuetext={filters.distanceKm >= ANY_DISTANCE ? "Any distance" : `${filters.distanceKm} kilometers`}
            className="mt-3 w-full accent-accent"
          />
          <p className="mt-1 text-xs text-subtle">Distances are approximate — exact locations are never shared.</p>
        </div>

        <ChipGroup label="Looking for" options={INTENTS} selected={filters.intents} onToggle={(i) => set({ intents: toggle(filters.intents, i) })} />
        <ChipGroup label="Identity" options={IDENTITIES} selected={filters.identities} onToggle={(i) => set({ identities: toggle(filters.identities, i) })} />
      </div>
    </Dialog>
  );
}

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-[13px] font-medium text-muted">{label}</legend>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} active={selected.includes(o)} onClick={() => onToggle(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

function ProfilePreview({
  user,
  liked,
  matched,
  onClose,
  onLike,
  onPass,
}: {
  user: User;
  liked: boolean;
  matched: boolean;
  onClose: () => void;
  onLike: () => void;
  onPass: () => void;
}) {
  const photos = [user.photo, ...user.gallery.filter((g) => g !== user.photo)].slice(0, 5);
  const [index, setIndex] = useState(0);

  return (
    <Dialog
      open
      onClose={onClose}
      variant="sheet"
      title={`${user.name}, ${user.age}`}
      description={`${user.pronouns} · ${user.city} · ${user.distanceKm} km away`}
      footer={
        matched ? (
          <ButtonLink href={`/messages/${conversationIdFor(user.id)}`} className="w-full">
            <MessageCircle />
            Message
          </ButtonLink>
        ) : (
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onPass}>
              <X />
              Pass
            </Button>
            <Button className="flex-1" onClick={onLike} disabled={liked}>
              <Heart className={cn(liked && "fill-current")} />
              {liked ? "Liked" : "Like"}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        <div>
          <Photo
            seed={photos[index]}
            alt={`${user.name}, photo ${index + 1} of ${photos.length}`}
            width={600}
            height={750}
            sizes="(max-width: 768px) 100vw, 336px"
            className="aspect-[4/5] rounded-2xl border border-line"
          />
          {photos.length > 1 && (
            <div className="mt-2 grid grid-cols-5 gap-1.5" role="group" aria-label="Photos">
              {photos.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={i === index}
                  className={cn("overflow-hidden rounded-lg border-2 transition-opacity", i === index ? "border-accent" : "border-transparent opacity-60 hover:opacity-100")}
                >
                  <Photo seed={p} alt="" width={120} height={120} sizes="64px" className="aspect-square" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {user.verified && (
            <Badge variant="accent">
              <BadgeCheck /> Verified
            </Badge>
          )}
          <Badge>{user.online ? "Online now" : `Active ${user.lastActive}`}</Badge>
        </div>

        <p className="text-[15px] leading-relaxed">{user.bio}</p>

        <section>
          <h3 className="text-[13px] font-medium text-muted">Looking for</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {user.lookingFor.map((i) => (
              <Badge key={i} variant="outline">
                {i}
              </Badge>
            ))}
          </div>
        </section>

        {user.interests.length > 0 && (
          <section>
            <h3 className="text-[13px] font-medium text-muted">Interests</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.interests.map((i) => (
                <Badge key={i}>{i}</Badge>
              ))}
            </div>
          </section>
        )}

        <Link href={`/profile/${user.username}`} className="inline-block rounded text-sm font-medium text-accent hover:text-accent-hover">
          View full profile
        </Link>
      </div>
    </Dialog>
  );
}

/**
 * Photo card for grids. With `onOpen` it opens a preview instead of navigating, and
 * shows hover/focus like + pass actions on desktop (mobile acts from the preview sheet).
 */
export function ProfileCard({
  user,
  liked,
  matched,
  priority,
  onOpen,
  onLike,
  onPass,
}: {
  user: User;
  liked?: boolean;
  matched?: boolean;
  priority?: boolean;
  onOpen?: () => void;
  onLike?: () => void;
  onPass?: () => void;
}) {
  const first = user.name.split(" ")[0];
  const label = `${first}, ${user.age}${user.verified ? ", verified" : ""}, ${user.distanceKm} km away`;
  const overlayClass = "absolute inset-0 z-10 rounded-2xl";

  return (
    <div className="group relative animate-fade-in">
      <Photo
        seed={user.photo}
        alt=""
        width={600}
        height={800}
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
        priority={priority}
        className="aspect-[3/4] rounded-2xl border border-line"
        imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 via-45% to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {user.online && (
            <span className="flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-[11px] text-white backdrop-blur">
              <span className="size-1.5 rounded-full bg-online" /> Online
            </span>
          )}
          {user.isNew && <span className="rounded-full bg-black/55 px-2 py-1 text-[11px] text-white backdrop-blur">New</span>}
        </div>
        {(liked || matched) && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-accent px-2 py-1 text-[11px] font-medium text-accent-fg">
            {matched ? "Match" : "Liked"}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white">
          <p className="flex items-center gap-1 text-[15px] font-medium">
            <span className="truncate">{first}</span>
            <span className="font-normal text-white/80">{user.age}</span>
            {user.verified && <VerifiedBadge className="size-3.5" />}
          </p>
          <p className="mt-0.5 truncate text-xs text-white/70">
            {user.identities.slice(0, 2).join(" · ")} · {user.distanceKm} km
          </p>
        </div>
      </Photo>

      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={`Preview ${label}`} className={overlayClass} />
      ) : (
        <Link href={`/profile/${user.username}`} aria-label={label} className={overlayClass} />
      )}

      {onLike && onPass && !matched && (
        <div className="absolute right-2.5 bottom-14 z-20 hidden gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
          <button
            type="button"
            onClick={onPass}
            aria-label={`Pass on ${first}`}
            className="grid size-10 place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          >
            <X className="size-5" />
          </button>
          <button
            type="button"
            onClick={onLike}
            disabled={liked}
            aria-label={liked ? `You liked ${first}` : `Like ${first}`}
            className="grid size-10 place-items-center rounded-full bg-accent text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-70"
          >
            <Heart className={cn("size-5", liked && "fill-current")} />
          </button>
        </div>
      )}
    </div>
  );
}
