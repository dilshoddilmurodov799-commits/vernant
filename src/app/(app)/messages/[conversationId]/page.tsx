import { ConversationView } from "@/components/chat/conversation-view";
import { DEMO_CONVERSATIONS } from "@/lib/demo/data";

export function generateStaticParams() {
  return DEMO_CONVERSATIONS.map((c) => ({ conversationId: c.id }));
}

export default async function ConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  return <ConversationView key={conversationId} conversationId={conversationId} />;
}
