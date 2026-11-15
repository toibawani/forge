import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";
import { getServerUser } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password — Forge",
  description: "Set a new password for your Forge account.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const session = await getServerUser();

  if (!session) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-16 sm:py-20">
        <p className={eyebrowStyles}>Reset password</p>
        <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
          That link is no longer valid.
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Reset links can only be used once, and they expire. Request a fresh one and open it in this
          browser.
        </p>

        <div className="mt-6">
          <Alert tone="warning" title="Nothing has changed">
            Your current password still works. Only a completed reset replaces it.
          </Alert>
        </div>

        <Link href="/forgot-password" className={buttonStyles("primary", "md", "mt-6")}>
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-16 sm:py-20">
      <p className={eyebrowStyles}>Reset password</p>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
        Set a new password.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        You are signed in from the email link. Choosing a new password ends every other session.
      </p>

      <ResetPasswordForm />
    </div>
  );
}
