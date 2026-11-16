"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { buildPaletteResults, type PaletteChallenge, type PaletteItem } from "@/lib/palette";

/**
 * Keyboard navigation (⌘K / Ctrl+K).
 *
 * The useful speed-up in Forge is moving between the record, practice and
 * settings without hunting for links — nothing here is destructive, so it needs
 * no confirmation step. It is only mounted inside authenticated areas, and it
 * stays out of the way of the practice runner's fixed action bar.
 */

const ITEMS: PaletteItem[] = [
  { href: "/dashboard", label: "Dashboard", hint: "streak, trends, today's session" },
  { href: "/practice", label: "Practice", hint: "pick today's challenge" },
  { href: "/profile", label: "Skill record", hint: "every attempt, in order" },
  { href: "/settings", label: "Settings", hint: "profile, consent, export, deletion" },
  { href: "/dashboard/recruiter", label: "Hiring", hint: "search opted-in records" },
  { href: "/dashboard/review", label: "Review queue", hint: "judge submitted answers" },
];

const ENABLED_PREFIXES = ["/dashboard", "/practice", "/profile", "/settings", "/p/"];
const RUNNER_PATTERN = /^\/practice\/[^/]+$/;

export function CommandPalette() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [challenges, setChallenges] = useState<PaletteChallenge[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const catalogueLoaded = useRef(false);

  const enabled = ENABLED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const hideTrigger = RUNNER_PATTERN.test(pathname);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setActive(0);
        setOpen((current) => !current);
        return;
      }

      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  // The catalogue is public, so it is worth fetching once per session rather
  // than shipping forty challenges in the bundle. A failure leaves navigation
  // intact — the palette degrades quietly instead of breaking.
  useEffect(() => {
    if (!open || catalogueLoaded.current) return;
    catalogueLoaded.current = true;

    fetch("/api/challenges")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        const rows = (payload?.challenges ?? []) as Array<{
          slug: string;
          title: string;
          category: string;
          difficulty: string;
        }>;
        setChallenges(rows);
      })
      .catch(() => {
        // Keep whatever we had; the palette still navigates.
      });
  }, [open]);

  if (!enabled) return null;

  const results = buildPaletteResults(ITEMS, challenges, query);
  const index = results.length === 0 ? 0 : Math.min(active, results.length - 1);

  function move(delta: number) {
    if (results.length === 0) return;
    setActive((current) => (current + delta + results.length) % results.length);
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {hideTrigger ? null : (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setActive(0);
            setOpen(true);
          }}
          className="fixed bottom-6 right-6 z-40 hidden rounded border border-card-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted shadow-sm transition-colors hover:text-foreground sm:block"
          aria-keyshortcuts="Meta+K Control+K"
        >
          ⌘K
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 px-4 pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Jump to"
            className="w-full max-w-md overflow-hidden rounded border border-card-border bg-card shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  move(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  move(-1);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const target = results[index];
                  if (target) go(target.href);
                }
              }}
              placeholder="Jump to…"
              aria-controls="command-results"
              className="w-full border-b border-card-border bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none"
            />

            <ul id="command-results" role="listbox" className="max-h-80 overflow-y-auto py-1">
              {results.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing matches that.
                </li>
              ) : (
                results.map((item, position) => (
                  <li key={item.href} role="option" aria-selected={position === index}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(position)}
                      onClick={() => go(item.href)}
                      className={`flex w-full items-baseline justify-between gap-4 px-4 py-2.5 text-left ${
                        position === index ? "bg-foreground/[0.04]" : ""
                      }`}
                    >
                      <span className="text-sm text-foreground">{item.label}</span>
                      <span className="text-right text-[11px] text-muted">{item.hint}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>

            <div className="border-t border-card-border px-4 py-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                ↑↓ move · ↵ open · esc close
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
