#!/bin/bash

# Start Metabase for RegIntel Analytics
# This script starts Metabase using Docker Compose

echo "🚀 Starting Metabase for RegIntel..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Metabase is already running
if docker ps | grep -q regintel-metabase; then
    echo "✅ Metabase is already running at http://localhost:3002"
    exit 0
fi

# Start Metabase
docker-compose -f docker-compose.metabase.yml up -d

# Wait for Metabase to be healthy
echo ""
echo "⏳ Waiting for Metabase to start (this may take 60 seconds on first run)..."
echo ""

for i in {1..60}; do
    if docker ps | grep -q "regintel-metabase"; then
        if curl -sf http://localhost:3002/api/health > /dev/null 2>&1; then
            echo ""
            echo "✅ Metabase is ready!"
            echo ""
            echo "📊 Open Metabase: http://localhost:3002"
            echo ""
            echo "First time setup:"
            echo "  1. Create an admin account"
            echo "  2. Add database connection:"
            echo "     - Type: PostgreSQL"
            echo "     - Host: host.docker.internal"
            echo "     - Port: 5432"
            echo "     - Database: regintel"
            echo "     - Username: ethancheung"
            echo ""
            echo "📖 Full setup guide: ./METABASE_SETUP.md"
            echo ""
            exit 0
        fi
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "⚠️  Metabase is starting but not yet ready."
echo "   Check status: docker logs regintel-metabase"
echo "   Once ready, open: http://localhost:3002"
