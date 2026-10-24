import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/settings-view";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  return <SettingsView accountEmail={user.email ?? ""} accountPhone={user.phone ? `+${user.phone.replace(/^\+/, "")}` : ""} />;
}
