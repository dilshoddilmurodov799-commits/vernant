"use client";

/**
 * DEMO STORE — in-memory client state that makes prototype interactions feel real.
 * It is NOT a backend: nothing is persisted, validated server-side, or shared
 * between users, and a full page reload resets everything. Replace each action
 * with a Supabase mutation (guarded by RLS) when wiring real data.
 */
import { createContext, useContext, useMemo, useReducer } from "react";
import type { AppNotification, Conversation, Post, Report, Settings, User } from "@/lib/types";
import {
  DEFAULT_SETTINGS,
  DEMO_CONVERSATIONS,
  DEMO_FOLLOWING,
  DEMO_LIKES_YOU,
  DEMO_MATCHES,
  DEMO_ME,
  DEMO_MY_POSTS,
  DEMO_NOTIFICATIONS,
  DEMO_POSTS,
  DEMO_STORIES,
  DEMO_USERS,
  DEMO_YOU_LIKED,
} from "./data";

type Flags = Record<string, boolean>;

interface State {
  me: User;
  posts: Post[];
  likedPosts: Flags;
  savedPosts: Flags;
  following: Flags;
  matches: string[];
  likesYou: string[];
  youLiked: string[];
  /** Members passed on in Discover; hidden there until undone. */
  passed: Flags;
  blocked: Flags;
  reports: Report[];
  conversations: Conversation[];
  notifications: AppNotification[];
  seenStories: Flags;
  settings: Settings;
}

const toFlags = (ids: string[]): Flags => Object.fromEntries(ids.map((id) => [id, true]));

function initialState(): State {
  return {
    me: DEMO_ME,
    posts: [...DEMO_POSTS, ...DEMO_MY_POSTS],
    likedPosts: { p2: true },
    savedPosts: {},
    following: toFlags(DEMO_FOLLOWING),
    matches: DEMO_MATCHES,
    likesYou: DEMO_LIKES_YOU,
    youLiked: DEMO_YOU_LIKED,
    passed: {},
    blocked: {},
    reports: [],
    conversations: DEMO_CONVERSATIONS,
    notifications: DEMO_NOTIFICATIONS,
    seenStories: {},
    settings: DEFAULT_SETTINGS,
  };
}

type Action =
  | { type: "togglePostLike"; postId: string }
  | { type: "togglePostSave"; postId: string }
  | { type: "addComment"; postId: string; text: string }
  | { type: "addPost"; caption: string; image: string; audience: Post["audience"] }
  | { type: "toggleFollow"; userId: string }
  | { type: "likeProfile"; userId: string }
  | { type: "passProfile"; userId: string }
  | { type: "undoPass"; userId: string }
  | { type: "block"; userId: string }
  | { type: "unblock"; userId: string }
  | { type: "report"; report: Report }
  | { type: "sendMessage"; userId: string; text?: string; image?: string }
  | { type: "readConversation"; conversationId: string }
  | { type: "toggleMute"; conversationId: string }
  | { type: "readNotification"; id: string }
  | { type: "readAllNotifications" }
  | { type: "seeStory"; storyId: string }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "updateProfile"; patch: Partial<User> }
  | { type: "reset" };

/** Demo convention: one conversation per member, id derived from the member id. */
export const conversationIdFor = (userId: string) => `c_${userId.replace(/^u_/, "")}`;

