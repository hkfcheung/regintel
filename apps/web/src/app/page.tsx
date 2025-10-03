import Link from "next/link";
import { prisma } from "@regintel/database";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getNextPollTime(lastPolledAt: Date | null, pollInterval: number): string {
  const now = new Date();

  if (!lastPolledAt) {
    // Never polled, show "Now" to indicate it will poll soon
    return "Now";
  }

  const nextPoll = new Date(lastPolledAt.getTime() + pollInterval * 1000);

  if (nextPoll <= now) {
    return "Now";
  }

  const diff = Math.floor((nextPoll.getTime() - now.getTime()) / 1000 / 60); // minutes

  if (diff < 60) {
    return `${diff}m`;
  }
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return `${hours}h ${mins}m`;
}

export default async function HomePage() {
  // Fetch recent analyzed items
  const analyses = await prisma.analysis.findMany({
    include: {
      sourceItem: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 5,
  });

  // Fetch RSS feed status
  const feeds = await prisma.rssFeed.findMany({
    where: { active: true },
    orderBy: { lastPolledAt: "desc" },
  });

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">
          Regulatory Intelligence Platform
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Curated weekly feed from authoritative sources with actionable insights
        </p>

        <div className="grid gap-6">
          <Link href="/sources" className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
            <h2 className="text-2xl font-semibold mb-2">Browse Source Items</h2>
            <p className="text-gray-600">View all ingested regulatory content</p>
          </Link>

          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">RSS Feed Status</h2>
            {feeds.length === 0 ? (
              <p className="text-gray-600">No active feeds configured</p>
            ) : (
              <div className="space-y-3">
                {feeds.map((feed) => (
                  <div key={feed.id} className="flex justify-between items-center border-b border-gray-100 last:border-0 pb-3 last:pb-0">
                    <div className="flex-1">
                      <h3 className="font-medium text-sm">{feed.title}</h3>
                      <p className="text-xs text-gray-500">{feed.url}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xs text-gray-600">
                        Poll every {formatDuration(feed.pollInterval)}
                      </p>
                      <p className="text-xs font-medium text-blue-600">
                        Next: {getNextPollTime(feed.lastPolledAt, feed.pollInterval)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">This Week in Regulatory</h2>
            {analyses.length === 0 ? (
              <p className="text-gray-600">No analyzed content yet</p>
            ) : (
              <div className="space-y-4">
                {analyses.map((analysis) => (
                  <div key={analysis.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                    <Link href={`/sources/${analysis.sourceItem.id}`} className="hover:text-blue-600">
                      <h3 className="font-semibold mb-1">{analysis.sourceItem.title}</h3>
                    </Link>
                    <p className="text-sm text-gray-600 mb-2">{analysis.sourceItem.sourceDomain}</p>
                    <div className="text-sm text-gray-700 prose prose-sm">
                      {analysis.summaryMd.slice(0, 200)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
