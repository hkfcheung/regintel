#!/bin/bash

echo "🚀 Starting Metabase..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running!"
    echo ""
    echo "Please start Docker Desktop and try again."
    exit 1
fi

# Start Metabase
echo "📦 Pulling Metabase image (this may take a few minutes the first time)..."
docker-compose -f docker-compose.metabase.yml up -d

echo ""
echo "⏳ Waiting for Metabase to start..."
echo ""

# Wait for container to be up
for i in {1..60}; do
    if docker ps | grep -q "regintel-metabase"; then
        echo "✅ Metabase container is running"
        break
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "⏳ Waiting for Metabase to be ready (first start takes ~60 seconds)..."
echo ""

# Wait for health check
for i in {1..120}; do
    if curl -sf http://localhost:3002/api/health > /dev/null 2>&1; then
        echo ""
        echo "✅ Metabase is ready!"
        echo ""
        echo "📊 Open Metabase: http://localhost:3002"
        echo ""
        echo "📋 Next steps:"
        echo "  1. Create an admin account"
        echo "  2. Connect to database:"
        echo "     Type: PostgreSQL"
        echo "     Host: host.docker.internal"
        echo "     Port: 5432"
        echo "     Database: regintel"
        echo "     Username: ethancheung"
        echo ""
        exit 0
    fi
    
    # Show progress
    if [ $((i % 10)) -eq 0 ]; then
        echo -n " ${i}s"
    else
        echo -n "."
    fi
    sleep 1
done

echo ""
echo "⚠️  Metabase is taking longer than expected to start."
echo ""
echo "Check the logs:"
echo "  docker logs regintel-metabase"
echo ""
echo "Once ready, open: http://localhost:3002"
