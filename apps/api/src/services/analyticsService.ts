import { prisma } from "@regintel/database";
import { subDays, startOfDay, endOfDay, format } from "date-fns";

export interface OverviewStats {
  totalItems: number;
  totalFeeds: number;
  totalAlerts: number;
  totalUsers: number;
  itemsToday: number;
  itemsThisWeek: number;
  itemsThisMonth: number;
}

export interface TimeSeriesData {
  date: string;
  count: number;
  approved?: number;
  pending?: number;
  rejected?: number;
}

export interface DistributionData {
  name: string;
  value: number;
  percentage?: number;
}

export interface FeedAnalytics {
  feedId: string;
  feedTitle: string;
  totalItems: number;
  itemsToday: number;
  itemsThisWeek: number;
  lastPolled: Date | null;
  avgItemsPerDay: number;
}

/**
 * Get overview statistics
 */
export async function getOverviewStats(): Promise<OverviewStats> {
  const now = new Date();
  const today = startOfDay(now);
  const weekAgo = subDays(today, 7);
  const monthAgo = subDays(today, 30);

  const [totalItems, totalFeeds, totalAlerts, totalUsers, itemsToday, itemsThisWeek, itemsThisMonth] =
    await Promise.all([
      prisma.sourceItem.count(),
      prisma.rSSFeed.count(),
      prisma.userAlert.count(),
      prisma.user.count(),
      prisma.sourceItem.count({
        where: {
          publishedAt: { gte: today },
        },
      }),
      prisma.sourceItem.count({
        where: {
          publishedAt: { gte: weekAgo },
        },
      }),
      prisma.sourceItem.count({
        where: {
          publishedAt: { gte: monthAgo },
        },
      }),
    ]);

  return {
    totalItems,
    totalFeeds,
    totalAlerts,
    totalUsers,
    itemsToday,
    itemsThisWeek,
    itemsThisMonth,
  };
}

/**
 * Get time series data for the past N days
 */
export async function getTimeSeriesData(days: number = 30): Promise<TimeSeriesData[]> {
  const startDate = startOfDay(subDays(new Date(), days));

  const items = await prisma.sourceItem.findMany({
    where: {
      publishedAt: { gte: startDate },
    },
    select: {
      publishedAt: true,
      reviewStatus: true,
    },
    orderBy: {
      publishedAt: "asc",
    },
  });

  // Group by date
  const dateMap = new Map<string, { count: number; approved: number; pending: number; rejected: number }>();

  // Initialize all dates in range
  for (let i = 0; i < days; i++) {
    const date = format(subDays(new Date(), days - i - 1), "yyyy-MM-dd");
    dateMap.set(date, { count: 0, approved: 0, pending: 0, rejected: 0 });
  }

  // Aggregate items by date
  items.forEach((item) => {
    const date = format(item.publishedAt, "yyyy-MM-dd");
    const existing = dateMap.get(date) || { count: 0, approved: 0, pending: 0, rejected: 0 };
    existing.count++;

    if (item.reviewStatus === "APPROVED") existing.approved++;
    else if (item.reviewStatus === "PENDING") existing.pending++;
    else if (item.reviewStatus === "REJECTED") existing.rejected++;

    dateMap.set(date, existing);
  });

  // Convert to array
  return Array.from(dateMap.entries()).map(([date, data]) => ({
    date,
    ...data,
  }));
}

/**
 * Get distribution by type
 */
export async function getTypeDistribution(): Promise<DistributionData[]> {
  const items = await prisma.sourceItem.groupBy({
    by: ["type"],
    _count: {
      id: true,
    },
  });

  const total = items.reduce((sum, item) => sum + item._count.id, 0);

  return items.map((item) => ({
    name: item.type || "Unknown",
    value: item._count.id,
    percentage: total > 0 ? Math.round((item._count.id / total) * 100) : 0,
  }));
}

/**
 * Get distribution by region
 */
export async function getRegionDistribution(): Promise<DistributionData[]> {
  const items = await prisma.sourceItem.groupBy({
    by: ["region"],
    _count: {
      id: true,
    },
  });

  const total = items.reduce((sum, item) => sum + item._count.id, 0);

  return items.map((item) => ({
    name: item.region || "Unknown",
    value: item._count.id,
    percentage: total > 0 ? Math.round((item._count.id / total) * 100) : 0,
  }));
}

