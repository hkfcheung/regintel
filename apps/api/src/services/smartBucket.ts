import { prisma } from "@regintel/database";

interface DocumentMetadata {
  sourceItemId: string;
  domain: string;
  title: string;
  url: string;
  classification?: string;
  pediatricRelevance?: boolean;
  analyzedAt: string;
  summary: string;
  impact: string;
  pediatricDetails?: any;
}

interface SearchResult {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  score: number;
}

/**
 * SmartBucket Service - Simple implementation using database storage
 *
 * Note: This is a simplified version that stores documents in the database.
 * For full SmartBucket capabilities (semantic search with embeddings),
 * you would need to integrate with Raindrop MCP through a separate service.
 *
 * Current capabilities:
 * - Store approved documents with metadata
 * - Text-based search across stored documents
 * - Similar document discovery based on content matching
 */
export class SmartBucketService {
  async initialize() {
    // No initialization needed for database-backed version
    console.log("SmartBucket service initialized (database-backed)");
  }

  async storeDocument(params: {
    sourceItemId: string;
    title: string;
    url: string;
    domain: string;
    content: string;
    summary: string;
    impact: string;
    classification?: string;
    pediatricDetails?: any;
  }): Promise<boolean> {
    try {
      // Document already exists in database as APPROVED sourceItem
      // We're just marking it as "in knowledge base" by ensuring it exists
      const sourceItem = await prisma.sourceItem.findUnique({
        where: { id: params.sourceItemId },
      });

      if (!sourceItem) {
        console.error(`Source item ${params.sourceItemId} not found`);
        return false;
      }

      // The document is already stored - just log success
      console.log(`Document ${params.sourceItemId} confirmed in knowledge base`);
      return true;
    } catch (error) {
      console.error("Error storing document:", error);
      return false;
    }
  }

  async searchDocuments(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      // Get all approved documents with their analyses
      const items = await prisma.sourceItem.findMany({
        where: {
          status: "APPROVED",
        },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { fetchedAt: "desc" },
      });

      const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);
      const results: SearchResult[] = [];

      for (const item of items) {
        const analysis = item.analyses[0];
        if (!analysis) continue;

        let modelMeta: any = {};
        try {
          modelMeta = typeof analysis.modelMeta === 'string'
            ? JSON.parse(analysis.modelMeta)
            : analysis.modelMeta || {};
        } catch (e) {
          // ignore
        }

        // Search in title, summary, and impact
        const searchableText = `${item.title} ${analysis.summaryMd || ""} ${analysis.impactMd || ""}`.toLowerCase();

        // Calculate relevance score based on term matches
        const matchCount = searchTerms.reduce((count, term) => {
          const matches = (searchableText.match(new RegExp(term, 'gi')) || []).length;
          return count + matches;
        }, 0);

        // Only include if there's at least one match
        if (matchCount > 0) {
          const score = Math.min(matchCount / (searchTerms.length * 3), 1); // Normalize to 0-1

          results.push({
            id: item.id,
            content: analysis.summaryMd || "",
            metadata: {
              sourceItemId: item.id,
              domain: item.sourceDomain,
              title: item.title,
              url: item.url,
              classification: modelMeta.classification,
              pediatricRelevance: true,
              analyzedAt: item.fetchedAt.toISOString(),
              summary: analysis.summaryMd || "",
              impact: analysis.impactMd || "",
              pediatricDetails: modelMeta.pediatric_details,
            },
            score,
          });
        }
      }

      // Sort by score descending and limit results
      return results.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error("Error searching documents:", error);
      return [];
    }
  }

  async findSimilarDocuments(sourceItemId: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      // Get the source document
      const sourceItem = await prisma.sourceItem.findUnique({
        where: { id: sourceItemId },
        include: {
          analyses: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      });

      if (!sourceItem || !sourceItem.analyses[0]) {
        return [];
      }

      const analysis = sourceItem.analyses[0];

      // Use title and summary for similarity search
      const searchQuery = `${sourceItem.title} ${analysis.summaryMd}`.substring(0, 500);

      // Search for similar documents
      const results = await this.searchDocuments(searchQuery, limit + 1);

      // Filter out the source document itself
      return results.filter(r => r.id !== sourceItemId).slice(0, limit);
    } catch (error) {
      console.error("Error finding similar documents:", error);
      return [];
    }
  }

  async getDocumentCount(): Promise<number> {
    try {
      const count = await prisma.sourceItem.count({
        where: { status: "APPROVED" },
      });
      return count;
    } catch (error) {
      console.error("Error getting document count:", error);
      return 0;
    }
  }
}

// Singleton instance
let smartBucketService: SmartBucketService | null = null;

export function getSmartBucketService(): SmartBucketService {
  if (!smartBucketService) {
    smartBucketService = new SmartBucketService();
  }
  return smartBucketService;
}
