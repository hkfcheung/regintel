import { prisma } from "@regintel/database";
import { HomeContent } from "./home-content";

export default async function HomePage() {
  // Fetch recent analyzed items (fetch more to support filtering)
  const analyses = await prisma.analysis.findMany({
    include: {
      sourceItem: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });

  // Fetch RSS feed status
  const feeds = await prisma.rssFeed.findMany({
    where: { active: true },
    orderBy: { lastPolledAt: "desc" },
  });

  // Get today's ingestion counts per RSS feed
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaysCounts = await prisma.sourceItem.groupBy({
    by: ["rssFeedId"],
    where: {
      createdAt: {
        gte: today,
      },
    },
    _count: {
      id: true,
    },
  });

  // Create a map of rssFeedId -> count
  const countsByFeed = new Map<string, number>();

  todaysCounts.forEach((item) => {
    if (item.rssFeedId) {
      countsByFeed.set(item.rssFeedId, item._count.id);
    }
  });

  // For items without rssFeedId (old items), match by domain
  const nullCount = todaysCounts.find((item) => item.rssFeedId === null);
  if (nullCount && nullCount._count.id > 0) {
    // Get domain-based counts for items without rssFeedId
    const domainCounts = await prisma.sourceItem.groupBy({
      by: ["sourceDomain"],
      where: {
        createdAt: {
          gte: today,
        },
        rssFeedId: null,
      },
      _count: {
        id: true,
      },
    });

    // Match domains to feeds and add to counts
    const domainCountMap = new Map(
      domainCounts.map((item) => [item.sourceDomain, item._count.id])
    );

    feeds.forEach((feed) => {
      try {
        const url = new URL(feed.url);
        const domain = url.hostname.replace(/^www\./, "");

        const domainCount =
          domainCountMap.get(url.hostname) ||
          domainCountMap.get(domain) ||
          domainCountMap.get(`www.${domain}`) ||
          0;

        if (domainCount > 0) {
          const currentCount = countsByFeed.get(feed.id) || 0;
          countsByFeed.set(feed.id, currentCount + domainCount);
        }
      } catch (error) {
        // Invalid URL, skip
      }
    });
  }

  // Add counts to feeds
  const feedsWithCounts = feeds.map((feed) => ({
    ...feed,
    todaysIngestions: countsByFeed.get(feed.id) || 0,
  }));

  // Fetch today's source items (for filtered view)
  const todaysSourceItems = await prisma.sourceItem.findMany({
    where: {
      createdAt: {
        gte: today,
      },
      rssFeedId: {
        not: null,
      },
    },
    include: {
      analyses: {
        select: {
          id: true,
          summaryMd: true,
        },
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Fetch appearance config
  const appearanceConfigs = await prisma.appConfig.findMany({
    where: {
      category: "appearance",
    },
  });

  const backgroundEnabled = appearanceConfigs.find((c) => c.key === "backgroundEnabled")?.value || "true";
  const backgroundType = appearanceConfigs.find((c) => c.key === "backgroundType")?.value || "gradient";
  const backgroundGradient = appearanceConfigs.find((c) => c.key === "backgroundGradient")?.value || "from-gray-50 via-blue-50/30 to-teal-50/20";
  const backgroundCirclesJson = appearanceConfigs.find((c) => c.key === "backgroundCircles")?.value || '[{"size":"w-96 h-96","color":"bg-blue-100/20","position":"-top-40 -right-40"},{"size":"w-80 h-80","color":"bg-teal-100/20","position":"top-1/2 -left-40"},{"size":"w-96 h-96","color":"bg-indigo-100/20","position":"-bottom-40 right-1/3"}]';
  const backgroundImage = appearanceConfigs.find((c) => c.key === "backgroundImage")?.value || "";

  let backgroundCircles = [];
  try {
    backgroundCircles = JSON.parse(backgroundCirclesJson);
  } catch (e) {
    console.error("Failed to parse background circles:", e);
  }

  return (
    <main className="min-h-screen p-8 relative overflow-hidden">
      {backgroundEnabled === "true" && (
        <>
          {backgroundType === "image" && backgroundImage ? (
            /* Background image */
            <div
              className="absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${backgroundImage})` }}
            />
          ) : (
            <>
              {/* Subtle background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${backgroundGradient} -z-10`} />

              {/* Decorative elements */}
              {backgroundCircles.length > 0 && (
                <div className="absolute inset-0 -z-10 overflow-hidden">
                  {backgroundCircles.map((circle: any, index: number) => (
                    <div
                      key={index}
                      className={`absolute ${circle.size} ${circle.color} ${circle.position} rounded-full blur-3xl`}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <div className="max-w-7xl mx-auto relative">
        <h1 className="text-4xl font-bold mb-4">
          Regulatory Intelligence Platform
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Curated weekly feed from authoritative sources with actionable insights
        </p>

        <HomeContent
          feeds={feedsWithCounts}
          analyses={analyses}
          todaysSourceItems={todaysSourceItems}
        />
      </div>
    </main>
  );
}
