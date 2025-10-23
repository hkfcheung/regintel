-- PostgreSQL Curated Views for Neo4j Sync
--
-- CRITICAL: All views MUST filter WHERE status = 'APPROVED'
-- This ensures ONLY curated, reviewed, and approved content flows into Neo4j
--
-- Created: 2025-10-12
-- Purpose: Provide read-only approved data sources for Neo4j graph synchronization

-- ===========================================
-- View 1: vw_approved_decisions
-- ===========================================
-- Regulatory decisions (APPROVAL, GUIDANCE types)

CREATE OR REPLACE VIEW vw_approved_decisions AS
SELECT
  si.id as decision_id,
  si.url,
  si.title,
  si."publishedAt" as decision_date,
  si.type as decision_type,
  si."sourceDomain" as agency_domain,

  -- Extract agency from domain (simple logic)
  CASE
    WHEN si."sourceDomain" LIKE '%fda.gov%' THEN 'FDA'
    WHEN si."sourceDomain" LIKE '%ema.europa.eu%' THEN 'EMA'
    WHEN si."sourceDomain" LIKE '%pmda.go.jp%' THEN 'PMDA'
    ELSE 'OTHER'
  END as agency,

  -- Extract drug name from title (simplified - would need AI in production)
  si.title as drug_name_raw,

  -- Approval metadata (CRITICAL)
  si.status,
  si."updatedAt" as reviewed_at,
  'system' as approved_by, -- Would come from reviews table in production
  si."updatedAt" as approved_at,

  -- Tags and metadata
  si.tags,
  si."createdAt",
  si."updatedAt"

FROM source_items si
WHERE
  si.status = 'APPROVED'  -- CRITICAL FILTER
  AND si.type IN ('APPROVAL', 'GUIDANCE')
  AND si."publishedAt" IS NOT NULL
ORDER BY si."publishedAt" DESC;

-- ===========================================
-- View 2: vw_approved_trials
-- ===========================================
-- Clinical trial records (MEETING type)

CREATE OR REPLACE VIEW vw_approved_trials AS
SELECT
  si.id as trial_id,
  si.url,
  si.title,
  si."publishedAt" as meeting_date,

  -- Extract trial phase from title/tags (simplified)
  CASE
    WHEN si.title ILIKE '%phase 3%' OR si.title ILIKE '%phase iii%' THEN 'Phase 3'
    WHEN si.title ILIKE '%phase 2%' OR si.title ILIKE '%phase ii%' THEN 'Phase 2'
    WHEN si.title ILIKE '%phase 1%' OR si.title ILIKE '%phase i%' THEN 'Phase 1'
    ELSE 'Unknown'
  END as phase,

  -- Trial status
  CASE
    WHEN si.title ILIKE '%completed%' THEN 'Completed'
    WHEN si.title ILIKE '%ongoing%' OR si.title ILIKE '%active%' THEN 'Active'
    WHEN si.title ILIKE '%recruiting%' THEN 'Recruiting'
    ELSE 'Unknown'
  END as trial_status,

  -- Extract drug name (simplified)
  si.title as drug_name_raw,

  -- Approval metadata (CRITICAL)
  si.status,
  si."updatedAt" as reviewed_at,
  'system' as approved_by,
  si."updatedAt" as approved_at,

  -- Source info
  si."sourceDomain",
  si.tags,
  si."createdAt",
  si."updatedAt"

FROM source_items si
WHERE
  si.status = 'APPROVED'  -- CRITICAL FILTER
  AND si.type = 'MEETING'
  AND si."publishedAt" IS NOT NULL
ORDER BY si."publishedAt" DESC;

-- ===========================================
-- View 3: vw_approved_drugs
-- ===========================================
-- Drug information extracted from analyses

CREATE OR REPLACE VIEW vw_approved_drugs AS
SELECT DISTINCT
  -- Generate a stable drug_id from name
  LOWER(REGEXP_REPLACE(
    COALESCE(
      -- Try to extract drug name from title
      SUBSTRING(si.title FROM '([A-Z][a-z]+mab|[A-Z][a-z]+tinib|[A-Z][a-z]+ciclib)'),
      -- Fallback to first word
      SPLIT_PART(si.title, ' ', 1)
    ),
    '[^a-z0-9]', '', 'g'
  )) as drug_id,

  -- Extract drug name
  COALESCE(
    SUBSTRING(si.title FROM '([A-Z][a-z]+mab|[A-Z][a-z]+tinib|[A-Z][a-z]+ciclib)'),
    SPLIT_PART(si.title, ' ', 1)
  ) as drug_name,

  -- Therapeutic area (from tags or default)
  CASE
    WHEN si.tags::text ILIKE '%oncology%' THEN 'Oncology'
    WHEN si.tags::text ILIKE '%pediatric%' THEN 'Pediatric Oncology'
    ELSE 'Unknown'
  END as therapeutic_area,

  -- Approval date
  si."publishedAt" as approved_date,

  -- Biomarkers (would come from analysis in production)
  NULL::text as biomarkers,

  -- Approval metadata (CRITICAL)
  si.status,
  si."updatedAt" as reviewed_at,
  'system' as approved_by,
  si."updatedAt" as approved_at,

  -- Source info
  si.id as source_item_id,
  si.url,
  si."sourceDomain",
  si.tags,
  si."createdAt",
  si."updatedAt"

