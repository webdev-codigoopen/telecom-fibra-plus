# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- `provider-mais-fibra` — Brazilian regional ISP landing site (Provider + FIBRA).
  Brand: blue `#0040FF`, dark `#001A6E`, green CTA `#00C040`, Inter font.
  Tokens live in `artifacts/provider-mais-fibra/src/index.css`.
  Plan data in `src/lib/plans.ts`; reusable `PlanCard` in `src/components/PlanCard.tsx`.
  Home flow: Header → Hero (with 4 plan cards) → About → Differentials → ComboPowerTop
  → AppSection → WhatsAppSection → Testimonials → FAQ → Footer.
  WhatsApp: `5577998444757`. Address: Edifício São Matheus, térreo n°49,
  Rua José Rocha — Centro, Barreiras-BA.
