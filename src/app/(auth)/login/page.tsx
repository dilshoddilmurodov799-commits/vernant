import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="font-display text-4xl tracking-tight">Welcome back</h1>
      <p className="mt-2 mb-8 text-sm text-muted">Log in to see who&apos;s been by.</p>
      <Suspense fallback={<AuthForm mode="login" />}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <AuthForm mode="login" next={typeof next === "string" ? next : ""} />;
}
