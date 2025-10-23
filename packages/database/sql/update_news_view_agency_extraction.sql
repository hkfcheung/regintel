-- Update vw_approved_news to extract agency names from titles
-- This will enable NewsItems to link to Agency nodes even when from third-party sources
--
-- Created: 2025-10-21
-- Purpose: Connect news articles to regulatory agencies mentioned in titles

CREATE OR REPLACE VIEW vw_approved_news AS
SELECT
  id AS alert_id,
  id AS news_id,
  url,
  title,
  "publishedAt" AS published_date,

  -- Alert type classification
  CASE
    WHEN title ~~* '%recall%' OR title ~~* '%warning%' OR title ~~* '%safety%' THEN 'Safety Alert'
    WHEN title ~~* '%approval%' THEN 'Approval'
    WHEN title ~~* '%meeting%' THEN 'Meeting'
    ELSE 'General'
  END AS alert_type,

  -- Severity classification
  CASE
    WHEN title ~~* '%recall%' OR title ~~* '%warning%' THEN 'Medium'
    WHEN title ~~* '%safety communication%' THEN 'High'
    ELSE 'Low'
  END AS severity,

  -- Extract drug name from title using regex patterns
  COALESCE(
    SUBSTRING(title FROM '([A-Z][a-z]+(?:mab|zumab|ximab|umab|tinib|nib|ciclib|ib|isib|sib))'),
    SUBSTRING(title FROM '([A-Z][a-z]+\s*\([a-z]+\))'),
    SUBSTRING(title FROM '([A-Z][a-z]+(?:\s+[a-z]+)?)\s+(?:drug|therapy|treatment)'),
    SUBSTRING(title FROM '([A-Z][A-Z]+\S*)\s+(?:drug|therapy)'),
    NULL::text
  ) AS drug_name_raw,

  status,
  "updatedAt" AS reviewed_at,
  'system' AS approved_by,
  "updatedAt" AS approved_at,
  tags,
  "sourceDomain",

  -- **NEW**: Extract agency from title for relationship mapping
  -- This allows third-party news to be linked to Agency nodes
  CASE
    -- First check domain (most reliable)
    WHEN "sourceDomain" LIKE '%fda.gov%' THEN 'FDA'
    WHEN "sourceDomain" LIKE '%ema.europa.eu%' THEN 'EMA'
    WHEN "sourceDomain" LIKE '%pmda.go.jp%' THEN 'PMDA'

    -- Then check title for agency mentions (using simple case-insensitive regex)
    WHEN title ~* 'FDA' OR title ~* 'Food and Drug Administration' THEN 'FDA'
    WHEN title ~* 'EMA' OR title ~* 'European Medicines Agency' THEN 'EMA'
    WHEN title ~* 'PMDA' OR title ~* 'Pharmaceuticals and Medical Devices Agency' THEN 'PMDA'

    -- Fallback for other domains
    ELSE 'OTHER'
  END as agency,

  "createdAt",
  "updatedAt"

FROM source_items
WHERE
  status IN ('APPROVED', 'REVIEW')
  AND type = 'PRESS'
ORDER BY "publishedAt" DESC;

-- Test the agency extraction
-- Uncomment to verify:
-- SELECT title, agency, "sourceDomain"
-- FROM vw_approved_news
-- WHERE title LIKE '%FDA%'
--    OR title LIKE '%EMA%'
--    OR title LIKE '%PMDA%'
-- ORDER BY title;
