# End-to-end tests

```bash
# once
npx playwright install chromium

# needs a database and a seeded catalogue
npm run e2e
```

`playwright.config.ts` starts `npm run build && npm run start` unless
`E2E_BASE_URL` is set, so the suite runs against production output rather than
the dev overlay.

Two things must be true for a green run:

1. `./scripts/db-apply.sh --seed` has been applied to the project in
   `.env.local`.
2. Email confirmation is disabled in Supabase Auth. With it on, signup lands on
   `/login?checkEmail` and the first test skips itself with that message rather
   than timing out.

The suite runs in Chromium and in a Pixel 7 viewport. The mobile project only
asserts layout-level things (no horizontal scroll, controls reachable) because
the point is that the runner is usable, not that it looks identical.
