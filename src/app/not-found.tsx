import Link from "next/link";
import { buttonStyles, eyebrowStyles } from "@/components/ui/styles";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-6 py-16">
      <p className={eyebrowStyles}>404</p>
      <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
        There is nothing at that address.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        A practice record link may have been withdrawn by its owner, a challenge may have been retired, or
        the URL is simply wrong.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className={buttonStyles("primary", "md")}>
          Go to dashboard
        </Link>
        <Link href="/practice" className={buttonStyles("secondary", "md")}>
          Browse challenges
        </Link>
      </div>
    </div>
  );
}
