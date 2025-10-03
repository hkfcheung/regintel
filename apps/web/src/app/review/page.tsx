import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@regintel/database";
import Link from "next/link";
import { ReviewActions } from "./review-actions";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "REVIEWER" && session.user.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;
  const filter = params.filter || "review";

  // Fetch items based on filter
  const statusFilter = filter === "rejected" ? "REJECTED" : "REVIEW";

  const reviewItems = await prisma.sourceItem.findMany({
    where: {
      status: statusFilter,
    },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { fetchedAt: "desc" },
  });

  // Get counts for both statuses
  const [reviewCount, rejectedCount] = await Promise.all([
    prisma.sourceItem.count({ where: { status: "REVIEW" } }),
    prisma.sourceItem.count({ where: { status: "REJECTED" } }),
  ]);

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Review Queue</h1>
          <p className="mt-2 text-gray-600">
            Review and approve pediatric oncology intelligence items before publication
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <a
              href="/review?filter=review"
              className={`${
                filter === "review"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Pending Review
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-yellow-100 text-yellow-800">
                {reviewCount}
              </span>
            </a>
            <a
              href="/review?filter=rejected"
              className={`${
                filter === "rejected"
                  ? "border-red-500 text-red-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Rejected Items
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-red-100 text-red-800">
                {rejectedCount}
              </span>
            </a>
          </nav>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">
              {filter === "rejected" ? "Rejected Items" : "Items Pending Review"}
            </p>
            <p className={`text-2xl font-bold ${filter === "rejected" ? "text-red-600" : "text-yellow-600"}`}>
              {reviewItems.length}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Your Role</p>
            <p className="text-2xl font-bold text-blue-600">{session.user.role}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Reviewer</p>
            <p className="text-lg font-medium text-gray-900 truncate">{session.user.email}</p>
          </div>
        </div>

        {/* Review Items */}
        {reviewItems.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">
              {filter === "rejected" ? "🚫" : "✅"}
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {filter === "rejected" ? "No Rejected Items" : "No Items in Review Queue"}
            </h2>
            <p className="text-gray-600">
              {filter === "rejected"
                ? "No items have been rejected yet."
                : "All analyzed items have been reviewed. Check back later for new items."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewItems.map((item) => {
              const analysis = item.analyses[0];
              let modelMeta: any = {};
              try {
                modelMeta = typeof analysis?.modelMeta === 'string'
                  ? JSON.parse(analysis.modelMeta)
                  : analysis?.modelMeta || {};
              } catch (e) {
                // ignore parse errors
              }

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                >
                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-3 break-all">
                          {item.url}
                        </p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">
                            {item.type}
                          </span>
                          <span className="text-gray-500">
                            {item.sourceDomain}
                          </span>
                          <span className="text-gray-500">
                            Fetched: {new Date(item.fetchedAt).toLocaleDateString()}
                          </span>
                          {modelMeta.classification && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                              {modelMeta.classification}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Analysis */}
                    {analysis && (
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <h4 className="font-semibold text-gray-900 mb-3">
                          AI-Generated Pediatric Oncology Analysis
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {/* Summary */}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">
                              Summary
                            </h5>
                            <p className="text-sm text-gray-900">
                              {analysis.summaryMd}
                            </p>
                          </div>

                          {/* Impact */}
                          <div className="bg-yellow-50 rounded-lg p-4">
                            <h5 className="text-sm font-semibold text-yellow-900 mb-2">
                              Impact on Day One
                            </h5>
                            <p className="text-sm text-yellow-900">
                              {analysis.impactMd}
                            </p>
                          </div>
                        </div>

                        {/* Pediatric Details */}
                        {modelMeta.pediatric_details && (
                          <div className="bg-blue-50 rounded-lg p-4 mb-4">
                            <h5 className="text-sm font-semibold text-blue-900 mb-2">
                              Pediatric Details
                            </h5>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              {modelMeta.pediatric_details.age_groups?.length > 0 && (
                                <div>
                                  <span className="font-medium text-blue-800">Age Groups: </span>
                                  <span className="text-blue-900">
                                    {modelMeta.pediatric_details.age_groups.join(", ")}
                                  </span>
                                </div>
                              )}
                              {modelMeta.pediatric_details.dosing && (
                                <div>
                                  <span className="font-medium text-blue-800">Dosing: </span>
                                  <span className="text-blue-900">
                                    {modelMeta.pediatric_details.dosing}
                                  </span>
                                </div>
                              )}
                              {modelMeta.pediatric_details.safety_outcomes && (
                                <div className="col-span-2">
                                  <span className="font-medium text-blue-800">Safety: </span>
                                  <span className="text-blue-900">
                                    {modelMeta.pediatric_details.safety_outcomes}
                                  </span>
                                </div>
                              )}
                              {modelMeta.pediatric_details.efficacy_data && (
                                <div className="col-span-2">
                                  <span className="font-medium text-blue-800">Efficacy: </span>
                                  <span className="text-blue-900">
                                    {modelMeta.pediatric_details.efficacy_data}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="border-t border-gray-200 pt-4 mt-4 flex items-center justify-between">
                      <Link
                        href={`/sources/${item.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View Full Details →
                      </Link>
                      <ReviewActions sourceItemId={item.id} status={item.status} userId={session.user.id} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
