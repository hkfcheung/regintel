/**
 * Raindrop MCP Client Integration
 *
 * This service provides a typed interface to the Raindrop MCP server.
 * Collections: RegIntel / Intake, RegIntel / Approved, RegIntel / Rejected
 * Tags: source:fda, type:<type>, week:YYYY-WW, status:<status>
 */

interface RaindropBookmark {
  id: string;
  url: string;
  title: string;
  excerpt?: string;
  tags: string[];
  created: string;
}

interface CreateBookmarkParams {
  url: string;
  title: string;
  excerpt?: string;
  collection: "intake" | "approved" | "rejected";
  tags: string[];
}

interface UpdateBookmarkParams {
  id: string;
  collection?: "intake" | "approved" | "rejected";
  tags?: string[];
}

/**
 * Collection name mapping
 */
const COLLECTIONS = {
  intake: "RegIntel / Intake",
  approved: "RegIntel / Approved",
  rejected: "RegIntel / Rejected",
} as const;

export class RaindropService {
  private apiToken: string;
  private baseUrl = "https://api.raindrop.io/rest/v1";

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.RAINDROP_API_TOKEN || "";
    if (!this.apiToken) {
      console.warn("⚠️  RAINDROP_API_TOKEN not set - MCP integration disabled");
    }
  }

  /**
   * Check if Raindrop MCP is available
   */
  async isAvailable(): Promise<boolean> {
    if (!this.apiToken) return false;

    try {
      const response = await fetch(`${this.baseUrl}/user`, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });
      return response.ok;
    } catch (error) {
      console.error("Raindrop health check failed:", error);
      return false;
    }
  }

  /**
   * Create a bookmark in a collection with tags
   */
  async createBookmark(params: CreateBookmarkParams): Promise<RaindropBookmark | null> {
    if (!this.apiToken) {
      console.warn("Skipping Raindrop bookmark creation (no token)");
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/raindrop`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          link: params.url,
          title: params.title,
          excerpt: params.excerpt,
          tags: params.tags,
          collection: { $ref: COLLECTIONS[params.collection] },
        }),
      });

      if (!response.ok) {
        throw new Error(`Raindrop API error: ${response.statusText}`);
      }

      const data: any = await response.json();
      return data.item as RaindropBookmark;
    } catch (error) {
      console.error("Failed to create Raindrop bookmark:", error);
      return null;
    }
  }

  /**
   * Update bookmark collection and/or tags
   */
  async updateBookmark(params: UpdateBookmarkParams): Promise<boolean> {
    if (!this.apiToken) {
      console.warn("Skipping Raindrop bookmark update (no token)");
      return false;
    }

    try {
      const body: any = {};
      if (params.collection) {
        body.collection = { $ref: COLLECTIONS[params.collection] };
      }
      if (params.tags) {
        body.tags = params.tags;
      }

      const response = await fetch(`${this.baseUrl}/raindrop/${params.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to update Raindrop bookmark:", error);
      return false;
    }
  }

  /**
   * Search for bookmark by URL to check for duplicates
   */
  async findByUrl(url: string): Promise<RaindropBookmark | null> {
    if (!this.apiToken) return null;

    try {
      const response = await fetch(
        `${this.baseUrl}/raindrops/0?search=${encodeURIComponent(url)}`,
        {
          headers: { Authorization: `Bearer ${this.apiToken}` },
        }
      );

      if (!response.ok) return null;

      const data: any = await response.json();
      const items = data.items as RaindropBookmark[];
      return items.find((item) => item.url === url) || null;
    } catch (error) {
      console.error("Failed to search Raindrop:", error);
      return null;
    }
  }

  /**
   * Build tag array for source item
   */
  static buildTags(params: {
    source: string;
    type: string;
    week: string;
    status: "intake" | "approved" | "rejected";
  }): string[] {
    return [
      `source:${params.source}`,
      `type:${params.type}`,
      `week:${params.week}`,
      `status:${params.status}`,
    ];
  }
}
