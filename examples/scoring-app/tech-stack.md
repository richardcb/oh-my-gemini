# Technology Stack: I2N Scoring Platform

*This is an example tech stack from a real production project.*

## Frontend
- **Framework:** React 19 (Vite)
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4, Radix UI Primitives, ShadCN UI
- **Data Fetching:** React Query (TanStack Query)
- **Authentication:** Better Auth

## Backend
- **Framework:** Hono (Node.js)
- **Language:** TypeScript (Strict Mode)
- **Database:** PostgreSQL (Neon Serverless for production, Local for development)
- **ORM:** Drizzle ORM
- **Authentication:** Better Auth (Session Management)

## Infrastructure & Deployment
- **Backend:** Cloudflare Workers
- **Frontend:** Cloudflare Pages
- **Database Hosting:** Neon (Serverless Postgres)

## Tooling & Architecture
- **Package Manager:** pnpm (Monorepo structure)
- **Monorepo Shared Types:** `@scoring-app/shared-types`
- **Testing:** Vitest (Unit), Playwright (E2E)
