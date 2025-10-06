#!/bin/bash

# Poll RSS feeds, run discovery, and trigger analysis for new items
# Run this script via cron to automate discovery

cd "$(dirname "$0")/.."

echo "[$(date)] Starting automated discovery..."

# 1. Trigger RSS feed poll
echo "[$(date)] Polling RSS feeds..."
POLL_RESULT=$(curl -s -X POST http://localhost:3001/rss/poll -H "Content-Type: application/json" -d '{}')
echo "[$(date)] RSS poll: $POLL_RESULT"

# 2. Trigger web-based discovery for FDA
echo "[$(date)] Running search-based discovery..."
DISCOVERY_RESULT=$(curl -s -X POST http://localhost:3001/discovery/run -H "Content-Type: application/json" -d '{"domain": "fda.gov"}')
echo "[$(date)] Discovery: $DISCOVERY_RESULT"

# Wait for RSS and discovery to complete
echo "[$(date)] Waiting for discovery to complete..."
sleep 60

# 3. Get items in INTAKE status and trigger analysis
INTAKE_COUNT=$(psql -d regintel -t -c "SELECT COUNT(*) FROM source_items WHERE status = 'INTAKE';")
echo "[$(date)] Found $INTAKE_COUNT items in INTAKE"

if [ "$INTAKE_COUNT" -eq 0 ]; then
  echo "[$(date)] No items in INTAKE, nothing to analyze"
else
  # Batch trigger analysis for all INTAKE items
  INTAKE_IDS=$(psql -d regintel -t -c "SELECT id FROM source_items WHERE status = 'INTAKE' LIMIT 50;")

  COUNT=0
  for ID in $INTAKE_IDS; do
    ID_TRIMMED=$(echo $ID | xargs)
    echo "[$(date)] Triggering analysis for $ID_TRIMMED"
    curl -s -X POST http://localhost:3001/analysis/trigger \
      -H "Content-Type: application/json" \
      -d "{\"sourceItemId\": \"$ID_TRIMMED\"}" > /dev/null
    COUNT=$((COUNT + 1))

    # Rate limit: 5 per second
    if [ $((COUNT % 5)) -eq 0 ]; then
      sleep 1
    fi
  done

  echo "[$(date)] Triggered analysis for $COUNT items"
fi

# 4. Show summary
TOTAL=$(psql -d regintel -t -c "SELECT COUNT(*) FROM source_items;")
REVIEW=$(psql -d regintel -t -c "SELECT COUNT(*) FROM source_items WHERE status = 'REVIEW';")
APPROVED=$(psql -d regintel -t -c "SELECT COUNT(*) FROM source_items WHERE status = 'APPROVED';")

echo "[$(date)] === Discovery Summary ==="
echo "[$(date)] Total items: $TOTAL"
echo "[$(date)] In review: $REVIEW"
echo "[$(date)] Approved: $APPROVED"
echo "[$(date)] Discovery complete"
