type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary",
  secondary:
    "border border-card-border bg-card text-foreground hover:border-foreground/25 hover:bg-foreground/[0.02]",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]",
  danger: "bg-destructive text-white hover:bg-destructive/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-[15px]",
};

/** Shared button styling so links and buttons cannot drift apart. */
export function buttonStyles(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = ""
): string {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(" ");
}

export const fieldStyles =
  "w-full rounded border border-card-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60";

export const labelStyles = "block text-[13px] font-medium text-foreground";

export const hintStyles = "mt-1.5 text-xs leading-relaxed text-muted";

export const eyebrowStyles =
  "font-mono text-[11px] uppercase tracking-[0.14em] text-muted";
