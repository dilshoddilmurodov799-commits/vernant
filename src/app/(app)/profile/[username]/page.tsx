import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";
import { DEMO_ME, DEMO_USERS } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Profile" };

export function generateStaticParams() {
  return [DEMO_ME, ...DEMO_USERS].map((u) => ({ username: u.username }));
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <ProfileView key={username} username={decodeURIComponent(username)} />;
}
