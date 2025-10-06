# RegIntel Discovery System

## Overview

RegIntel uses a **hybrid discovery approach** combining passive RSS feeds with active web searching to find new pediatric oncology regulatory content.

## Discovery Methods

### 1. RSS Feed Polling (Passive)

**How it works:**
- Polls configured RSS feeds at regular intervals (default: every hour)
- Filters items for pediatric oncology keywords
- Automatically ingests new items

**Configured Feeds:**
- FDA Oncology Center of Excellence
- FDA Drug Information
- FDA MedWatch (for device recalls)

**Pros:**
- Low-latency - catches new items as they're published
- Official FDA feed - reliable and structured
- Minimal server load

**Cons:**
- Limited to what FDA publishes in feeds
- Misses older content not in feed

### 2. Search-Based Discovery (Active)

**How it works:**
- Searches Google with `site:fda.gov` queries for pediatric oncology terms
- Scrapes known FDA drug approval index pages
- Extracts links to specific drug approval documents
- Filters for oncology/pediatric-relevant URLs

**Search Queries:**
```
site:fda.gov pediatric oncology approval
site:fda.gov children cancer drug approval
site:fda.gov pediatric leukemia treatment
site:fda.gov adolescent cancer therapy
```

**Known Pages Scraped:**
```
/drugs/resources-information-approved-drugs/hematologyoncology-cancer-approvals-safety-notifications
/drugs/resources-information-approved-drugs/pediatric-oncology-drug-approvals
/about-fda/oncology-center-excellence/pediatric-oncology
```

**Pros:**
- Finds historical content not in RSS feeds
- Discovers 100+ relevant URLs per run
- Catches pages RSS feeds miss

**Cons:**
- Higher server load
- Google rate limiting possible
- Requires parsing HTML

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Discovery Triggers                        │
├─────────────────────────────────────────────────────────────┤
│  1. Manual UI button (Admin → Discovery)                    │
│  2. Scheduled cron job (scripts/poll-rss-feeds.sh)          │
│  3. API endpoint: POST /discovery/run                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Discovery Queue (BullMQ/Redis)                  │
├─────────────────────────────────────────────────────────────┤
│  Queue: "discovery"                                          │
│  Worker: discoveryWorker (concurrency: 1)                   │
│  Processor: processDiscoveryJob()                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│        AutonomousDiscoveryService                            │
├─────────────────────────────────────────────────────────────┤
│  Methods:                                                    │
│  • runDiscovery() - Discovers all active domains            │
│  • discoverForDomain(domain) - Domain-specific discovery    │
│  • discoverFdaDocuments() - FDA-specific search logic       │
│  • searchGoogleForFda(query) - Google site search           │
│  • scrapeLinksFromPage(url) - Extract links from pages      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Ingestion Pipeline                              │
├─────────────────────────────────────────────────────────────┤
│  1. Check if URL already exists (skip duplicates)           │
│  2. Validate domain is in allowed_domains                   │
│  3. Queue for ingestion (ingest queue)                      │
│  4. IngestService fetches & stores content                  │
│  5. Status: INTAKE → ready for analysis                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              Analysis Pipeline                               │
├─────────────────────────────────────────────────────────────┤
│  1. Trigger analysis for INTAKE items                       │
│  2. AI analyzes for pediatric oncology relevance            │
│  3. Status: INTAKE → REVIEW or REJECTED                     │
│  4. Human reviewers approve/reject in UI                    │
│  5. Approved items → SmartBuckets™ knowledge base           │
└─────────────────────────────────────────────────────────────┘
```

## Automation

### Automated Discovery Script

**Location:** `scripts/poll-rss-feeds.sh`

**What it does:**
1. Polls RSS feeds
2. Runs search-based discovery for FDA
3. Triggers analysis for new INTAKE items
4. Provides summary stats

**Usage:**

```bash
# Run manually
./scripts/poll-rss-feeds.sh

# Or set up daily cron (9 AM)
(crontab -l; echo "0 9 * * * /path/to/regintel/scripts/poll-rss-feeds.sh >> /tmp/regintel-discovery.log 2>&1") | crontab -
```

### Manual Discovery

**Via UI:**
1. Go to Admin → Discovery
2. Click "Start Discovery"
3. Wait 2-5 minutes for results

**Via API:**
```bash
# Discover all active domains
curl -X POST http://localhost:3001/discovery/run \
  -H "Content-Type: application/json" \
  -d '{}'

# Discover specific domain
curl -X POST http://localhost:3001/discovery/run \
  -H "Content-Type: application/json" \
  -d '{"domain": "fda.gov"}'

# Check job status
curl http://localhost:3001/discovery/status/{jobId}
```

## Recent Results

**Last run: 2025-10-06**
- **110 URLs found** from FDA.gov search-based discovery
- **110 queued** for ingestion (all new, no duplicates)
- **Total items in database: 151** (up from 23)

**Examples of discovered content:**
- Selumetinib for pediatric NF1
- Cabozantinib for pediatric PNET/EPNET
- Mirdametinib for pediatric NF1
- Remestemcel-L for pediatric GVHD
- Eflornithine for pediatric neuroblastoma
- Naxitamab for pediatric neuroblastoma
- Dabrafenib + trametinib for pediatric low-grade glioma

## Configuration

### Allowed Domains

Configured in database (`allowed_domains` table):

| Domain | Active | Discovery Interval | Last Discovered |
|--------|--------|-------------------|-----------------|
| fda.gov | ✅ | 24 hours | 2025-10-06 |
| ema.europa.eu | ✅ | 24 hours | 2025-10-03 |
| pmda.go.jp | ✅ | 24 hours | 2025-10-03 |

### RSS Feeds

Configured in database (`rss_feeds` table):

| Feed | URL | Poll Interval |
|------|-----|--------------|
| FDA Oncology Center | `/oncology-center-excellence/rss.xml` | 1 hour |
| FDA Drug Info | `/drugs/rss.xml` | 1 hour |
| FDA MedWatch | `/medwatch/rss.xml` | 1 hour |

## Monitoring

### Check Discovery Status

```bash
# Get domains due for discovery
curl http://localhost:3001/discovery/due

# Get current item counts
psql -d regintel -c "SELECT COUNT(*), status FROM source_items GROUP BY status;"
```

### Logs

Discovery logs are written to:
- **Console:** API server logs (apps/api)
- **Worker logs:** Worker process logs
- **Cron logs:** `/tmp/regintel-discovery.log` (if using cron)

### Metrics

Key metrics to monitor:
- **Ingest rate:** New items per day
- **Analysis rate:** Items analyzed per hour
- **Review queue depth:** Items waiting for human review
- **Approval rate:** % of items approved vs rejected

## Future Enhancements

1. **More domains:** Add EMA, PMDA search-based discovery
2. **NLP filtering:** Pre-filter URLs by relevance before ingestion
3. **Duplicate detection:** Use content similarity to detect duplicate approvals
4. **Auto-scheduling:** Self-adjusting discovery frequency based on new content rate
5. **Search API:** Use Google Custom Search API for better rate limits
