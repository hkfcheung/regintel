# RegIntel Setup Guide

This guide walks through setting up the RegIntel platform from scratch.

---

## Prerequisites

### Required
- **Node.js 20+** and **npm 10+**
  ```bash
  node -v  # Should be v20.x.x or higher
  npm -v   # Should be 10.x.x or higher
  ```

- **PostgreSQL 14+** (local or managed)
  - **Option 1:** Local installation
    ```bash
    # macOS
    brew install postgresql@14
    brew services start postgresql@14

    # Ubuntu/Debian
    sudo apt install postgresql-14
    sudo systemctl start postgresql
    ```

  - **Option 2:** Managed service (recommended for MVP)
    - [Neon](https://neon.tech) - Serverless Postgres, $0-19/mo
    - [Supabase](https://supabase.com) - Full backend platform, $0-25/mo

- **Redis 6+** (local or managed)
  ```bash
  # macOS
  brew install redis
  brew services start redis

  # Docker
  docker run -d -p 6379:6379 redis:7-alpine

  # Managed (recommended)
  # Upstash: https://upstash.com (free tier available)
  ```

### Optional
- **Raindrop.io** API token for MCP integration
  1. Sign up at https://raindrop.io
  2. Go to https://app.raindrop.io/settings/integrations
  3. Create a new app and get your token

---

## Installation Steps

### 1. Clone and Install

```bash
cd /path/to/liquidmetal2
npm install
```

### 2. Set Up Environment Variables

#### Web App (Next.js)

Create `apps/web/.env.local`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/regintel"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

# API Backend
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Generate NextAuth secret:
```bash
openssl rand -base64 32
```

#### Backend API (Fastify)

Create `apps/api/.env`:

```env
# Server
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/regintel"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Raindrop (optional)
RAINDROP_API_TOKEN=your-raindrop-token
```

### 3. Create Database

#### Local PostgreSQL

```bash
# Create database
createdb regintel

# Or with psql
psql postgres
CREATE DATABASE regintel;
\q
```

#### Managed Service

1. Create a new project/database in Neon or Supabase
2. Copy the connection string (looks like `postgresql://user:pass@host/dbname`)
3. Paste into both `.env` files

### 4. Initialize Database Schema

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

This will create all tables defined in `packages/database/prisma/schema.prisma`.

### 5. Verify Setup

```bash
# Start all services
npm run dev
```

This starts:
- **Web:** http://localhost:3000
- **API:** http://localhost:3001
- **Worker:** Background process for jobs

Check health:
```bash
curl http://localhost:3001/health
curl http://localhost:3001/health/ready
```

Expected output:
```json
{
  "status": "ready",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "raindrop": "unavailable"  // ok if token is set
  }
}
```

---

## Development Workflow

### Starting the App

```bash
# All services (recommended)
npm run dev

# Individual services
cd apps/web && npm run dev    # Web only
cd apps/api && npm run dev    # API only
cd apps/api && npm run worker # Worker only
```

### Database Management

```bash
# Open Prisma Studio (DB GUI)
npm run db:studio

# Regenerate client after schema changes
npm run db:generate

# Apply schema changes
npm run db:push

# Reset database (⚠️ deletes all data)
npx prisma migrate reset --schema packages/database/prisma/schema.prisma
```

### Creating Your First Admin User

Since auth providers aren't configured yet, you need to manually create a user:

```bash
npm run db:studio
```

1. Open the `User` table
2. Click **Add record**
3. Fill in:
   - `email`: your-email@example.com
   - `role`: ADMIN
   - `emailVerified`: (current timestamp)
4. Save

---

## Next Steps

### 1. Configure Authentication

Edit `apps/web/src/lib/auth.ts` and add providers:

```typescript
import GoogleProvider from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ...
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
});
```

Add credentials to `.env.local`:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 2. Set Up Raindrop Collections

If using Raindrop MCP:

1. Log in to https://raindrop.io
2. Create collections:
   - `RegIntel / Intake`
   - `RegIntel / Approved`
   - `RegIntel / Rejected`
   - `RegIntel / Stack Research` (for ADR links)
3. Add your API token to `apps/api/.env`

### 3. Configure Source Allowlist

Edit `packages/shared/src/utils.ts`:

```typescript
const ALLOWED_DOMAINS = [
  "fda.gov",
  "www.fda.gov",
  "accessdata.fda.gov",
  // Add more trusted sources
];
```

### 4. Test the Ingest Pipeline

```bash
# Trigger a test ingest
curl -X POST http://localhost:3001/ingest/trigger \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.fda.gov/example", "type": "guidance"}'

# Check job status
curl http://localhost:3001/ingest/status/<jobId>
```

---

## Troubleshooting

### Database Connection Errors

```
Error: P1001: Can't reach database server
```

**Solutions:**
- Check `DATABASE_URL` is correct in both `.env` files
- Verify PostgreSQL is running: `pg_isready` or check service status
- For managed services, check firewall/IP allowlist settings

### Redis Connection Errors

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions:**
- Verify Redis is running: `redis-cli ping` (should return `PONG`)
- Check `REDIS_HOST` and `REDIS_PORT` in `apps/api/.env`
- Start Redis: `brew services start redis` or `docker start <redis-container>`

### Prisma Client Errors

```
Error: @prisma/client did not initialize yet
```

**Solutions:**
- Run `npm run db:generate` to regenerate the client
- Restart the dev server

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
- Kill process on port: `lsof -ti:3000 | xargs kill -9`
- Change port in `.env` files

---

## Production Deployment

See `README.md` for deployment recommendations (Vercel + Railway + Neon + Upstash).

Key steps:
1. Set environment variables in deployment platform
2. Enable automatic deployments from git
3. Configure custom domains (optional)
4. Set up monitoring (Sentry)
5. Enable backups (Neon/Supabase automatic)

---

## Additional Resources

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [NextAuth.js Configuration](https://authjs.dev/getting-started/installation)
- [BullMQ Patterns](https://docs.bullmq.io/patterns)
- [Fastify Guides](https://fastify.dev/docs/latest/Guides/)
