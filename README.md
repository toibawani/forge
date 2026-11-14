# Forge

**Daily skill proof.**

Short practice challenges that create a living, verifiable record of what you can actually do.

Recruiters get a signal they can trust.  
People who practice get a habit that improves their craft.

---

## The problem

AI-polished resumes and staged portfolios have broken traditional hiring signals.  
One-off skill tests are easy to game.  
Application volume is high, but real competence is hard to see.

Forge builds continuous evidence through short, daily demonstrations of skill.  
These signals are hard to fake and easy to compare over time.

## Who it is for

**Practitioners**  
People who want to stay sharp and have proof of real ability — not just a resume.

**Recruiters & hiring managers**  
Teams tired of sorting through perfect-looking but empty applications.  
They can search for consistent, demonstrated skill instead of claims.

## How it works

1. **Practice daily** — 5–15 minute challenges matched to your field (coding, design, analysis, writing, sales scenarios, and more).
2. **Build a record** — Every attempt is time-stamped and scored. Streaks, consistency, and improvement become visible.
3. **Get discovered** — Recruiters can find people by demonstrated skill and recent activity, not just by keywords on a profile.

## Product principles

- Real practice over polished claims
- Consistency over one-time performance
- Signals that are hard to fake
- Clean, serious interface that matches the purpose of the product

## Tech stack

| Layer          | Choice                                      |
|----------------|---------------------------------------------|
| Framework      | Next.js (App Router) + TypeScript           |
| Styling        | Tailwind CSS with custom design tokens      |
| Database & Auth| Supabase (Postgres + Auth + Row Level Security) |
| Validation     | Zod                                         |
| Fonts          | DM Sans + JetBrains Mono                    |

## Design system

Intentional and restrained:

- Warm off-white base (`#f7f6f3`)
- Deep slate primary (`#1c3d5a`)
- Terracotta accent
- High contrast for accessibility
- No purple gradients, glassmorphism, glowing borders, or generic AI visual tropes
- No Inter / Geist / Space Grotesk defaults

## Security stance

Built with production-grade practices from the start:

- Secrets never exposed in client bundles
- Environment variables properly separated (public vs server-only)
- All protected data behind server-side authorization + planned Row Level Security
- Input validation on the server
- No reliance on client-side route guards alone
- Privacy Policy and Terms of Service pages included

Full production-readiness audit checklist is available and will be applied as features are added.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values (Supabase keys when ready)

# 3. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

You will see the landing page. Auth and challenges are the next layers to be built.

## Current status (November 2026)

**Done**
- Landing page with clear product positioning
- Custom design system (colors, typography, layout)
- Privacy Policy and Terms of Service pages
- Project structure, `.gitignore`, `.env.example`
- Git repository with conventional commits
- Supabase client configuration (server and browser)
- Enhanced database schema with role-based access control, recruiter pipelines, audit logging, profile views
- Authentication API endpoints (signup, login, logout) with rate limiting
- Profile API with authorization checks and streak data
- Challenges API with validation, authorization, and idempotency
- Recruiter search API with filtering by skills, difficulty, streak, score
- Talent pipeline management API (create pipelines, add candidates, stage tracking)
- Audit logging system for all recruiter actions
- Role-based access control (practitioner, recruiter, admin)
- Error boundary and skeleton loader components
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Zod validation schemas for all API inputs
- Structured logging infrastructure
- Accessibility improvements (ARIA labels, semantic HTML)
- Practitioner and recruiter dashboard pages

**Next (priority order)**
1. Set up Supabase project and run enhanced schema.sql
2. Frontend authentication pages (login, signup with role selection)
3. Connect dashboard to real data
4. Challenge display and submission UI
5. Candidate comparison view
6. Activity heatmap visualization
7. Skill timeline visualization
8. Data export functionality
9. Additional security hardening and testing

## Project structure

```
forge/
├── src/
│   ├── app/
│   │   ├── page.tsx          # Landing page
│   │   ├── layout.tsx        # Root layout + fonts
│   │   ├── globals.css       # Design tokens
│   │   ├── privacy/          # Privacy Policy
│   │   ├── terms/            # Terms of Service
│   │   ├── api/              # API routes
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── challenges/   # Challenge endpoints
│   │   │   └── profile/      # Profile endpoints
│   │   └── middleware.ts     # Auth middleware
│   ├── components/           # Shared UI components
│   │   ├── ErrorBoundary.tsx
│   │   ├── Skeleton.tsx
│   │   └── ErrorState.tsx
│   └── lib/                  # Utilities and clients
│       ├── supabase/         # Supabase clients
│       ├── validations.ts    # Zod schemas
│       ├── rate-limit.ts     # Rate limiting
│       └── logger.ts         # Logging
├── supabase/
│   └── schema.sql            # Database schema with RLS
├── public/
├── .env.example
├── .gitignore
├── next.config.ts
├── package.json
└── README.md
```

## License

Private. All rights reserved for now.
