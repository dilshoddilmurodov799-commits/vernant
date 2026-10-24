import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="mt-6 aspect-[4/3] rounded-2xl" />
    </div>
  );
}
