import type { ReactNode } from "react";

type Tone = "info" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  info: "border-primary/20 bg-primary/[0.04] text-foreground",
  success: "border-success/30 bg-success/[0.06] text-foreground",
  warning: "border-accent/30 bg-accent/[0.06] text-foreground",
  error: "border-destructive/30 bg-destructive/[0.06] text-foreground",
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={title ? "mt-1 text-muted-foreground" : "text-muted-foreground"}>{children}</div>
    </div>
  );
}
