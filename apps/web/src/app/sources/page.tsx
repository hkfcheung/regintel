import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@regintel/database";
import Link from "next/link";
import { FilterControls } from "./filter-controls";

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const params = await searchParams;
  const statusFilter = params.status;
  const typeFilter = params.type;

  // Build filter
  const where: any = {};
  if (statusFilter) {
    where.status = statusFilter;
  }
  if (typeFilter) {
    where.type = typeFilter;
  }

  // Fetch source items
  const sources = await prisma.sourceItem.findMany({
    where,
    orderBy: { fetchedAt: "desc" },
    take: 50,
  });

  // Get counts for filters
  const statusCounts = await prisma.sourceItem.groupBy({
    by: ["status"],
    _count: true,
  });

  const typeCounts = await prisma.sourceItem.groupBy({
    by: ["type"],
    _count: true,
  });

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Source Items</h1>
          <p className="mt-2 text-gray-600">
            Browse and manage ingested regulatory content
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Items</p>
            <p className="text-2xl font-bold text-gray-900">{sources.length}</p>
          </div>
          {statusCounts.slice(0, 3).map((stat) => (
            <div
              key={stat.status}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <p className="text-sm text-gray-600 capitalize">
                {stat.status.toLowerCase()}
              </p>
              <p className="text-2xl font-bold text-gray-900">{stat._count}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <FilterControls statusCounts={statusCounts} typeCounts={typeCounts} />
        </div>

        {/* Source Items List */}
        <div className="bg-white rounded-lg border border-gray-200">
          {sources.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600">No source items found.</p>
              {session.user.role === "ADMIN" && (
                <Link
                  href="/admin/ingest"
                  className="mt-4 inline-block text-blue-600 hover:text-blue-700"
                >
                  Ingest your first URL →
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sources.map((source) => (
                <Link
                  key={source.id}
                  href={`/sources/${source.id}`}
                  className="block p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {source.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 truncate">
                        {source.url}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span
                          className={`px-2 py-1 rounded font-medium ${
                            source.status === "INTAKE"
                              ? "bg-blue-100 text-blue-800"
                              : source.status === "REVIEW"
                                ? "bg-yellow-100 text-yellow-800"
                                : source.status === "APPROVED"
                                  ? "bg-green-100 text-green-800"
                                  : source.status === "REJECTED"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {source.status}
                        </span>
                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {source.type}
                        </span>
                        <span className="text-gray-500">
                          {source.sourceDomain}
                        </span>
                        <span className="text-gray-500">
                          {new Date(source.fetchedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <svg
                        className="w-5 h-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
