# ADR-0001: Initial Tech Stack for Regulatory Intelligence MVP

**Status:** APPROVED
**Date:** 2025-10-01
**Approved:** 2025-10-01
**Deciders:** Engineering Team
**Research Collection:** RegIntel / Stack Research (pending Raindrop MCP availability)

---

## Context

We are building a production-grade Regulatory Intelligence (RegIntel) web application with three critical requirements:

1. **Curated weekly feed** from authoritative sources (FDA, limited industry press) with canonical links
2. **Actionable summaries + "Impact on Day One"** with grounded citations to exact sections/pages
3. **Human-in-the-loop review & controlled publishing** with versioned audit logs

The system must be:
- **Reliable**: jobs must complete, retries must be idempotent
- **Auditable**: tamper-evident logs for compliance (GDPR, HIPAA, SOX considerations)
- **Low-touch operations**: weekly maintenance budget for a small team
- **Integrated with Raindrop MCP** for source curation and research artifact tracking

---

## Decision Drivers

1. **Fit to Micheline's 3 needs** (curated feed, impact analysis, review workflow)
2. **Reliability/operability** (job guarantees, retries, idempotency)
3. **Security/compliance** (RBAC, audit logs, secret management)
4. **Team familiarity + hiring market** (reduce onboarding friction)
5. **TCO and time-to-value** (MVP within 2-3 weeks)
6. **Vendor lock-in and portability** (avoid platform-specific APIs where possible)

---

## Options Considered

### 1. Frontend Framework

| Criterion | Next.js 15 | Nuxt 3 | SvelteKit 2 |
|-----------|-----------|--------|-------------|
| **Performance** | Good (React 19 RSC) | Good (Nitro engine) | **Excellent** (40-60% smaller bundles, fastest TTI) |
| **Ecosystem** | **Largest** (Vercel, enterprise adoption) | Large (Vue community) | Growing (smaller but mature) |
| **Learning Curve** | Moderate (RSC complexity) | Gentle (intuitive) | Moderate (new paradigm) |
| **Audit UI Fit** | Excellent (Server Actions for mutations) | Good (Nuxt server routes) | Good (form actions) |
| **Deployment** | Vercel-optimized, portable | Nitro (multi-platform) | Adapter-based (flexible) |
| **TypeScript** | Excellent | Good | **Excellent** (built-in) |

