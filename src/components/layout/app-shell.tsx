"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, Compass, Heart, Home, LogIn, MessageCircle, Plus, Settings, User, UserPlus, type LucideIcon } from "lucide-react";
import { useDemo } from "@/lib/demo/store";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { CountBadge } from "@/components/ui/primitives";
import { DemoNotice, Logo, LogoMark } from "@/components/ui/logo";
import { ComposerDialog } from "@/components/feed/composer";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ButtonLink } from "@/components/ui/button";
import { useLoginHref, ViewerSwitch } from "@/components/auth/member-gate";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  match: (p: string) => boolean;
  /** Shown to signed-out visitors too. */
  public?: boolean;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, unreadMessages, unreadNotifications } = useDemo();
  const [composing, setComposing] = useState(false);
  const loginHref = useLoginHref();
  const myProfile = `/profile/${state.me.username}`;

  const nav: NavItem[] = [
    { href: "/feed", label: "Home", icon: Home, match: (p) => p === "/feed", public: true },
    { href: "/discover", label: "Discover", icon: Compass, match: (p) => p.startsWith("/discover"), public: true },
    { href: "/matches", label: "Matches", icon: Heart, match: (p) => p.startsWith("/matches") },
    { href: "/messages", label: "Messages", icon: MessageCircle, badge: unreadMessages, match: (p) => p.startsWith("/messages") },
    { href: "/notifications", label: "Notifications", icon: Bell, badge: unreadNotifications, match: (p) => p.startsWith("/notifications") },
    { href: myProfile, label: "Profile", icon: User, match: (p) => p === myProfile || p === "/profile/me" },
    { href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") },
  ];

  // A conversation takes over the full viewport on mobile, like native messengers.
  const immersive = /^\/messages\/.+/.test(pathname);
  const mobileTabs = [nav[0], nav[1], nav[2], nav[3], nav[5]];
  const publicNav = nav.filter((item) => item.public);
  const loginItem: NavItem = { href: loginHref, label: "Log in", icon: LogIn, match: (p) => p === "/login" };

  return (
    <div className="min-h-dvh md:flex">
      {/* Desktop / tablet sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-line px-3 py-5 md:flex lg:w-64 lg:px-4">
        <div className="mb-8 px-1.5">
          <Logo href="/feed" className="hidden lg:inline-flex" />
          <Link href="/feed" aria-label="Vernant home" className="lg:hidden">
            <LogoMark className="size-8" />
          </Link>
        </div>
        {/* Guests see the browse pages plus log in / join; `null` while the session check streams in. */}
        <ViewerSwitch>
          {(signedIn) => (
            <>
              <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
                {(signedIn ? nav : publicNav).map((item) => (
                  <SideLink key={item.href} item={item} active={item.match(pathname)} />
                ))}
                {signedIn === false && <SideLink item={loginItem} active={false} />}
                {signedIn && (
                  <button
                    onClick={() => setComposing(true)}
                    className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
                  >
                    <Plus className="size-5" />
                    <span className="hidden lg:inline">New post</span>
                  </button>
                )}
                {signedIn === false && (
                  <Link
                    href="/register"
                    aria-label="Join Vernant"
                    className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
                  >
                    <UserPlus className="size-5" />
                    <span className="hidden lg:inline">Join Vernant</span>
                  </Link>
                )}
              </nav>
              <ThemeToggle withLabel className="mb-2 w-full justify-center px-3 lg:justify-start [&>span]:hidden lg:[&>span]:inline" />
              {signedIn && (
                <Link href={myProfile} className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-surface-2">
                  <Avatar name={state.me.name} seed={state.me.photo} size="sm" online />
                  <span className="hidden min-w-0 lg:block">
                    <span className="block truncate text-sm font-medium">{state.me.name}</span>
                    <span className="block truncate text-xs text-subtle">@{state.me.username}</span>
                  </span>
                </Link>
              )}
            </>
          )}
        </ViewerSwitch>
        <DemoNotice className="mt-4 hidden px-1.5 leading-relaxed lg:block" />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        {!immersive && (
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur-xl md:hidden">
            <Logo href="/feed" />
            <div className="flex items-center gap-1">
              <ThemeToggle className="w-10 justify-center px-0" />
              <ViewerSwitch>
                {(signedIn) =>
                  signedIn ? (
                    <>
                      <Link href="/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-xl text-muted">
                        <Bell className="size-[22px]" />
                        <CountBadge count={unreadNotifications} className="absolute top-1 right-0.5" />
                      </Link>
                      <Link href="/settings" aria-label="Settings" className="grid size-10 place-items-center rounded-xl text-muted">
                        <Settings className="size-[22px]" />
                      </Link>
                    </>
                  ) : (
                    signedIn === false && (
                      <ButtonLink href="/register" size="sm" className="ml-1">
                        Join
                      </ButtonLink>
                    )
                  )
                }
              </ViewerSwitch>
            </div>
          </header>
        )}

        <main className={cn("flex-1", !immersive && "pb-20 md:pb-0")}>{children}</main>

        {/* Mobile tab bar */}
        {!immersive && (
          <ViewerSwitch>
            {(signedIn) => (
              <nav
                aria-label="Main"
                className={cn(
                  "fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden",
                  signedIn ? "grid-cols-6" : "grid-cols-3",
                )}
              >
                {signedIn ? (
                  <>
                    {mobileTabs.slice(0, 2).map((item) => (
                      <TabLink key={item.href} item={item} active={item.match(pathname)} />
                    ))}
                    <button onClick={() => setComposing(true)} aria-label="New post" className="grid h-16 place-items-center">
                      <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-fg">
                        <Plus className="size-5" />
                      </span>
                    </button>
                    {mobileTabs.slice(2).map((item) => (
                      <TabLink key={item.href} item={item} active={item.match(pathname)} />
                    ))}
                  </>
                ) : (
                  <>
                    {publicNav.map((item) => (
                      <TabLink key={item.href} item={item} active={item.match(pathname)} />
                    ))}
                    {signedIn === false && <TabLink item={loginItem} active={false} />}
                  </>
                )}
              </nav>
            )}
          </ViewerSwitch>
        )}
      </div>

      <ComposerDialog open={composing} onClose={() => setComposing(false)} />
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.label}
      className={cn(
        "group relative flex h-11 items-center gap-3.5 rounded-xl px-3 text-[15px] transition-colors",
        active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2/60 hover:text-fg",
      )}
    >
      <item.icon className={cn("size-[22px] shrink-0", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
      <span className="hidden lg:inline">{item.label}</span>
      {!!item.badge && <CountBadge count={item.badge} className="absolute top-1.5 left-7 lg:static lg:ml-auto" />}
    </Link>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn("relative grid h-16 place-items-center", active ? "text-fg" : "text-subtle")}
    >
      <item.icon className={cn("size-6", active && "text-accent")} strokeWidth={active ? 2.2 : 1.8} />
      {!!item.badge && <CountBadge count={item.badge} className="absolute top-3 left-1/2 ml-1.5" />}
    </Link>
  );
}
