#!/bin/bash
# Start Prisma Studio with correct DATABASE_URL

cd "$(dirname "$0")/.."

echo "🗄️  Starting Prisma Studio..."
echo "📍 URL: http://localhost:5555"
echo ""

cd packages/database && \
  DATABASE_URL="${DATABASE_URL:-postgresql://ethancheung@localhost:5432/regintel}" \
  npx prisma studio