**Sources:**
- [SvelteKit vs Next.js 2025](https://prismic.io/blog/sveltekit-vs-nextjs)
- [Next vs Nuxt vs SvelteKit for SaaS](https://supastarter.dev/blog/nextjs-vs-nuxt-vs-sveltekit-for-saas-development)
- [SSR Benchmarks](https://www.pausanchez.com/en/articles/frontend-ssr-frameworks-benchmarked-angular-nuxt-nextjs-and-sveltekit/)

**Recommendation:** **Next.js 15**
- **Why:** Largest talent pool, mature ecosystem for complex forms/review UI, Vercel deployment synergy, Server Actions ideal for audit-logged mutations
- **Trade-off:** Slightly larger bundles vs SvelteKit, but ecosystem maturity outweighs for small team

---

### 2. Backend Framework

| Criterion | Fastify (Node.js) | Express.js (Node.js) | FastAPI (Python) |
|-----------|-------------------|----------------------|------------------|
| **Performance** | **48k req/s**, ~0ms latency | ~30k req/s | ~10k req/s (needs asyncpg + orjson tuning) |
| **TypeScript** | **Built-in**, first-class | v5 has official types | N/A (Python type hints) |
| **Validation** | **JSON Schema native** | Manual (Zod/Yup) | Pydantic (excellent) |
| **Ecosystem** | Growing, modern plugins | **Largest**, legacy-compatible | Large (Python ML/NLP libs) |
| **Job Integration** | BullMQ (same runtime) | BullMQ (same runtime) | Celery (separate worker) |
| **Audit Logging** | Custom middleware | Custom middleware | Custom middleware |

**Sources:**
- [Fastify vs Express Comparison](https://betterstack.com/community/guides/scaling-nodejs/fastify-express/)
- [FastAPI vs Fastify Benchmark](https://www.travisluong.com/fastapi-vs-fastify-vs-spring-boot-vs-gin-benchmark/)
- [FastAPI Performance Discussion](https://github.com/fastapi/fastapi/discussions/7320)

**Recommendation:** **Fastify**
- **Why:** 3x faster than Express, built-in schema validation (audit trails need strict types), TypeScript-native, modern plugin architecture, same runtime as BullMQ (simpler ops)
- **Trade-off:** Smaller community than Express, but growing rapidly; not Python (rules out FastAPI for this Node.js-centric stack)

---

### 3. Database

| Criterion | PostgreSQL | SQLite + Litestream |
|-----------|------------|---------------------|
| **Audit Compliance** | **pgAudit extension** (GDPR/HIPAA/SOX-ready) | Limited native audit (custom triggers) |
| **ACID Guarantees** | Advanced (MVCC, complex transactions) | Basic (journal mode) |
| **Backup/Recovery** | Mature (WAL, PITR) | Litestream (1-15s RPO to S3) |
| **Scale** | Horizontal (read replicas) | Vertical only (<100k hits/day sweet spot) |
| **Ops Complexity** | Moderate (managed services available) | **Low** (single file, Litestream sidecar) |
| **Cost** | $15-50/mo (managed) | **$0-5/mo** (S3 storage only) |

**Sources:**
- [PostgreSQL Audit Logging](https://www.tigerdata.com/learn/what-is-audit-logging-and-how-to-enable-it-in-postgresql)
- [SQLite + Litestream in Production (HN)](https://news.ycombinator.com/item?id=39065201)
- [Litestream vs rqlite vs dqlite](https://gcore.com/learning/comparing-litestream-rqlite-dqlite)

**Recommendation:** **PostgreSQL (managed service: Neon or Supabase)**
- **Why:**
  - **Compliance-first**: pgAudit provides tamper-evident logs out-of-box (critical for regulatory context)
  - **Long-term scale**: weekly feed → annual archive will grow; Postgres handles this trivially
  - **JSONB for metadata**: `tags`, `citations`, `model_meta` as flexible JSONB columns
  - **Managed services** (Neon: $0-19/mo, Supabase: $0-25/mo) reduce ops burden to near-SQLite levels
- **Trade-off:** Slightly higher cost than SQLite+Litestream, but compliance value justifies

---

### 4. Job Queue

| Criterion | BullMQ (Redis) | Celery (RabbitMQ/Redis) | Native Cron + DB |
|-----------|----------------|-------------------------|------------------|
| **Runtime** | Node.js (same as Fastify) | Python (separate worker) | N/A |
| **Guarantees** | **At-least-once**, order preservation | At-least-once, mature | Manual retry logic |
| **Idempotency** | Explicit job IDs (de-dup) | Task IDs (de-dup) | Custom (DB unique constraints) |
| **Retries** | **Built-in** (exponential backoff) | Built-in | Manual |
| **Observability** | Redis-based dashboard | Flower UI | Custom logging |
| **Ops** | Redis required (~$10/mo Upstash) | Broker + worker process | Simplest |

**Sources:**
- [BullMQ Idempotent Jobs](https://docs.bullmq.io/patterns/idempotent-jobs)
- [BullMQ at Scale](https://medium.com/@kaushalsinh73/bullmq-at-scale-queueing-millions-of-jobs-without-breaking-ba4c24ddf104)
- [BullMQ Ultimate Guide](https://www.dragonflydb.io/guides/bullmq)

**Recommendation:** **BullMQ**
- **Why:**
  - **Same runtime** as Fastify (no language boundary, simpler deployment)
  - **Explicit idempotency** via job IDs (critical for "fetch → summarize → publish" pipeline)
  - **Reliable retries** with backoff (handles transient OpenAI API failures)
  - **Observability**: Bull Board for queue inspection
- **Trade-off:** Requires Redis (~$10/mo Upstash free tier covers MVP), but worth it for reliability

---

### 5. Authentication & Authorization

| Criterion | NextAuth/Auth.js | Clerk | Custom JWT |
|-----------|------------------|-------|------------|
| **RBAC** | Manual implementation (session callbacks) | **Built-in** (roles, permissions) | Fully manual |
| **Audit Logs** | Custom (log session events) | **Built-in** (user actions logged) | Custom |
| **MFA** | Manual (OTP libraries) | **Built-in** | Manual |
| **Cost** | **Free** (self-hosted) | $26/mo (up to 10k MAU) | Free (DIY) |
| **Data Control** | **Full** (self-hosted) | Managed (Clerk servers) | Full |
| **Setup Time** | 2-4 hours (DB + providers) | **30 min** (drop-in components) | 8+ hours |

**Sources:**
- [NextAuth vs Clerk 2024 Guide](https://medium.com/@annasaaddev/authentication-in-next-js-the-ultimate-2024-guide-nextauth-vs-clerk-vs-supabase-415ff7d841c5)
- [Auth.js RBAC Guide](https://authjs.dev/guides/role-based-access-control)
- [OpenStatus Clerk → NextAuth Migration](https://www.openstatus.dev/blog/migration-auth-clerk-to-next-auth)

**Recommendation:** **NextAuth/Auth.js v5**
- **Why:**
  - **Cost**: Free (critical for MVP budget)
  - **Control**: All user data stays in our Postgres (compliance-friendly)
  - **Customizable RBAC**: Implement `viewer`, `reviewer`, `admin` roles in DB with session callbacks
  - **Audit trail**: Log auth events (login, role change) to `audit_log` table
  - **Next.js native**: Server Actions integration for protected mutations
- **Trade-off:** Requires custom RBAC + audit implementation (~1 day work), but gives full control vs vendor lock-in

---

### 6. Deployment

| Criterion | Vercel | Railway | Fly.io |
|-----------|--------|---------|--------|
| **Frontend Fit** | **Excellent** (Next.js creator) | Good (full-stack) | Moderate (container-first) |
| **Backend Support** | Limited (serverless functions, 13min limit) | **Excellent** (long-running servers) | **Excellent** (VMs, no timeout) |
| **Database** | External only | Postgres plugin | Fly Postgres (same region) |
| **Job Queue** | External Redis | Redis plugin | Fly Redis (same region) |
| **Pricing** | $20/mo (Pro), 1M req free | **Usage-based**, no free tier | $5/mo, 3 VMs free |
| **Ops Complexity** | **Lowest** (auto-scaling, CDN) | Low (dashboard-first) | Moderate (CLI-first, Dockerfiles) |

**Sources:**
- [Railway vs Vercel](https://docs.railway.com/maturity/compare-to-vercel)
- [Railway vs Fly](https://docs.railway.com/maturity/compare-to-fly)
- [Fly.io vs Vercel](https://getdeploying.com/flyio-vs-vercel)

**Recommendation:** **Hybrid: Vercel (frontend) + Railway (backend + jobs)**
- **Why:**
  - **Vercel** for Next.js: instant deploys, CDN, preview URLs, automatic ISR
  - **Railway** for Fastify API + BullMQ workers: single platform for backend, Postgres, Redis; usage-based pricing aligns with "low-touch weekly" usage pattern
  - **Separation of concerns**: frontend (public, cacheable) vs backend (private, stateful)
- **Trade-off:** Two platforms vs one (Fly.io could host both), but Vercel's Next.js DX is unmatched, and Railway simplifies backend+DB ops

**Cost estimate:**
- Vercel: $0/mo (Hobby tier covers MVP)
- Railway: ~$5-15/mo (Postgres, Redis, API server for light weekly usage)
- **Total: ~$5-15/mo** for MVP

---

### 7. Observability

| Criterion | Sentry | Datadog | Simple Logging (Winston/Pino) |
|-----------|--------|---------|-------------------------------|
| **Error Tracking** | **Best-in-class** (stack traces, breadcrumbs) | Good (APM focus) | Manual (log aggregation) |
| **APM** | Basic (Performance Monitoring add-on) | **Comprehensive** (traces, metrics) | None |
| **Pricing** | $26/mo, **free tier** (5k errors/mo) | $31+/mo per host | **Free** |
| **Alerting** | Built-in (Slack, email) | Advanced (ML anomaly detection) | Manual (log grep) |
| **Small Team Fit** | **Excellent** (low config, immediate value) | Overkill (enterprise-focused) | Sufficient for MVP |

**Sources:**
- [Datadog vs Sentry Comparison](https://betterstack.com/community/comparisons/datadog-vs-sentry/)
- [Datadog vs Sentry 2025 Guide](https://signoz.io/comparisons/datadog-vs-sentry/)
- [Sentry vs Datadog DevOps](https://last9.io/blog/sentry-vs-datadog/)

**Recommendation:** **Sentry (free tier) + Pino structured logging**
- **Why:**
  - **Sentry**: Catch unhandled errors in Next.js + Fastify, track LLM API failures (OpenAI timeouts), free tier covers MVP
  - **Pino**: Structured JSON logs (correlation IDs, user IDs, job IDs) piped to Railway logs (searchable)
  - **Audit trail**: Separate `audit_log` table (not observability tooling) for compliance
- **Trade-off:** No APM (request tracing), but not needed for MVP; can add later if bottlenecks emerge

---

## Decision: Selected Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 15 (React) | Largest ecosystem, Server Actions for mutations, talent pool |
| **Backend API** | Fastify (Node.js) | 3x faster than Express, TypeScript-native, schema validation |
| **Database** | PostgreSQL (Neon) | pgAudit for compliance, JSONB for metadata, managed simplicity |
| **Job Queue** | BullMQ (Upstash Redis) | At-least-once guarantees, idempotency, same runtime as backend |
| **Auth** | NextAuth/Auth.js v5 | Free, self-hosted, customizable RBAC, audit trail control |
| **Deployment** | Vercel (frontend) + Railway (backend) | Best-in-class Next.js DX + unified backend ops |
| **Observability** | Sentry (errors) + Pino (logs) | Free tier, immediate error visibility, structured logs |
| **Raindrop MCP** | Integrated in backend | Bookmark sources, track research, enforce curation workflow |

---

## Consequences

### Positive

1. **Fast time-to-value**: Mature tools with good documentation, 2-3 week MVP realistic
2. **Compliance-ready**: PostgreSQL + pgAudit + custom audit_log table provides tamper-evident trail
3. **Reliable job processing**: BullMQ + idempotency ensures weekly ingest/publish jobs complete
4. **Low ops burden**: Managed services (Neon, Upstash, Vercel, Railway) minimize DevOps
5. **Talent availability**: Next.js + Node.js + Postgres is a common stack (easy to hire/onboard)
6. **Cost-effective MVP**: ~$15-30/mo total (Neon, Upstash, Railway) vs ~$100+/mo for Datadog + managed queues

### Negative

1. **Two deployment platforms**: Vercel + Railway adds slight complexity vs single platform (mitigated by both having excellent DX)
2. **Custom RBAC implementation**: NextAuth requires ~1 day to build role system vs Clerk's out-of-box (acceptable trade-off for cost + control)
3. **No APM out-of-box**: Sentry doesn't provide request tracing (can add OpenTelemetry later if needed)

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Raindrop MCP downtime** | Cache source lists in Postgres; MCP is write-heavy, reads can fall back to DB |
| **OpenAI API rate limits** | BullMQ retries with exponential backoff; implement job-level rate limiting |
| **PostgreSQL connection limits** | Use Neon's connection pooling (PgBouncer built-in); limit Fastify concurrency to 10-20 |
| **BullMQ Redis memory** | Prune completed jobs after 7 days; archive failed jobs to Postgres for audit |

---

## Implementation Plan

1. **Scaffold** (Day 1)
   - `create-next-app` with TypeScript + Tailwind
   - Fastify server with Postgres connection (Neon)
   - BullMQ worker process (shared codebase)

2. **Auth + RBAC** (Day 2-3)
   - NextAuth.js v5 setup with Postgres adapter
   - `user`, `session`, `account` tables
   - Role-based middleware for Fastify routes
   - `audit_log` table with trigger functions

3. **Raindrop MCP Integration** (Day 4)
   - MCP client in Fastify (`raindrop.bookmarks.create`, `raindrop.tags.add`)
   - Collections: `RegIntel / Intake`, `RegIntel / Approved`, `RegIntel / Rejected`
   - Tag schema: `source:fda`, `type:guidance`, `week:YYYY-WW`, `status:intake`

4. **Ingest Pipeline** (Day 5-7)
   - Crawl whitelisted sources (FDA RSS, hardcoded URLs)
   - De-dup by content hash → `source_item` table
   - BullMQ job: `ingest` → `summarize` → `review-ready`
   - Summarization prompt with self-check (citations validation)

5. **Review UI** (Day 8-10)
   - Next.js `/review` page: list items by `status=review`
   - Side-by-side: source PDF iframe vs summary markdown
   - Actions: Approve (Server Action) → `status=approved`, log to `audit_log`, update Raindrop

6. **Publish Flow** (Day 11-12)
   - `/regintel/[week]` page: render approved items
   - Email digest generation (React Email + Resend API)
   - Publish job: snapshot links, tag `week:`, record in `publication` table

7. **Admin & Health** (Day 13-14)
   - `/admin/sources`: CRUD for source allowlist
   - `/admin/audit`: searchable `audit_log` view
   - `/health`: check Postgres, Redis, Raindrop MCP connectivity

---

## Research References (Raindrop Links)

**Note:** Raindrop MCP experienced connectivity issues during research (error 522). Links will be bookmarked to `RegIntel / Stack Research` collection with tags `stack:<layer>`, `pros`, `cons`, `benchmark` once service is restored.

**Manual bookmark list (to be added):**
- Frontend: [SvelteKit vs Next.js](https://prismic.io/blog/sveltekit-vs-nextjs), [Next vs Nuxt vs SvelteKit for SaaS](https://supastarter.dev/blog/nextjs-vs-nuxt-vs-sveltekit-for-saas-development)
- Backend: [Fastify vs Express](https://betterstack.com/community/guides/scaling-nodejs/fastify-express/), [FastAPI vs Fastify Benchmark](https://www.travisluong.com/fastapi-vs-fastify-vs-spring-boot-vs-gin-benchmark/)
- Database: [PostgreSQL Audit Logging](https://www.tigerdata.com/learn/what-is-audit-logging-and-how-to-enable-it-in-postgresql), [SQLite + Litestream HN Discussion](https://news.ycombinator.com/item?id=39065201)
- Jobs: [BullMQ Idempotent Jobs](https://docs.bullmq.io/patterns/idempotent-jobs), [BullMQ at Scale](https://medium.com/@kaushalsinh73/bullmq-at-scale-queueing-millions-of-jobs-without-breaking-ba4c24ddf104)
- Auth: [NextAuth vs Clerk 2024](https://medium.com/@annasaaddev/authentication-in-next-js-the-ultimate-2024-guide-nextauth-vs-clerk-vs-supabase-415ff7d841c5), [Auth.js RBAC Guide](https://authjs.dev/guides/role-based-access-control)
- Deploy: [Railway vs Vercel](https://docs.railway.com/maturity/compare-to-vercel), [Railway vs Fly](https://docs.railway.com/maturity/compare-to-fly)
- Observability: [Datadog vs Sentry](https://betterstack.com/community/comparisons/datadog-vs-sentry/), [Datadog vs Sentry 2025](https://signoz.io/comparisons/datadog-vs-sentry/)

---

## Approval

**Status:** ✅ APPROVED (2025-10-01)

Proceeding with implementation:
1. ✅ Initialize project structure
2. → Scaffold Next.js + Fastify monorepo
3. → Set up database schema with Prisma
4. → Implement auth + RBAC
5. → Integrate Raindrop MCP
