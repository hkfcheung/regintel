# Julius AI PostgreSQL Connection Setup

## Quick Setup with ngrok (Recommended for Testing)

### 1. Install and Start ngrok

```bash
# Install ngrok
brew install ngrok

# Start tunnel to PostgreSQL
ngrok tcp 5432
```

### 2. Copy Connection Details

ngrok will show:
```
Session Status: online
Forwarding: tcp://0.tcp.ngrok.io:12345 -> localhost:5432
```

### 3. Configure Julius AI

Use these connection details:

- **Host**: `0.tcp.ngrok.io` (from ngrok output)
- **Port**: `12345` (from ngrok output)
- **Database**: `regintel`
- **Username**: `ethancheung`
- **Password**: *(leave blank)*
- **SSL**: Not required (optional: enable if Julius requires it)

### 4. Test Connection

Before giving to Julius, test the public connection:

```bash
# From another terminal, test the ngrok endpoint
psql -h 0.tcp.ngrok.io -p 12345 -U ethancheung -d regintel -c "SELECT COUNT(*) FROM source_items WHERE status = 'APPROVED';"
```

## Available Data for Julius AI

### Approved Data Views

Julius AI can query these curated views:

1. **`vw_approved_decisions`** - Regulatory decisions (4 records)
   - Columns: `decision_id`, `title`, `decision_date`, `agency`, `status`

2. **`vw_approved_drugs`** - Drug information (4 records)
   - Columns: `drug_id`, `drug_name`, `therapeutic_area`, `approved_date`, `status`

3. **`vw_approved_guidance`** - FDA/EMA guidance (1 record)
   - Columns: `guidance_id`, `title`, `issued_date`, `agency`, `category`

4. **`vw_approved_news`** - Safety alerts and press releases (5 records)
   - Columns: `alert_id`, `title`, `published_date`, `alert_type`, `severity`

5. **`vw_approved_trials`** - Clinical trials (0 records currently)
   - Columns: `trial_id`, `title`, `meeting_date`, `phase`, `trial_status`

### Sample Queries for Julius AI

Teach Julius these useful queries:

```sql
-- Count approved items by type
SELECT
  CASE
    WHEN EXISTS(SELECT 1 FROM vw_approved_decisions) THEN 'Decisions'
    WHEN EXISTS(SELECT 1 FROM vw_approved_drugs) THEN 'Drugs'
  END as type,
  COUNT(*) as count
FROM vw_approved_decisions
GROUP BY type;

-- Recent approvals
SELECT
  drug_name,
  therapeutic_area,
  approved_date
FROM vw_approved_drugs
ORDER BY approved_date DESC
LIMIT 10;

-- Safety alerts by severity
SELECT
  severity,
  COUNT(*) as alert_count
FROM vw_approved_news
GROUP BY severity
ORDER BY alert_count DESC;
```

## Important Notes

### Security

⚠️ **ngrok exposes your local database publicly**
- Only use for testing/development
- Don't commit sensitive data
- Stop ngrok when not needed: `Ctrl+C`

### ngrok Free Tier Limitations

- URL changes on restart
- 40 connections/minute limit
- No custom domains
- Session timeout after 2 hours

For persistent public endpoint, upgrade to ngrok paid ($8/month) or use cloud database.

## Production Alternative: Neon PostgreSQL

For production use with Julius AI:

### 1. Create Neon Account

```bash
# Go to https://neon.tech
# Sign up and create project "regintel"
```

### 2. Export Local Data

```bash
pg_dump -U ethancheung -d regintel > /tmp/regintel.sql
```

### 3. Import to Neon

```bash
# Get connection string from Neon dashboard
psql "postgresql://[neon-connection-string]" < /tmp/regintel.sql
```

### 4. Update .env

```env
# Keep local for development
DATABASE_URL="postgresql://ethancheung@localhost:5432/regintel"

# Add Neon for Julius AI / production
NEON_DATABASE_URL="postgresql://[neon-connection-string]"
```

## Troubleshooting

### "Connection refused"

```bash
# Verify PostgreSQL is running
psql -U ethancheung -d regintel -c "SELECT 1;"

# Check PostgreSQL is listening on all interfaces
psql -U ethancheung -d postgres -c "SHOW listen_addresses;"
# Should show: listen_addresses | *
```

If not, edit `/opt/homebrew/var/postgresql@14/postgresql.conf`:
```
listen_addresses = '*'
```

Then restart PostgreSQL:
```bash
brew services restart postgresql@14
```

### "Authentication failed"

Add to `/opt/homebrew/var/postgresql@14/pg_hba.conf`:
```
host    all    all    0.0.0.0/0    trust
```

Then restart PostgreSQL.

### Julius AI shows "timeout"

- Check ngrok is still running
- Verify connection works from external location
- Check firewall isn't blocking port

## Summary

**For Testing**: Use ngrok (5 minutes setup)
**For Production**: Use Neon or Railway (permanent solution)

**Current ngrok command**:
```bash
ngrok tcp 5432
```

Then use the provided hostname and port in Julius AI.
