#!/bin/bash
set -e

echo "🚀 RegIntel Setup Script"
echo "========================"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required. Current: $(node -v)"
  exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Copy environment files
echo "📝 Setting up environment files..."

if [ ! -f "apps/web/.env.local" ]; then
  cp apps/web/.env.example apps/web/.env.local
  echo "✅ Created apps/web/.env.local"
else
  echo "⏭️  apps/web/.env.local already exists"
fi

if [ ! -f "apps/api/.env" ]; then
  cp apps/api/.env.example apps/api/.env
  echo "✅ Created apps/api/.env"
else
  echo "⏭️  apps/api/.env already exists"
fi

echo ""
echo "🔐 Generating NextAuth secret..."
SECRET=$(openssl rand -base64 32)
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/your-secret-key-generate-with-openssl-rand-base64-32/$SECRET/" apps/web/.env.local
else
  sed -i "s/your-secret-key-generate-with-openssl-rand-base64-32/$SECRET/" apps/web/.env.local
fi
echo "✅ NextAuth secret generated"
echo ""

# Database setup prompt
echo "🗄️  Database Setup"
echo "=================="
echo ""
echo "You need to set up a PostgreSQL database. Options:"
echo "  1. Local PostgreSQL (brew install postgresql / apt install postgresql)"
echo "  2. Neon (https://neon.tech) - managed, free tier"
echo "  3. Supabase (https://supabase.com) - managed, free tier"
echo ""
echo "Once you have a DATABASE_URL, update:"
echo "  - apps/web/.env.local"
echo "  - apps/api/.env"
echo ""
read -p "Have you set up your database? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "✅ Great! Generating Prisma client..."
  npm run db:generate
  echo ""

  read -p "Push schema to database now? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm run db:push
    echo "✅ Database schema applied"
  else
    echo "⏭️  Skipped. Run 'npm run db:push' when ready."
  fi
else
  echo "⏭️  Skipped. Run 'npm run db:generate && npm run db:push' after database setup."
fi

echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "Next steps:"
echo "  1. Update environment variables in apps/web/.env.local and apps/api/.env"
echo "  2. Start dev servers: npm run dev"
echo "  3. Visit http://localhost:3000"
echo ""
echo "Optional:"
echo "  - Set up Redis (for job queue): brew install redis / docker run -d -p 6379:6379 redis"
echo "  - Get Raindrop API token: https://app.raindrop.io/settings/integrations"
echo ""
