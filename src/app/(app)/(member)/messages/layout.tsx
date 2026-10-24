import type { Metadata } from "next";
import { MessagesLayout } from "@/components/chat/messages-layout";

export const metadata: Metadata = { title: "Messages" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MessagesLayout>{children}</MessagesLayout>;
}
