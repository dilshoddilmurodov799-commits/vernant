import { RequireUser } from "@/components/auth/require-user";

/** Member-only pages. The parent (app) layout supplies the Suspense boundary. */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <RequireUser>{children}</RequireUser>;
}
