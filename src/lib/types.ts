/**
 * Domain types shared by the UI. These mirror the planned Supabase schema
 * (supabase/migrations/0001_initial_schema.sql) so demo data can later be
 * swapped for real queries without reshaping components.
 */

export const IDENTITIES = [
  "Bear",
  "Chub",
  "Cub",
  "Polar bear",
  "Muscle bear",
  "Otter",
  "Chaser",
  "Admirer",
  "Trans",
  "Ally",
] as const;
export type Identity = (typeof IDENTITIES)[number];

export const INTENTS = ["Dating", "Relationship", "Friends", "Community", "Chat"] as const;
export type Intent = (typeof INTENTS)[number];

export type Visibility = "everyone" | "members" | "matches";

export interface User {
  id: string;
  username: string;
  name: string;
  age: number;
  pronouns: string;
  city: string;
  distanceKm: number;
  online: boolean;
  lastActive: string;
  verified: boolean;
  isNew?: boolean;
  bio: string;
  identities: Identity[];
  lookingFor: Intent[];
  interests: string[];
  height?: string;
  /** Seed for demo imagery. Real profiles will reference a storage object path. */
  photo: string;
  gallery: string[];
  privateAlbumCount: number;
  stats: { followers: number; following: number; posts: number };
  joined: string;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  time: string;
}

export interface Post {
  id: string;
  authorId: string;
  images: string[];
  caption: string;
  location?: string;
  time: string;
  likes: number;
  comments: Comment[];
  audience: "public" | "followers";
}

export interface StoryFrame {
  id: string;
  image: string;
  caption?: string;
  time: string;
}

export interface Story {
  id: string;
  userId: string;
  frames: StoryFrame[];
}

export interface Message {
  id: string;
  from: "me" | "them";
  text?: string;
  image?: string;
  time: string;
  day: string;
}

export interface Conversation {
  id: string;
  userId: string;
  messages: Message[];
  unread: number;
  pinned?: boolean;
  muted?: boolean;
}

export type NotificationType = "like" | "comment" | "follow" | "match" | "message" | "mention" | "safety" | "community";

export interface AppNotification {
  id: string;
  type: NotificationType;
  actorId?: string;
  text: string;
  time: string;
  group: "Today" | "This week" | "Earlier";
  read: boolean;
  href: string;
  image?: string;
}

export interface Settings {
  visibility: Visibility;
  showDistance: boolean;
  showOnline: boolean;
  incognito: boolean;
  privateAlbumAccess: "approved" | "matches";
  allowMessagesFrom: Visibility;
  notifyMatches: boolean;
  notifyMessages: boolean;
  notifyLikes: boolean;
  notifyCommunity: boolean;
  blurIncomingMedia: boolean;
}

export type ReportReason =
  | "Fake or impersonation"
  | "Appears under 18"
  | "Harassment or hate"
  | "Spam or scam"
  | "Unsolicited explicit content"
  | "Something else";

export interface Report {
  targetId: string;
  reason: ReportReason;
  details: string;
}
