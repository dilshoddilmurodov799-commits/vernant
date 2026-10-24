import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/states";

/** Desktop placeholder for the right pane; on mobile the list is shown instead. */
export default function MessagesPage() {
  return (
    <div className="grid flex-1 place-items-center">
      <EmptyState icon={MessagesSquare} title="Your messages" description="Pick a conversation to keep talking, or say hi to a new match." />
    </div>
  );
}
