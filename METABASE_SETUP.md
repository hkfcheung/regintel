# Metabase Integration for RegIntel

This guide walks you through setting up Metabase for advanced analytics in RegIntel.

## What is Metabase?

Metabase is an open-source business intelligence tool that provides:
- **Ask AI Feature**: Natural language queries powered by AI
- **Visual Query Builder**: No SQL knowledge required
- **Beautiful Dashboards**: Drag-and-drop dashboard creation
- **Direct Database Access**: Connects to your PostgreSQL database

## Quick Start (Local Development)

### Prerequisites

- Docker installed on your machine
- RegIntel database running (PostgreSQL)
- Port 3002 available

### Step 1: Start Metabase

From the project root directory:

```bash
docker-compose -f docker-compose.metabase.yml up -d
```

This will:
- Pull the Metabase Docker image
- Start Metabase on port 3002
- Create a persistent volume for Metabase data

### Step 2: Initial Setup

1. **Open Metabase**: Navigate to http://localhost:3002
2. **Wait for startup**: First launch takes ~60 seconds
3. **Create admin account**:
   - Enter your name
   - Email: your email
   - Password: choose a strong password
   - Click "Next"

### Step 3: Connect to RegIntel Database

1. **Add a database**:
   - Name: `RegIntel`
   - Database type: `PostgreSQL`

2. **Connection details**:
   ```
   Host: host.docker.internal
   Port: 5432
   Database name: regintel
   Username: ethancheung
   Password: (leave blank if no password)
   ```

   **Note**: On Mac/Windows, use `host.docker.internal` to connect to localhost.
   On Linux, use `172.17.0.1` or your host IP.

3. **Test connection**: Click "Save" - Metabase will verify the connection

4. **Skip data preferences**: Click "I'll add my own data" or explore sample data

### Step 4: Explore Your Data

Once connected, Metabase will automatically scan your database schema.

**Available tables**:
- `SourceItem` - All ingested regulatory items
- `RSSFeed` - RSS feed configurations
- `User` - User accounts
- `UserAlert` - User alert subscriptions
- `AuditLog` - Activity logs
- And more...

## Creating Your First Dashboard

### Example: Regulatory Intelligence Overview

1. **Click "New"** → **"Dashboard"**
2. **Name it**: "RegIntel Overview"
3. **Add questions** (click "+" button):

#### Question 1: Total Items by Region
```
From: SourceItem
Summarize: Count of records
Group by: region
Visualization: Pie chart
```

#### Question 2: Items Ingested Over Time
```
From: SourceItem
Summarize: Count of records
Group by: publishedAt (by day)
Visualization: Line chart
```

#### Question 3: Review Status Distribution
```
From: SourceItem
Summarize: Count of records
Group by: reviewStatus
Visualization: Bar chart
```

#### Question 4: Top RSS Feeds
```
From: SourceItem
Summarize: Count of records
Group by: rssFeedId
Sort by: Count descending
Limit: 10
Visualization: Bar chart
```

4. **Arrange and resize** cards on your dashboard
5. **Save dashboard**

## Using Ask AI Feature

Metabase's AI feature (if enabled) allows natural language queries:

1. Click **"Ask a question"**
2. Select **"Ask AI"** (if available in your Metabase version)
3. Type questions like:
   - "How many FDA items were published this month?"
   - "Show me pending items by region"
   - "What are the top 5 tags this week?"

**Note**: Ask AI requires Metabase Pro or connection to OpenAI API.

## Useful Queries for RegIntel

### 1. Content Ingestion Rate
```sql
SELECT
  DATE_TRUNC('day', "publishedAt") as date,
  COUNT(*) as items
FROM "SourceItem"
WHERE "publishedAt" >= NOW() - INTERVAL '30 days'
GROUP BY date
ORDER BY date
```

### 2. Top Sources
```sql
SELECT
  source,
  COUNT(*) as count
FROM "SourceItem"
GROUP BY source
ORDER BY count DESC
LIMIT 10
```

### 3. Review Pipeline Status
```sql
SELECT
  "reviewStatus",
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM "SourceItem"
GROUP BY "reviewStatus"
```

### 4. RSS Feed Performance
```sql
SELECT
  r.title as feed,
  COUNT(s.id) as items,
  r."lastPolledAt"
FROM "RSSFeed" r
LEFT JOIN "SourceItem" s ON s."rssFeedId" = r.id
GROUP BY r.id, r.title, r."lastPolledAt"
ORDER BY items DESC
```

### 5. Alert Subscriptions
```sql
SELECT
  u.email,
  COUNT(a.id) as alert_count,
  SUM(CASE WHEN a.active THEN 1 ELSE 0 END) as active_alerts
FROM "User" u
LEFT JOIN "UserAlert" a ON a."userId" = u.id
GROUP BY u.id, u.email
ORDER BY alert_count DESC
```

## Integration with RegIntel

The Analytics link in RegIntel's header opens Metabase in a new tab.

**Current Integration**: Simple link to http://localhost:3002

**Future Enhancements** (once hosted):
- Embedded dashboards directly in RegIntel pages
- Single sign-on (SSO) with NextAuth
- Custom branded interface
- API-driven dashboard embedding

## Managing Metabase

### View Logs
```bash
docker logs regintel-metabase
```

### Stop Metabase
```bash
docker-compose -f docker-compose.metabase.yml down
```

### Restart Metabase
```bash
docker-compose -f docker-compose.metabase.yml restart
```

### Remove Metabase and Data
```bash
docker-compose -f docker-compose.metabase.yml down -v
```

## Backup Your Dashboards

Metabase stores all dashboards, questions, and settings in its database.

**Backup location**: Docker volume `metabase-data`

**To backup**:
```bash
docker run --rm -v regintel_metabase-data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/metabase-backup.tar.gz /data
```

**To restore**:
```bash
docker run --rm -v regintel_metabase-data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/metabase-backup.tar.gz -C /
```

## Production Deployment Options

Once you're ready to host Metabase in production:

### Option 1: Railway (Easiest)
- One-click Metabase deployment
- Free tier available
- Automatic HTTPS
- Connect to your production database

### Option 2: Render
- Free tier with PostgreSQL for Metabase storage
- Easy deployment from Docker image
- Automatic SSL

### Option 3: DigitalOcean
- $6/month droplet
- More control
- Can colocate with your app

### Option 4: Fly.io
- Generous free tier
- Global deployment
- Good for low-traffic apps

## Troubleshooting

### Can't connect to database
- **Error**: `Connection refused`
- **Fix**: Use `host.docker.internal` (Mac/Windows) or `172.17.0.1` (Linux)

### Metabase won't start
- **Check logs**: `docker logs regintel-metabase`
- **Common issue**: Port 3002 already in use
- **Fix**: Change port in `docker-compose.metabase.yml`

### Forgot admin password
- **Solution**: Reset via database or recreate Metabase container

### Slow queries
- Add database indexes for frequently queried columns
- Limit date ranges in queries
- Use Metabase's query caching

## Next Steps

1. ✅ Start Metabase locally
2. ✅ Connect to RegIntel database
3. 📊 Create 3-5 essential dashboards
4. 🧪 Test Ask AI feature (if available)
5. 🚀 Deploy to production hosting
6. 🔗 Implement embedded dashboards in RegIntel

## Resources

- [Metabase Documentation](https://www.metabase.com/docs/latest/)
- [Metabase Community](https://discourse.metabase.com/)
- [SQL Best Practices](https://www.metabase.com/learn/sql-questions/)