FROM source_items si
WHERE
  si.status = 'APPROVED'  -- CRITICAL FILTER
  AND si.type IN ('APPROVAL', 'GUIDANCE')
  AND si.title IS NOT NULL
ORDER BY si."publishedAt" DESC;

-- ===========================================
-- View 4: vw_approved_guidance
-- ===========================================
-- FDA/EMA guidance documents

CREATE OR REPLACE VIEW vw_approved_guidance AS
SELECT
  si.id as guidance_id,
  si.url,
  si.title,
  si."publishedAt" as issued_date,

  -- Agency
  CASE
    WHEN si."sourceDomain" LIKE '%fda.gov%' THEN 'FDA'
    WHEN si."sourceDomain" LIKE '%ema.europa.eu%' THEN 'EMA'
    WHEN si."sourceDomain" LIKE '%pmda.go.jp%' THEN 'PMDA'
    ELSE 'OTHER'
  END as agency,

  -- Category (from tags or title)
  CASE
    WHEN si.title ILIKE '%pediatric%' THEN 'Pediatric'
    WHEN si.title ILIKE '%oncology%' OR si.title ILIKE '%cancer%' THEN 'Oncology'
    WHEN si.title ILIKE '%clinical trial%' THEN 'Clinical Trials'
    ELSE 'General'
  END as category,

  -- Approval metadata (CRITICAL)
  si.status,
  si."updatedAt" as reviewed_at,
  'system' as approved_by,
  si."updatedAt" as approved_at,

  -- Content
  si.tags,
  si."sourceDomain",
  si."createdAt",
  si."updatedAt"

FROM source_items si
WHERE
  si.status = 'APPROVED'  -- CRITICAL FILTER
  AND si.type = 'GUIDANCE'
  AND si."publishedAt" IS NOT NULL
ORDER BY si."publishedAt" DESC;

-- ===========================================
-- View 5: vw_approved_news
-- ===========================================
-- Press releases and news items (safety alerts, warnings)

CREATE OR REPLACE VIEW vw_approved_news AS
SELECT
  si.id as alert_id,
  si.url,
  si.title,
  si."publishedAt" as published_date,

  -- Alert type
  CASE
    WHEN si.type = 'WARNING_LETTER' THEN 'Warning Letter'
    WHEN si.type = 'UNTITLED_LETTER' THEN 'Untitled Letter'
    WHEN si.title ILIKE '%safety%' OR si.title ILIKE '%alert%' THEN 'Safety Alert'
    WHEN si.title ILIKE '%recall%' THEN 'Recall'
    ELSE 'Press Release'
  END as alert_type,

  -- Severity (from type)
  CASE
    WHEN si.type = 'WARNING_LETTER' THEN 'High'
    WHEN si.type = 'UNTITLED_LETTER' THEN 'Medium'
    WHEN si.title ILIKE '%urgent%' THEN 'High'
    ELSE 'Low'
  END as severity,

  -- Extract drug name (simplified)
  si.title as drug_name_raw,

  -- Approval metadata (CRITICAL)
  si.status,
  si."updatedAt" as reviewed_at,
  'system' as approved_by,
  si."updatedAt" as approved_at,

  -- Source info
  si."sourceDomain",
  si.tags,
  si.type as source_type,
  si."createdAt",
  si."updatedAt"

FROM source_items si
WHERE
  si.status = 'APPROVED'  -- CRITICAL FILTER
  AND si.type IN ('PRESS', 'WARNING_LETTER', 'UNTITLED_LETTER')
  AND si."publishedAt" IS NOT NULL
ORDER BY si."publishedAt" DESC;

-- ===========================================
-- Indexes for Performance
-- ===========================================

-- These views use source_items table which should already have indexes on:
-- - status (WHERE status = 'APPROVED')
-- - published_at (ORDER BY)
-- - type (WHERE type IN (...))
-- - source_domain (for agency extraction)

-- ===========================================
-- View Permissions (if needed)
-- ===========================================

-- GRANT SELECT ON vw_approved_decisions TO regintel_readonly;
-- GRANT SELECT ON vw_approved_trials TO regintel_readonly;
-- GRANT SELECT ON vw_approved_drugs TO regintel_readonly;
-- GRANT SELECT ON vw_approved_guidance TO regintel_readonly;
-- GRANT SELECT ON vw_approved_news TO regintel_readonly;

-- ===========================================
-- Validation Queries
-- ===========================================

-- Verify ONLY approved data in views:
-- SELECT COUNT(*) FROM vw_approved_decisions WHERE status != 'APPROVED'; -- Should be 0
-- SELECT COUNT(*) FROM vw_approved_trials WHERE status != 'APPROVED';    -- Should be 0
-- SELECT COUNT(*) FROM vw_approved_drugs WHERE status != 'APPROVED';     -- Should be 0
-- SELECT COUNT(*) FROM vw_approved_guidance WHERE status != 'APPROVED';  -- Should be 0
-- SELECT COUNT(*) FROM vw_approved_news WHERE status != 'APPROVED';      -- Should be 0
