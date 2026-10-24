import type { Metadata } from "next";
import { StoryViewer } from "@/components/stories/story-viewer";
import { DEMO_STORIES } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Stories" };

export function generateStaticParams() {
  return DEMO_STORIES.map((s) => ({ id: s.id }));
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StoryViewer key={id} storyId={id} />;
}
