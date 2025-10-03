# Analysis Workflow Guide

## Overview

The analysis pipeline automatically processes ingested regulatory documents to extract pediatric oncology-specific insights using LLM analysis.

## Architecture

```
Ingest URL → Source Item (INTAKE) → Analysis Job → LLM Analysis → Source Item (REVIEW/REJECTED)
```

## Required Services

### 1. **PostgreSQL** (Database)
```bash
# Check if running
psql regintel -c "SELECT 1"
```

### 2. **Redis** (Job Queue)
```bash
# Check if running
redis-cli ping
# Should return: PONG

# Or check process
ps aux | grep redis-server
```

### 3. **API Server** (Port 3001)
```bash
# Start from project root
cd apps/api
npm run dev
```

### 4. **Worker Process** (Background Jobs) ⚠️ **CRITICAL**
```bash
# Start worker in a separate terminal
cd apps/api
npm run worker
```

**Without the worker, analysis jobs will queue but never process!**

## Full Workflow

### Step 1: Ingest a Document

Go to http://localhost:3000/admin/ingest and enter a URL, e.g.:
```
https://www.fda.gov/drugs/development-approval-process-drugs/pediatric-research-equity-act-prea
```

**What happens:**
1. Content is fetched and parsed
2. Saved to database with status `INTAKE`
3. Analysis job is automatically queued to Redis

### Step 2: Worker Processes Analysis (Automatic)

**The worker (must be running) will:**
1. Pick up the job from Redis queue
2. Call AnalysisService
3. Fetch content and extract text (HTML + PDF if available)
4. Send to Anthropic Claude API with pediatric oncology prompt
5. Receive structured analysis:
   - `pediatric_relevant`: true/false
   - `classification`: Approval | Guidance | Safety Alert | Other
   - `summary_md`: Summary focusing on pediatric oncology
   - `impact_md`: Impact on Day One for pediatric programs
   - `pediatric_details`: Age groups, dosing, safety, efficacy
   - `citations`: Grounded references
6. Run self-check validation for citation accuracy
7. Save Analysis to database
8. Update source item status:
   - If relevant → `REVIEW` (ready for human review)
   - If not relevant → `REJECTED`

### Step 3: View Analysis Results

Go to http://localhost:3000/sources

You should see:
- Source items with status badges
- Click on a source to see full analysis
- Summary and "Impact on Day One" sections

## Troubleshooting

### No analysis showing up?

**Check #1: Is the worker running?**
```bash
# Look for "BullMQ workers started"
ps aux | grep "npm run worker"
```

If not running:
```bash
cd apps/api
npm run worker
```

**Check #2: Is the API key configured?**
```bash
cat apps/api/.env | grep ANTHROPIC_API_KEY
```

Should show your key. If empty, add:
```env
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Check #3: Are jobs queued in Redis?**
```bash
redis-cli
> KEYS *
> LLEN bull:summarize:wait
> LLEN bull:summarize:active
> LLEN bull:summarize:completed
> LLEN bull:summarize:failed
```

**Check #4: Check worker logs**
The worker terminal should show:
```
[Worker] Started and listening for ingest jobs...
[Worker] Processing job analyze-{sourceItemId}: analyze-source
[AnalysisWorker] Processing analysis for source item: {sourceItemId}
[Analysis] Analyzing source item: {sourceItemId}
[Analysis] Calling LLM for analysis...
```

### Manually trigger analysis

If you already have source items and want to analyze them:

**Option 1: Batch trigger all INTAKE items**
```bash
curl -X POST http://localhost:3001/analysis/batch-trigger
```

**Option 2: Trigger single item**
```bash
curl -X POST http://localhost:3001/analysis/trigger \
  -H "Content-Type: application/json" \
  -d '{"sourceItemId": "YOUR_SOURCE_ITEM_ID"}'
```

## Development Commands

```bash
# Terminal 1: API Server
cd apps/api
npm run dev

# Terminal 2: Worker Process (REQUIRED!)
cd apps/api
npm run worker

# Terminal 3: Web App
cd apps/web
npm run dev

# Terminal 4: Check Redis queue
redis-cli
> KEYS bull:*
> LRANGE bull:summarize:wait 0 -1
```

## Expected Timeline

From URL ingest to completed analysis:

1. **Ingest**: ~5-10 seconds (fetching + parsing)
2. **Analysis queue**: Instant (job added to Redis)
3. **LLM analysis**: ~10-30 seconds (depends on document length)
4. **Total**: ~15-40 seconds

If it takes longer, check:
- Worker logs for errors
- Redis connection issues
- API rate limits (Anthropic)

## Next Steps

After analysis completes with status `REVIEW`:

1. Human reviewer visits `/review` page (TODO)
2. Reviews AI-generated summary and citations
3. Approves/rejects/revises
4. Approved items move to status `APPROVED`
5. Weekly digest generation publishes approved items

## API Endpoints

- `POST /ingest/trigger` - Ingest a URL
- `POST /analysis/trigger` - Trigger analysis for a source item
- `POST /analysis/batch-trigger` - Analyze all INTAKE items
- `GET /analysis/status/:jobId` - Check job status
- `GET /analysis/source/:sourceItemId` - Get analysis results
- `GET /sources` - List all source items (web UI)
- `GET /sources/:id` - View source item details + analysis (web UI)
