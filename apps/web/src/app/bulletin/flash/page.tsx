import Link from "next/link";
import { prisma } from "@regintel/database";

// Map domains to regions
function getRegion(sourceDomain: string): string {
  const domain = sourceDomain.toLowerCase();

  if (domain.includes("fda.gov")) {
    return "US";
  }
  if (domain.includes("ema.europa.eu") || domain.includes("europa.eu")) {
    return "EU";
  }
  if (domain.includes("pmda.go.jp") || domain.includes("mhlw.go.jp")) {
    return "Japan";
  }

  return "International";
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function RegIntelFlashPage() {
  // Fetch approved articles with their analyses
  const approvedItems = await prisma.sourceItem.findMany({
    where: {
      status: "APPROVED",
    },
    include: {
      analyses: {
        select: {
          id: true,
          summaryMd: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 100, // Limit to recent 100 approved items
  });

  // Group items by region
  const itemsByRegion = approvedItems.reduce((acc, item) => {
    const region = getRegion(item.sourceDomain);
    if (!acc[region]) {
      acc[region] = [];
    }
    acc[region].push(item);
    return acc;
  }, {} as Record<string, typeof approvedItems>);

  // Define region order
  const regionOrder = ["US", "EU", "Japan", "International"];

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-teal-600 text-white rounded-t-lg p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <svg
              className="w-12 h-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h1 className="text-4xl font-bold">Regulatory Intelligence Bulletin</h1>
          </div>
          <Link
            href="/"
            className="inline-block bg-white text-teal-700 px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors"
          >
            Access The Reg Intel Dashboard Here
          </Link>
        </div>

        {/* Content */}
        <div className="bg-white rounded-b-lg shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
            {/* Main content - 2 columns */}
            <div className="lg:col-span-2 space-y-10">
              {regionOrder.map((region) => {
                const items = itemsByRegion[region] || [];
                if (items.length === 0) return null;

                return (
                  <div key={region}>
                    <h2 className="text-2xl font-bold text-teal-700 mb-4 pb-2 border-b-2 border-teal-700">
                      {region}
                    </h2>
                    <ol className="space-y-4 list-decimal list-inside">
                      {items.slice(0, 5).map((item, index) => (
                        <li key={item.id} className="text-teal-600 font-medium">
                          <Link
                            href={`/bulletin/flash/${item.id}`}
                            className="text-teal-600 hover:text-teal-800 hover:underline"
                          >
                            {item.title}
                          </Link>
                          {item.analyses[0] && (
                            <p className="text-gray-700 text-sm ml-6 mt-1 font-normal">
                              {item.analyses[0].summaryMd.slice(0, 200)}...{" "}
                              <Link
                                href={`/bulletin/flash/${item.id}`}
                                className="text-teal-600 hover:underline font-medium"
                              >
                                Read more
                              </Link>
                              .
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>

            {/* Sidebar - 1 column */}
            <div className="space-y-8">
              {regionOrder.map((region) => {
                const items = itemsByRegion[region] || [];
                // Show items 6-10 in sidebar
                const sidebarItems = items.slice(5, 10);
                if (sidebarItems.length === 0) return null;

                return (
                  <div key={`sidebar-${region}`}>
                    <div className="border-t-4 border-gray-200 pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        {region === "Japan" && (
                          <span className="text-2xl">🇯🇵</span>
                        )}
                        {region === "US" && (
                          <span className="text-2xl">🇺🇸</span>
                        )}
                        {region === "EU" && (
                          <span className="text-2xl">🇪🇺</span>
                        )}
                        <h3 className="text-lg font-bold">{region}</h3>
                      </div>
                      <div className="space-y-6">
                        {sidebarItems.map((item) => (
                          <div key={item.id} className="border-b border-gray-200 pb-4 last:border-0">
                            <Link
                              href={`/bulletin/flash/${item.id}`}
                              className="block hover:text-teal-600"
                            >
                              <h4 className="font-semibold mb-2">{item.title}</h4>
                            </Link>
                            <p className="text-xs text-gray-500 mb-2">
                              {item.sourceDomain} / {formatDate(item.publishedAt)}
                            </p>
                            {item.analyses[0] && (
                              <p className="text-sm text-gray-700">
                                {item.analyses[0].summaryMd.slice(0, 150)}...
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Abstract art section */}
              <div className="border-t-4 border-gray-200 pt-4">
                <h3 className="text-lg font-bold mb-4">International</h3>
                <div className="bg-gradient-to-br from-red-400 via-purple-500 to-blue-500 rounded-lg h-48 flex items-center justify-center text-white">
                  <svg className="w-32 h-32 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Table of Contents */}
          <div className="bg-teal-700 text-white p-6 rounded-b-lg">
            <h3 className="text-xl font-bold mb-4">Table of contents</h3>
            <div className="flex flex-wrap gap-6 text-sm">
              {regionOrder.map((region) => {
                const count = itemsByRegion[region]?.length || 0;
                if (count === 0) return null;
                return (
                  <a key={region} href={`#${region}`} className="hover:underline">
                    {region}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
