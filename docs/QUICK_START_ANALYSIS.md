# Quick Start: Testing the Analysis Pipeline

## Prerequisites Checklist

- [x] PostgreSQL running
- [x] Redis running
- [x] API server running (`cd apps/api && npm run dev`)
- [x] Worker running (`cd apps/api && npm run worker`)
- [x] Web app running (`cd apps/web && npm run dev`)
- [ ] **LLM API key configured** (OpenAI or Anthropic)

## Step 1: Add Your API Key

Edit `apps/api/.env` and add ONE of these:

**Option A: OpenAI (Recommended - faster & cheaper)**
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

**Option B: Anthropic**
```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

## Step 2: Restart the Worker

The worker needs to pick up the new environment variable:

```bash
# In the worker terminal, press Ctrl+C, then:
cd apps/api
npm run worker
```

You should see:
```
BullMQ workers started
- Ingest worker (concurrency: 5)
- Summarize worker (concurrency: 3)
- Publish worker (concurrency: 1)
```

## Step 3: Test with an Existing Source Item

You already have a source item ingested. Trigger analysis:

```bash
curl -X POST http://localhost:3001/analysis/trigger \
  -H "Content-Type: application/json" \
  -d '{"sourceItemId": "cmg95zj3t0000kfy6oayakfxv"}'
```

**Expected response:**
```json
{
  "success": true,
  "jobId": "analyze-cmg95zj3t0000kfy6oayakfxv",
  "message": "Analysis job queued"
}
```

## Step 4: Watch the Worker Logs

In the worker terminal, you should see:

```
[Worker] Processing job analyze-cmg95zj3t0000kfy6oayakfxv: analyze-source
[AnalysisWorker] Processing analysis for source item: cmg95zj3t0000kfy6oayakfxv
[Analysis] Analyzing source item: cmg95zj3t0000kfy6oayakfxv
[Analysis] Fetching URL: https://...
[Analysis] PDF extraction failed, using HTML text: ... (expected)
[Analysis] Calling LLM for analysis...
[Analysis] Running self-check validation...
[Analysis] Created analysis: xxx-yyy-zzz
[Worker] Job analyze-cmg95zj3t0000kfy6oayakfxv completed
```

⏱️ **This takes ~10-30 seconds** depending on document length.

## Step 5: Check Job Status

```bash
curl http://localhost:3001/analysis/status/analyze-cmg95zj3t0000kfy6oayakfxv
```

**When successful:**
```json
{
  "jobId": "analyze-cmg95zj3t0000kfy6oayakfxv",
  "state": "completed",
  "progress": 100,
  "returnvalue": {
    "analysisId": "...",
    "status": "analyzed"
  }
}
```

**If it failed:**
```json
{
  "state": "failed",
  "failedReason": "error message here"
}
```

## Step 6: View Analysis in UI

1. Go to http://localhost:3000/sources
2. You should see the source item with status badge changed to:
   - **REVIEW** (yellow) - if pediatric oncology relevant
   - **REJECTED** (red) - if not relevant to pediatric oncology
3. Click on the source item
4. Scroll down to see the analysis:
   - **Summary**: Pediatric oncology-focused summary
   - **Impact on Day One**: Practical implications
   - Citations and metadata

## Step 7: Ingest & Analyze a New URL

Visit http://localhost:3000/admin/ingest and enter a pediatric oncology URL:

**Good test URLs:**
- FDA Pediatric Oncology: https://www.fda.gov/drugs/development-approval-process-drugs/pediatric-research-equity-act-prea
- FDA Pediatric Drug Approval: https://www.fda.gov/drugs/resourcesforyou/consumers/ucm143565.htm

The system will automatically:
1. ✅ Ingest the content
2. ✅ Queue analysis job
3. ✅ Worker processes it
4. ✅ Results appear in UI (~30 seconds)

## Troubleshooting

### No analysis appears after 30 seconds?

**Check #1: API Key**
```bash
cat apps/api/.env | grep -E "OPENAI_API_KEY|ANTHROPIC_API_KEY"
```
Should show your key, not `your-openai-key-here`

**Check #2: Worker Logs**
Look for errors in the worker terminal. Common issues:
- `No LLM API key configured` → Add API key to `.env`
- `API error: 401` → Invalid API key
- `API error: 429` → Rate limit exceeded

**Check #3: Job Status**
```bash
curl http://localhost:3001/analysis/status/analyze-YOUR-SOURCE-ID
```

**Check #4: Database**
```bash
psql regintel -c "SELECT id, status FROM source_items;"
psql regintel -c "SELECT COUNT(*) FROM analyses;"
```

### Worker not picking up jobs?

```bash
# Check if worker is running
ps aux | grep "tsx watch src/worker"

# Check Redis queue
redis-cli LLEN bull:summarize:wait
```

### Analysis failed with error?

Check the `failedReason` in the job status. Common errors:
- **Rate limit**: Wait or use different API key
- **Invalid request**: Check prompt length (we truncate at 12,000 chars)
- **Network error**: Check internet connection

## Expected Output Example

For a pediatric oncology-relevant document:

```json
{
  "pediatric_relevant": true,
  "classification": "Guidance",
  "summary_md": "FDA guidance on pediatric oncology trials requiring enrollment of patients ages 0-21...",
  "impact_md": "Day One implications: New protocols must include pediatric populations...",
  "pediatric_details": {
    "age_groups": ["neonates", "infants", "children", "adolescents"],
    "dosing": "Weight-based dosing required for patients <12 years",
    "safety_outcomes": "Monitor for growth effects and developmental milestones",
    "efficacy_data": "Response rates in pediatric ALL: 85% CR rate"
  },
  "citations": [
    {"url": "https://...", "locator": "Section 3.2", "quote": "..."}
  ]
}
```

For a non-relevant document:

```json
{
  "pediatric_relevant": false,
  "summary_md": "This document focuses on adult cardiovascular disease and does not contain pediatric oncology information.",
  "status": "REJECTED"
}
```

## Next Steps

Once analysis is working:

1. **Review workflow**: Build the `/review` page for human review (TODO)
2. **Batch processing**: Process multiple URLs at once
3. **Weekly digest**: Generate publication from approved items
4. **Email notifications**: Alert team when new items need review

## Performance Expectations

- **Ingest**: 5-10 seconds (fetch + parse)
- **Analysis**: 10-30 seconds (LLM processing)
- **Total**: 15-40 seconds from URL to results
- **Cost**: ~$0.001-0.01 per analysis (GPT-4o-mini)

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ingest/trigger` | POST | Ingest a URL |
| `/ingest/status/:jobId` | GET | Check ingest job |
| `/analysis/trigger` | POST | Analyze a source item |
| `/analysis/batch-trigger` | POST | Analyze all INTAKE items |
| `/analysis/status/:jobId` | GET | Check analysis job |
| `/analysis/source/:sourceItemId` | GET | Get analysis results |


curl -X POST http://localhost:3001/analysis/batch-trigger
{"success":true,"message":"Queued 2 analysis jobs","jobIds":["analyze-cmgaj0wvf0000itdk1z0263ow","analyze-cmgaj0x1g0001itdkke4ra5th"],"total":2,"alreadyAnalyzed":0}%    