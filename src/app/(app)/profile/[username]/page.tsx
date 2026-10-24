import type { Metadata } from "next";
import { RequireUser } from "@/components/auth/require-user";
import { ProfileView } from "@/components/profile/profile-view";
import { DEMO_ME, DEMO_USERS } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Profile" };

export function generateStaticParams() {
  return [DEMO_ME, ...DEMO_USERS].map((u) => ({ username: u.username }));
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const name = decodeURIComponent(username);
  const view = <ProfileView key={username} username={name} />;
  // Other members' profiles are public; "me" is your own account.
  return name === "me" ? <RequireUser>{view}</RequireUser> : view;
}
