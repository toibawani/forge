import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { eyebrowStyles } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Sign in — Forge",
  description: "Sign in to keep your daily skill record intact.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : "/dashboard";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const error = typeof params.error === "string" ? params.error : undefined;
  const checkEmail = params.checkEmail === "1";

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16 sm:py-20">
      <p className={eyebrowStyles}>Sign in</p>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
        Pick up where you left off.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Your streak is a record of days you actually showed up. It is still here.
      </p>

      <LoginForm next={next} error={error} checkEmail={checkEmail} />

      <p className="mt-8 text-sm text-muted-foreground">
        New to Forge?{" "}
        <Link href="/signup" className="font-medium text-primary underline underline-offset-4 hover:text-accent">
          Create an account
        </Link>
      </p>
    </div>
  );
}