/**
 * Get top tags
 */
export async function getTopTags(limit: number = 20): Promise<DistributionData[]> {
  // Get all items with tags
  const items = await prisma.sourceItem.findMany({
    select: {
      tags: true,
    },
  });

  // Count tag occurrences
  const tagCounts = new Map<string, number>();

  items.forEach((item) => {
    if (Array.isArray(item.tags)) {
      item.tags.forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    }
  });

  // Convert to array and sort
  const tagArray = Array.from(tagCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);

  const total = tagArray.reduce((sum, tag) => sum + tag.value, 0);

  return tagArray.map((tag) => ({
    ...tag,
    percentage: total > 0 ? Math.round((tag.value / total) * 100) : 0,
  }));
}

/**
 * Get feed analytics
 */
export async function getFeedAnalytics(): Promise<FeedAnalytics[]> {
  const feeds = await prisma.rSSFeed.findMany({
    select: {
      id: true,
      title: true,
      lastPolledAt: true,
    },
  });

  const now = new Date();
  const today = startOfDay(now);
  const weekAgo = subDays(today, 7);

  const feedStats = await Promise.all(
    feeds.map(async (feed) => {
      const [totalItems, itemsToday, itemsThisWeek, oldestItem] = await Promise.all([
        prisma.sourceItem.count({
          where: { rssFeedId: feed.id },
        }),
        prisma.sourceItem.count({
          where: {
            rssFeedId: feed.id,
            publishedAt: { gte: today },
          },
        }),
        prisma.sourceItem.count({
          where: {
            rssFeedId: feed.id,
            publishedAt: { gte: weekAgo },
          },
        }),
        prisma.sourceItem.findFirst({
          where: { rssFeedId: feed.id },
          orderBy: { publishedAt: "asc" },
          select: { publishedAt: true },
        }),
      ]);

      // Calculate average items per day
      let avgItemsPerDay = 0;
      if (oldestItem) {
        const daysSinceOldest = Math.max(
          1,
          Math.floor((now.getTime() - oldestItem.publishedAt.getTime()) / (1000 * 60 * 60 * 24))
        );
        avgItemsPerDay = totalItems / daysSinceOldest;
      }

      return {
        feedId: feed.id,
        feedTitle: feed.title,
        totalItems,
        itemsToday,
        itemsThisWeek,
        lastPolled: feed.lastPolledAt,
        avgItemsPerDay: Math.round(avgItemsPerDay * 10) / 10, // Round to 1 decimal
      };
    })
  );

  return feedStats.sort((a, b) => b.totalItems - a.totalItems);
}

/**
 * Get review status distribution
 */
export async function getReviewStatusDistribution(): Promise<DistributionData[]> {
  const items = await prisma.sourceItem.groupBy({
    by: ["reviewStatus"],
    _count: {
      id: true,
    },
  });

  const total = items.reduce((sum, item) => sum + item._count.id, 0);

  return items.map((item) => ({
    name: item.reviewStatus,
    value: item._count.id,
    percentage: total > 0 ? Math.round((item._count.id / total) * 100) : 0,
  }));
}

/**
 * Get source distribution (by domain)
 */
export async function getSourceDistribution(limit: number = 10): Promise<DistributionData[]> {
  const items = await prisma.sourceItem.findMany({
    select: {
      source: true,
    },
  });

  // Extract domain from source
  const domainCounts = new Map<string, number>();

  items.forEach((item) => {
    try {
      const url = new URL(item.source);
      const domain = url.hostname.replace(/^www\./, "");
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    } catch {
      domainCounts.set("Unknown", (domainCounts.get("Unknown") || 0) + 1);
    }
  });

  // Convert to array and sort
  const domainArray = Array.from(domainCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);

  const total = domainArray.reduce((sum, domain) => sum + domain.value, 0);

  return domainArray.map((domain) => ({
    ...domain,
    percentage: total > 0 ? Math.round((domain.value / total) * 100) : 0,
  }));
}