let seq = 0;
const nextId = (prefix: string) => `${prefix}_local_${++seq}`;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "togglePostLike": {
      const liked = !state.likedPosts[action.postId];
      return {
        ...state,
        likedPosts: { ...state.likedPosts, [action.postId]: liked },
        posts: state.posts.map((p) => (p.id === action.postId ? { ...p, likes: p.likes + (liked ? 1 : -1) } : p)),
      };
    }
    case "togglePostSave":
      return { ...state, savedPosts: { ...state.savedPosts, [action.postId]: !state.savedPosts[action.postId] } };
    case "addComment":
      return {
        ...state,
        posts: state.posts.map((p) =>
          p.id === action.postId
            ? { ...p, comments: [...p.comments, { id: nextId("c"), authorId: state.me.id, text: action.text, time: "now" }] }
            : p,
        ),
      };
    case "addPost":
      return {
        ...state,
        me: { ...state.me, stats: { ...state.me.stats, posts: state.me.stats.posts + 1 } },
        posts: [
          {
            id: nextId("p"),
            authorId: state.me.id,
            images: [action.image],
            caption: action.caption,
            time: "now",
            likes: 0,
            comments: [],
            audience: action.audience,
          },
          ...state.posts,
        ],
      };
    case "toggleFollow":
      return { ...state, following: { ...state.following, [action.userId]: !state.following[action.userId] } };
    case "likeProfile": {
      if (state.matches.includes(action.userId) || state.youLiked.includes(action.userId)) return state;
      // Mutual like → match. Server-side this must be computed in a trusted function, not the client.
      if (state.likesYou.includes(action.userId)) {
        return {
          ...state,
          likesYou: state.likesYou.filter((id) => id !== action.userId),
          matches: [action.userId, ...state.matches],
          notifications: [
            {
              id: nextId("n"),
              type: "match",
              actorId: action.userId,
              text: "It's a match. Say hello.",
              time: "now",
              group: "Today",
              read: false,
              href: `/profile/${DEMO_USERS.find((u) => u.id === action.userId)?.username ?? ""}`,
            },
            ...state.notifications,
          ],
        };
      }
      return { ...state, youLiked: [action.userId, ...state.youLiked] };
    }
    case "passProfile":
      return {
        ...state,
        passed: { ...state.passed, [action.userId]: true },
        likesYou: state.likesYou.filter((id) => id !== action.userId),
      };
    case "undoPass":
      return { ...state, passed: { ...state.passed, [action.userId]: false } };
    case "block":
      return {
        ...state,
        blocked: { ...state.blocked, [action.userId]: true },
        following: { ...state.following, [action.userId]: false },
        matches: state.matches.filter((id) => id !== action.userId),
        likesYou: state.likesYou.filter((id) => id !== action.userId),
        youLiked: state.youLiked.filter((id) => id !== action.userId),
      };
    case "unblock":
      return { ...state, blocked: { ...state.blocked, [action.userId]: false } };
    case "report":
      return { ...state, reports: [...state.reports, action.report] };
    case "sendMessage": {
      const message = { id: nextId("m"), from: "me" as const, text: action.text, image: action.image, time: "Just now", day: "Today" };
      const existing = state.conversations.find((c) => c.userId === action.userId);
      if (existing) {
        return {
          ...state,
          conversations: [
            { ...existing, messages: [...existing.messages, message] },
            ...state.conversations.filter((c) => c.id !== existing.id),
          ],
        };
      }
      return {
        ...state,
        conversations: [{ id: conversationIdFor(action.userId), userId: action.userId, unread: 0, messages: [message] }, ...state.conversations],
      };
    }
    case "readConversation":
      return {
        ...state,
        conversations: state.conversations.map((c) => (c.id === action.conversationId ? { ...c, unread: 0 } : c)),
      };
    case "toggleMute":
      return {
        ...state,
        conversations: state.conversations.map((c) => (c.id === action.conversationId ? { ...c, muted: !c.muted } : c)),
      };
    case "readNotification":
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
    case "readAllNotifications":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case "seeStory":
      return { ...state, seenStories: { ...state.seenStories, [action.storyId]: true } };
    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case "updateProfile":
      return { ...state, me: { ...state.me, ...action.patch } };
    case "reset":
      return initialState();
  }
}

interface DemoContextValue {
  state: State;
  dispatch: React.Dispatch<Action>;
  /** All members except me and anyone I've blocked. */
  visibleUsers: User[];
  getUser: (id: string) => User | undefined;
  getUserByUsername: (username: string) => User | undefined;
  stories: typeof DEMO_STORIES;
  unreadMessages: number;
  unreadNotifications: number;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const value = useMemo<DemoContextValue>(() => {
    const all = [state.me, ...DEMO_USERS];
    const byId = new Map(all.map((u) => [u.id, u]));
    const visibleUsers = DEMO_USERS.filter((u) => !state.blocked[u.id]);
    return {
      state,
      dispatch,
      visibleUsers,
      getUser: (id) => byId.get(id),
      getUserByUsername: (username) =>
        username === "me" ? state.me : all.find((u) => u.username === username),
      stories: DEMO_STORIES.filter((s) => !state.blocked[s.userId]),
      unreadMessages: state.conversations
        .filter((c) => !state.blocked[c.userId] && !c.muted)
        .reduce((sum, c) => sum + c.unread, 0),
      unreadNotifications: state.notifications.filter((n) => !n.read).length,
    };
  }, [state]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}
