#!/bin/bash

# Stop Metabase for RegIntel Analytics

echo "🛑 Stopping Metabase..."

docker-compose -f docker-compose.metabase.yml down

echo "✅ Metabase stopped"
echo ""
echo "To start again: ./scripts/start-metabase.sh"
