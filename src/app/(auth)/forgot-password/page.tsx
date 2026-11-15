import type { Metadata } from "next";
import Link from "next/link";
import { eyebrowStyles } from "@/components/ui/styles";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — Forge",
  description: "Request a one-time link to set a new password.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-16 sm:py-20">
      <p className={eyebrowStyles}>Reset password</p>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
        Get back into your record.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Enter the address you signed up with. We send one link; opening it signs you in so you can set a
        new password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-8 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-4 hover:text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
