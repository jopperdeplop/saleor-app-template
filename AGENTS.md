# Agentic Onboarding: Saleor App Template

> **Goal**: This repository is a template for building Saleor Apps using Next.js and Trigger.dev (v4).

## 1. Project Identity

- **Type**: Template / Starter Kit
- **Stack**:
  - **Framework**: Next.js 15 (App Router)
  - **Background Tasks**: Trigger.dev v4 (Serverless)
  - **ORM**: Drizzle ORM
  - **Database**: Postgres (Neon / Vercel Postgres)
  - **Validation**: Zod
  - **Styling**: Tailwind CSS
- **Deployment**:
  - **App**: Vercel
  - **Tasks**: Trigger.dev Cloud
- **Automated Guardrails**: `eslint-plugin-boundaries` (pending) / Strict SDK v4 Enforcement.

## 2. Agent Protocol

> **Methodology**: Follow this cycle for every task.

1. **Explore**: Read `AGENTS.md` and `agent-docs/tech/trigger-dev-v4.md`.
2. **Verify**: Run `pnpm lint` to check for v3 SDK usage.

## 3. Critical Rules

> [!IMPORTANT]
> These rules are non-negotiable.

- **Trigger.dev v4 Only**: NEVER use `client.defineJob` (v2/v3). ALWAYS use `@trigger.dev/sdk` (v4) with `task`, `schemaTask`, or `schedules.task`.
- **Database Access**: Use Drizzle ORM. Do not write raw SQL strings unless absolutely necessary.
- **Environment**: Use `.env` for local secrets. Never commit secrets.
- **Package Manager**: Use `pnpm`.
- **Automated Guardrails**:
  - **Trigger.dev**: Lint rules BLOCK importing `@trigger.dev/sdk/v3`. Use v4.
- **Multi-Channel Automation**:
  - **Tasks**: `setup-eurozone-channels`, `translate-product`, `sync-brand-channels`, `auto-assign-product-channels`.
  - **Shared Database**: This repo shares its Vercel Postgres database with `SaleorPortal`. Schema changes MUST be synced in both places to prevent data loss.
- **Documentation Maintenance**: If you add new major tech, change the build process, or discover a repeated "gotcha", YOU MUST update this file (`AGENTS.md`) to reflect the new state. Keep it living.

## 3. Map of the Territory

- `src/app`: Next.js App Router (Frontend & API Routes).
- `src/trigger`: Trigger.dev tasks (Background jobs).
- `src/db`: Drizzle schema and migrations.
- `trigger.config.ts`: Configuration for Trigger.dev build/runtime.

## 4. Golden Paths

### Bootstrap & Install

```bash
pnpm install
cp .env.example .env
# Fill in DATABASE_URL and TRIGGER_SECRET_KEY
```

### Database Migration

```bash
# Generate migrations
pnpm drizzle-kit generate

# Apply migrations
pnpm drizzle-kit migrate
```

### Development

```bash
# Start Next.js + Trigger.dev dev process
pnpm dev
```

### Testing

```bash
pnpm test
```

## 5. Technical Context

- **Trigger.dev Documentation**: See [agent-docs/tech/trigger-dev-v4.md](agent-docs/tech/trigger-dev-v4.md) for detailed task examples.

## 6. Ecosystem Links

- **Monorepo Reference**: `c:/Users/jopbr/Documents/GitHub/apps/AGENTS.md` (See how production apps are built).
