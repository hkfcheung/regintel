#!/bin/bash
# Start the BullMQ worker

cd "$(dirname "$0")/.."

echo "🚀 Starting BullMQ worker..."
echo "📍 Make sure Redis is running: brew services list | grep redis"
echo ""

cd apps/api && \
  DATABASE_URL="${DATABASE_URL:-postgresql://ethancheung@localhost:5432/regintel}" \
  REDIS_HOST="${REDIS_HOST:-localhost}" \
  REDIS_PORT="${REDIS_PORT:-6379}" \
  npx tsx src/worker.ts
