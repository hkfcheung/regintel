# RegIntel - Regulatory Intelligence Platform

> Production-grade regulatory intelligence web application with curated feeds, actionable insights, and human-in-the-loop review workflows.

**Stack:** Next.js 15 · Fastify · PostgreSQL · BullMQ · NextAuth.js · Raindrop MCP

**Status:** MVP Scaffold Complete ✅

---

## 🎯 Core Features

1. **Curated Weekly Feed** - Authoritative sources (FDA guidances, warning letters, meetings) with canonical links
2. **Actionable Summaries** - LLM-generated summaries with "Impact on Day One" and grounded citations
3. **Human-in-the-Loop Review** - Approve/edit/reject workflow with versioned audit logs

---

## 📋 Prerequisites

- **Node.js** 20+ and npm 10+
- **PostgreSQL** 14+ (or managed service like [Neon](https://neon.tech) / [Supabase](https://supabase.com))
- **Redis** 6+ (or [Upstash](https://upstash.com) Redis)
- **Raindrop.io** account with API token (optional for MCP integration)

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
# Copy example env files
cp apps/web/.env.example apps/web/.env.local
cp apps/api/.env.example apps/api/.env
```

Edit the `.env` files with your credentials:

**apps/web/.env.local:**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/regintel"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

**apps/api/.env:**
```env
PORT=3001
DATABASE_URL="postgresql://user:password@localhost:5432/regintel"
REDIS_HOST=localhost
REDIS_PORT=6379
RAINDROP_API_TOKEN=your-raindrop-token  # Optional
```

### 3. Initialize Database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

### 4. Start Development Servers

```bash
# Terminal 1: Start all services (web + api + worker)
npm run dev
```

This will start:
- **Web** (Next.js): http://localhost:3000
- **API** (Fastify): http://localhost:3001
- **Worker** (BullMQ): background process

---

## 📁 Project Structure

```
regintel/
├── apps/
│   ├── web/              # Next.js 15 frontend
│   │   ├── src/app/      # App Router pages
│   │   ├── src/components/
│   │   └── src/lib/      # Auth, actions, utils
│   └── api/              # Fastify backend
│       ├── src/routes/   # HTTP endpoints
│       ├── src/services/ # Business logic (Raindrop, etc.)
│       ├── src/queues/   # BullMQ job handlers
│       └── src/worker.ts # Worker process
├── packages/
│   ├── database/         # Prisma schema + client
│   │   └── prisma/schema.prisma
│   └── shared/           # Shared types, utils, prompts
│       └── src/
├── docs/
│   └── adr/              # Architecture Decision Records
│       └── ADR-0001-initial-tech-stack.md
└── turbo.json            # Monorepo build config
```

---

## 🔑 Authentication Setup

**Quick Start (5 minutes):**

1. **Create GitHub OAuth App**: https://github.com/settings/developers
   - Callback URL: `http://localhost:3000/api/auth/callback/github`

2. **Add credentials to `apps/web/.env.local`**:
   ```env
   AUTH_GITHUB_ID="your_client_id"
   AUTH_GITHUB_SECRET="your_client_secret"
   ```

3. **Start app and sign in**:
   ```bash
   npm run dev
   # Visit http://localhost:3000 → Sign in with GitHub
   ```

4. **Make yourself admin**:
   ```bash
   ./scripts/make-admin.sh your-email@example.com
   ```

**Full Setup Guide**: See [`docs/AUTH_SETUP.md`](docs/AUTH_SETUP.md) for:
- Google OAuth setup
- Production configuration
- Domain restrictions
- Organization-only access

---

## 🔑 Authentication & RBAC

**Roles:**
- `VIEWER` - Read-only access to published digests
- `REVIEWER` - Can approve/reject items in review queue
- `ADMIN` - Full access including source management and audit logs

**Middleware:** Role-based route protection in `apps/web/src/middleware.ts`

**Audit Trail:** All mutations logged to `audit_logs` table via Server Actions

---

## 🔄 Ingest Pipeline

```
1. Fetch     → Crawl whitelisted sources (FDA RSS, manual triggers)
2. De-dup    → Hash content, skip existing items
3. Store     → Save to `source_items` table (status=INTAKE)
4. Raindrop  → Bookmark in "RegIntel / Intake" collection
5. Summarize → LLM generates summary + impact + citations
6. Review    → Human approves/edits in review UI
7. Publish   → Generate weekly digest page + email + Slack
```

**Job Queue:** BullMQ with idempotency via URL-based job IDs

---

## 🛠️ Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all dev servers (web, api, worker) |
| `npm run build` | Build all packages |
| `npm run lint` | Lint all packages |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema changes to DB |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

---

## 🔌 API Endpoints

### Health
- `GET /health` - Server uptime
- `GET /health/ready` - Readiness check (DB, Redis, Raindrop)

### Ingest
- `POST /ingest/trigger` - Queue ingest job for URL
- `GET /ingest/status/:jobId` - Get job status

### Review (TODO)
- `GET /review/items` - List items in review status
- `POST /review/:id/approve` - Approve item
- `POST /review/:id/reject` - Reject item

### Publish (TODO)
- `POST /publish/week` - Publish weekly digest

---

## 🗄️ Database Schema

**Core Tables:**
- `users` - Auth + RBAC (NextAuth.js v5 compatible)
- `source_items` - Ingested content with status tracking
- `analyses` - LLM-generated summaries with version history
- `reviews` - Human review decisions
- `publications` - Weekly digest metadata
- `audit_logs` - Tamper-evident compliance log

**Relations:** See `packages/database/prisma/schema.prisma`

---

## 🔐 Security & Compliance

- **Strict domain allowlist** - Block unexpected sources
- **RBAC** - Role-based access control via NextAuth.js
- **Audit logs** - All mutations logged with actor + diff
- **Rate limiting** - 100 req/min per IP (Fastify)
- **Helmet** - Security headers
- **Secrets** - Environment variables only (never commit)

---

## 🚢 Deployment

**Recommended:**
- **Frontend:** [Vercel](https://vercel.com) (free Hobby tier)
- **Backend + Workers:** [Railway](https://railway.app) ($5-15/mo)
- **Database:** [Neon](https://neon.tech) ($0-19/mo)
- **Redis:** [Upstash](https://upstash.com) ($0-10/mo)

**Cost Estimate:** ~$15-30/month for MVP

**Environment Variables:** Set in deployment platform dashboards

---

## 📚 Architecture Decisions

See `docs/adr/ADR-0001-initial-tech-stack.md` for full rationale on:
- Why Next.js over Nuxt/SvelteKit
- Why Fastify over Express/FastAPI
- Why PostgreSQL over SQLite
- Why BullMQ over Celery
- Why NextAuth over Clerk
- Why Vercel + Railway over single platform

---

## 🧪 Testing (TODO - Phase 2)

- **Unit Tests:** Vitest
- **Integration Tests:** Playwright
- **E2E Tests:** Playwright + test database

---

## 🤝 Contributing

This is an internal project. For bugs or feature requests, see team documentation.

---

## 📄 License

Proprietary - Internal Use Only

---

## 🔗 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Fastify Docs](https://fastify.dev)
- [Prisma Docs](https://www.prisma.io/docs)
- [BullMQ Docs](https://docs.bullmq.io)
- [NextAuth.js Docs](https://authjs.dev)
- [Raindrop API](https://developer.raindrop.io)
