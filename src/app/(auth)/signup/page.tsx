import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./SignupForm";
import { eyebrowStyles } from "@/components/ui/styles";

export const metadata: Metadata = {
  title: "Create account — Forge",
  description:
    "Start a time-stamped record of demonstrated skill. Short daily practice, verified consistency, no resume required.",
};

export default function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-6 py-14 sm:py-16">
      <p className={eyebrowStyles}>Create account</p>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
        Start the record you wish you had.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        One short challenge a day. Every attempt is time-stamped, scored and yours to keep.
      </p>

      <SignupForm />

      <p className="mt-8 text-sm text-muted-foreground">
        Already practising?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
