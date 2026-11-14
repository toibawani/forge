# Forge Project - Master Prompt Guidelines

## Project Overview
Forge is a daily skill practice platform that creates verifiable records of demonstrated ability. It's a Next.js application with Supabase (planned), designed for practitioners and recruiters.

## Design Philosophy & Visual Identity

### Core Design Principles
- Create a distinctive, intentional visual identity that reflects the product's serious, purposeful nature
- Build custom, clean, polished interfaces with clear point of view
- Use restrained and intentional palette with consistent spacing and strong typographic hierarchy
- Every design decision must have a reason - avoid generic AI-generated patterns

### Design System (Established)
- Warm off-white base: `#f7f6f3`
- Deep slate primary: `#1c3d5a`
- Terracotta accent
- High contrast for accessibility (WCAG AA)
- Fonts: DM Sans + JetBrains Mono

### Strict Design Don'ts
**Gradients and Visual Effects:**
- DO NOT use purple-to-blue, cyan-to-purple, or rainbow gradients
- DO NOT use gradient fills on hero titles or headlines
- DO NOT use neon colors or generic pastel palettes
- DO NOT use purple-and-black color combination
- DO NOT use radial glow orbs or dot-grid backgrounds
- DO NOT use liquid glass effects or glassmorphism
- DO NOT use glowing colored borders around cards
- DO NOT rely on drop shadows for depth - prefer borders, spacing, tonal contrast
- DO NOT use pure white (#FFFFFF) backgrounds - use off-white or tinted neutrals

**Typography:**
- DO NOT use Inter as default font
- DO NOT default to Space Grotesk + Instrument Serif pairing
- DO NOT use Geist or Space Grotesk as default typefaces
- DO NOT use italicized serif fonts for random accent words
- DO NOT use em dashes (—) excessively
- DO NOT use "It's not X, it's Y" phrasing pattern
- DO NOT place emojis in headings or feature titles
- DO NOT use emojis anywhere in UI or application copy

**Layout and Components:**
- DO NOT default to standard three-icon feature box layout
- DO NOT default to three feature cards in a row
- DO NOT use bento grids
- DO NOT use generic, repetitive card layouts
- DO NOT automatically use three-tier pricing tables
- DO NOT put pill badges directly above main headlines
- DO NOT use colored left-border stripes on cards
- DO NOT use checkmark bullet lists as default pattern
- DO NOT use fake terminal-window mockups
- DO NOT use uniformly soft, overly rounded corners
- DO NOT use glowing borders or decorative card effects
- DO NOT use default, untouched shadcn/ui or Tailwind components
- DO NOT allow inconsistent spacing, margins, or padding

**Icons and Assets:**
- DO NOT rely exclusively on Lucide icons
- DO NOT default to generic sparkle or AI-magic icons
- DO NOT use random decorative icons

**Animations and Interactions:**
- DO NOT use generic fade-in-on-scroll animations for every section
- DO NOT add cursor-following spotlight or beam effects
- DO NOT use simple opacity fade-outs for button hover states
- DO NOT use animated arrows gratuitously
- DO NOT add unnecessary hover animations
- Keep motion minimal, purposeful, and functional

**Copywriting:**
- DO NOT use generic AI marketing buzzwords: "Revolutionize your workflow", "Supercharge your productivity", "Seamless integration"
- DO NOT write artificial, exaggerated, or dramatic marketing copy
- DO NOT use fake testimonials
- DO NOT invent logos
- DO NOT fabricate statistics, numbers, or claims
- Use real content or leave unsupported information out

### Design Requirements
- Use distinct, intentional color palette tailored to brand context
- Prefer solid colors, subtle noise textures, or rich monochromatic shades over multicolor gradients
- Use considered off-white and tinted neutral backgrounds
- Maintain high contrast and readability (WCAG AA in light and dark modes)
- Ensure dark mode is not washed out or difficult to read
- Avoid low-contrast dark themes (e.g., #09090b with gray-400 text)
- Use color consistently across entire application
- Select deliberate font combinations suited to product domain
- Maintain clear typographic scale and strong visual hierarchy
- Create custom layout structures beyond standard templates
- Customize every component's hover, focus, active, disabled, and loading states
- Use crisp border changes, appropriate transforms, tactile button feedback
- Give components consistent spacing and alignment
- Ensure design works across different screen sizes
- Write concise, direct, human-centric copy
- Clearly communicate functional value proposition

### Required Elements
- Real, working product demos or realistic screenshots (no abstract placeholders)
- Skeleton loaders for loading states
- Terms of Service page (linked in footer)
- Privacy Policy page (linked in footer)
- Responsive layouts
- Accessible interaction states
- Clear error, empty, success, and loading states

## Backend Architecture & Security

### Critical Security Don'ts
**API Keys and Secrets:**
- DO NOT hardcode secret keys, service-role tokens, or private credentials in source files
- DO NOT expose server-side environment variables to frontend
- DO NOT prefix master database keys or private API keys with frontend-exposed prefixes (VITE_*, NEXT_PUBLIC_*, REACT_APP_*)
- DO NOT expose privileged API credentials in browser or mobile bundles
- DO NOT commit secrets to Git

**Database and Data Access:**
- DO NOT generate database schemas without Row Level Security (RLS) or granular authorization
- DO NOT leave database endpoints publicly accessible to unauthorized users
- DO NOT rely solely on client-side state or frontend route guards to protect backend data
- DO NOT assume hiding a button or page protects its underlying API or database resources

**Authentication and Authorization:**
- DO NOT write API endpoints or server actions that skip authentication and authorization checks
- DO NOT ignore authenticated-user sessions or tenant boundaries
- DO NOT introduce IDOR vulnerabilities
- DO NOT implement custom password hashing or cryptographic algorithms when established libraries are available

**Dependencies and Input Handling:**
- DO NOT recommend obscure, unverified, outdated, or poorly maintained third-party packages
- DO NOT render raw, unsanitized user input directly into DOM
- DO NOT concatenate raw strings into database queries
- DO NOT trust frontend validation as replacement for backend validation

### Mandatory Security Requirements
**Environment and Secrets Management:**
- Store sensitive credentials in isolated backend .env file or secrets manager
- Ensure public frontend environment variables contain ONLY public keys
- Add .env and sensitive files to .gitignore
- Provide .env.example with placeholders only
- Ensure secrets never appear in frontend bundles, logs, reports, or error messages

**Database Access Control:**
- Enforce Row Level Security on EVERY table containing user-specific or private data
- Users must only access records they are authorized to access
- For user-owned records, enforce ownership using appropriate relationship (e.g., auth.uid() == user_id)
- Validate authorization explicitly at server-side API, service, or controller layer before database operations
- Configure granular permissions for reading, inserting, updating, and deleting records
- Prevent users from changing ownership fields without authorization
- Review database views, RPC functions, storage policies, and grants

**Authentication and Authorization:**
- Verify authenticated sessions on every protected API endpoint
- Enforce tenant boundaries and resource ownership
- Implement authorization checks independently of frontend visibility
- Use established authentication providers or maintained libraries
- Use established password hashing mechanisms
- Protect against IDOR vulnerabilities

**Input Validation and Sanitization:**
- Enforce strict schema validation on all incoming API requests using Zod, Joi, or Pydantic
- Validate data types, lengths, formats, and permitted ranges
- Sanitize untrusted data before rendering
- Use parameterized database queries or safe ORM methods
- Prevent XSS and SQL injection

**Error Handling and Logging:**
- Return sanitized, generic, user-friendly error messages to clients
- Log detailed debugging information securely on server
- Never expose: database stack traces, internal file paths, database schema details, private credentials, internal implementation details
- Use consistent error-response structures

**Security Headers and CORS:**
- Configure strict Cross-Origin Resource Sharing policies
- Restrict request origins to trusted domains
- Never use wildcard origins with credentials
- Configure appropriate security headers: Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

## Git Standards & Version Control

### Critical Git Don'ts
**Commit Messages:**
- DO NOT write overly dramatic or flowery commit messages
- DO NOT use unnecessarily elaborate descriptions
- DO NOT write vague catch-all messages: "updates", "fixed bug", "added features and fixed UI issues"
- DO NOT summarize unrelated multi-file changes into one generic commit
- DO NOT use emoji prefixes in commit messages

**Repository Hygiene:**
- DO NOT recommend committing directly to main for major features
- DO NOT stage or commit build artifacts, dependencies, or sensitive files
- NEVER commit: node_modules/, .env, .DS_Store, build output folders, private credentials, unnecessary generated files
- DO NOT create massive commits containing thousands of unrelated changes

### Mandatory Git Requirements
**Conventional Commits:**
Follow format: `<type>(<scope>): <short imperative description>`

Types: feat, fix, refactor, style, docs, chore, test, perf

Requirements:
- Keep description concise (50-72 characters)
- Use lowercase descriptions
- Use imperative mood
- Describe what commit does, not what was done
- Keep each commit focused on one logical change

Examples:
- feat(auth): add JWT validation middleware
- fix(ui): resolve overflow bug on mobile navigation
- refactor(db): optimize user query response time
- docs(readme): add local setup and environment instructions

**Atomic Commits:**
- Break changes into small, logical, self-contained units
- Each commit should address one feature, fix, refactor, or documentation change
- Each commit should be independently understandable, reviewable, and reversible
- Avoid combining unrelated work

**Branching and Pull Requests:**
Use clean branch naming: feature/<feature-name>, bugfix/<issue-name>, refactor/<module-name>

For major features, use separate branch rather than committing directly to main.

Pull requests must contain:
1. Summary - Two to three bullet points explaining what changed and why
2. Key Changes - Technical breakdown of modified components, files, and endpoints
3. How to Test - Short, practical step-by-step verification instructions

**Repository and README Quality:**
- Generate comprehensive .gitignore appropriate for technology stack
- Keep README concise, professional, and human-focused
- Include: clear one-to-two-sentence value proposition, technology stack information, quick-start local setup commands, relevant environment configuration instructions
- Never invent functionality or claim features exist when not implemented

## Production-Readiness Audit Checklist

### Phase 1: Security
**Secrets and Configuration:**
- Find hardcoded API keys, tokens, credentials (OpenAI, Anthropic, Stripe, Supabase service-role, etc.)
- Check frontend JavaScript/HTML, mobile code, config files, Git history, logs
- Check frontend-exposed environment variable prefixes (VITE_*, NEXT_PUBLIC_*) for private values
- Move private credentials to server-side environment variables or secrets manager
- Add .env to .gitignore
- Provide .env.example with placeholders only

**Authentication and Sessions:**
- Verify every protected route and API endpoint enforces authentication server-side
- Ensure unauthenticated users cannot access protected resources
- Verify passwords are hashed (bcrypt, Argon2, scrypt) with per-user salts
- Ensure secure session ID generation, expiration, invalidation on logout
- Protect against session fixation
- Use appropriately short-lived access tokens with rotating refresh tokens
- Verify authentication cookies use HttpOnly, Secure, SameSite
- Rate-limit login, signup, OTP, password-reset endpoints
- Use single-use, short-expiration, high-entropy tokens for password reset flows

**Authorization and Data Access:**
- Every read/write operation must check authenticated user may access specific resource
- Perform authorization checks server-side
- Give services, database roles, tokens only minimum permissions required
- Centralize role and permission checks
- Enforce ownership checks on GET, POST, PUT, PATCH, DELETE, exports, downloads, nested resources
- Return appropriate 403 or 404 responses without leaking record details
- Enable RLS on every table containing user or private data
- Enforce ownership through auth.uid() and appropriate ownership column
- Prevent unauthorized ownership reassignment

**Injection and Input Attacks:**
- Validate every incoming input on server (type, length, format, range)
- Use schema validation libraries (Zod, Pydantic, Joi)
- Never trust client-side validation as security boundary
- Use parameterized queries or safe ORM methods
- Escape and encode output to prevent XSS
- Sanitize rich-text content
- Validate redirect destinations against allowlist
- Validate file types using content, not just extensions
- Enforce file size limits, randomize filenames, store outside public web root

**Transport and Browser Protections:**
- Force HTTPS, enable HSTS, prevent mixed content
- Configure security headers: Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Add strict CSP, avoid unsafe-inline and unsafe-eval
- Configure frame-ancestors, use X-Frame-Options
- Restrict CORS origins to trusted domains
- Implement per-IP and per-user rate limits

**Data Protection:**
- Confirm database, storage, and backup encryption
- Record security-relevant events (logins, permission changes, data exports, deletions)
- Run dependency security audits (npm audit, pip-audit)
- Upgrade vulnerable dependencies

### Phase 2: Reliability and Data Integrity
- Implement consistent error handling
- Use correct HTTP status codes (200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 503)
- Configure explicit timeouts for outbound HTTP requests, database queries, job execution
- Retry transient failures using exponential backoff with jitter
- Use idempotency keys for payment operations and webhooks
- Use database transactions, row locks, unique constraints for concurrent operations
- Prevent unhandled promise rejections
- Check for memory leaks (unclosed connections, unremoved listeners, unmanaged timers)
- Apply database schema changes through version-controlled migrations
- Index foreign-key columns, WHERE clause columns, JOIN columns, ORDER BY columns

### Phase 3: Performance and Scalability
- Identify slow queries and investigate execution performance
- Implement caching where appropriate
- Optimize bundle sizes and lazy load routes/components
- Implement CDN for static assets

### Phase 4: Observability and Operations
- Set up structured logging
- Configure monitoring and alerting
- Implement health check endpoints
- Set up error tracking (e.g., Sentry)

### Phase 5: Engineering Practices, UX, and Compliance
- Write tests for critical functionality
- Implement type checking (TypeScript strict mode)
- Configure linting and formatting
- Ensure accessibility compliance (WCAG AA)
- Implement responsive design

## Implementation Guidelines

### Before Making Changes
- Inspect existing project structure
- Understand current architecture, framework, dependencies
- Identify existing features and functionality
- Understand how frontend and backend communicate
- Understand authentication and database access
- Identify existing tests and build commands
- Identify existing design conventions

### While Making Changes
- Fix confirmed issues using smallest safe changes
- Preserve existing functionality
- Avoid unnecessary rewrites
- Avoid introducing dependencies without justification
- Check dependency maintenance status before recommending new packages
- Follow project's established architecture unless clear reason to change
- Keep frontend, backend, database responsibilities appropriately separated
- Maintain readable, modular, maintainable code
- Keep security checks on server
- Do not expose private implementation details to client
- Do not make destructive changes without approval

### After Making Changes
- Verify implementation instead of assuming success
- Run appropriate: tests, type checks, lint checks, production builds, dependency audits, security checks, database migration checks, integration checks
- Check: existing features still work, new features work, authentication still works, authorization rules enforced, database access protected, API responses correct, responsive layouts work, loading states work, error states work, interface follows design restrictions, no sensitive information exposed

## Tech Stack (Current)
- Framework: Next.js (App Router) + TypeScript
- Styling: Tailwind CSS with custom design tokens
- Database & Auth: Supabase (Postgres + Auth + RLS) - planned
- Validation: Zod
- Fonts: DM Sans + JetBrains Mono

## Git Configuration
- Username: toibawani
- Email: toibawani14@gmail.com

## Final Operating Instructions
- Think like senior engineer responsible for maintaining real production application
- Prioritize security, correctness, maintainability, and user experience
- Build distinctive interfaces with deliberate visual identity
- Never settle for generic AI-generated layouts
- Do not use prohibited visual patterns, fonts, colors, animations, or copywriting styles
- Treat user data, credentials, database access, and authentication as security-critical
- Never expose private keys, secrets, or sensitive information
- Follow professional Git practices, atomic commits, and Conventional Commits
- Preserve existing functionality and avoid unnecessary rewrites
- Verify every important change through actual tests or appropriate checks
- Be honest about what has and has not been completed
- Ask before destructive operations, paid services, or breaking architectural changes
- Do not fabricate product features, screenshots, testimonials, statistics, test results, or security claims
- Keep codebase clean, organized, documented, and maintainable
