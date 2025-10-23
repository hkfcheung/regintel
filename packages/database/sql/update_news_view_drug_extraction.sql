-- Update vw_approved_news to extract drug names from titles
-- This will enable NewsItems to link to Drugs in the Neo4j graph
--
-- Created: 2025-10-21
-- Purpose: Fix orphaned NewsItem nodes by extracting drug names

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

  -- **ENHANCED**: Extract drug name from title using regex patterns
  -- Pattern matching priority:
  --   1. Drug names with suffixes (mab, tinib, nib, etc.) - most reliable
  --   2. Drug names in quotes or parentheses
  --   3. Capitalized drug names followed by common patterns
  COALESCE(
    -- Pattern 1: Common drug suffixes (monoclonal antibodies, kinase inhibitors, etc.)
    SUBSTRING(title FROM '([A-Z][a-z]+(?:mab|zumab|ximab|umab|tinib|nib|ciclib|ib|isib|sib))'),

    -- Pattern 2: Drug name in parentheses with generic name
    -- Example: "Ojemda (tovorafenib)" -> extracts "Ojemda (tovorafenib)"
    SUBSTRING(title FROM '([A-Z][a-z]+\s*\([a-z]+\))'),

    -- Pattern 3: Drug name followed by "for" or "in" (common in news)
    -- Example: "Hunter syndrome drug" -> extracts relevant substring
    SUBSTRING(title FROM '([A-Z][a-z]+(?:\s+[a-z]+)?)\s+(?:drug|therapy|treatment)'),

    -- Pattern 4: Drug company + drug name pattern
    -- Example: "Denali's Hunter syndrome drug" - we try to extract the drug reference
    SUBSTRING(title FROM '([A-Z][A-Z]+\S*)\s+(?:drug|therapy)'),

    -- Fallback: NULL if no pattern matches
    NULL::text
  ) AS drug_name_raw,

  status,
  "updatedAt" AS reviewed_at,
  'system' AS approved_by,
  "updatedAt" AS approved_at,
  tags,
  "sourceDomain",
  "createdAt",
  "updatedAt"

FROM source_items
WHERE
  status IN ('APPROVED', 'REVIEW')  -- Include REVIEW for broader matching
  AND type = 'PRESS'
ORDER BY "publishedAt" DESC;

-- Test the extraction on orphaned NewsItems
-- Uncomment to verify:
-- SELECT title, drug_name_raw
-- FROM vw_approved_news
-- WHERE title LIKE '%Denali%Hunter%'
--    OR title LIKE '%ARPA-H%'
--    OR title LIKE '%GSK%'
--    OR title LIKE '%Astellas%Taysha%';
