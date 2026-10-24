import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={<ButtonLink href="/feed">Go home</ButtonLink>}
      />
    </div>
  );
}
