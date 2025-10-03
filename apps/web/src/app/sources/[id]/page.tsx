import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@regintel/database";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const { id } = await params;

  const source = await prisma.sourceItem.findUnique({
    where: { id },
    include: {
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!source) {
    notFound();
  }

  // Parse tags if stored as JSON
  let tags: string[] = [];
  try {
    tags = typeof source.tags === "string" ? JSON.parse(source.tags) : [];
  } catch {
    tags = [];
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <Link
          href="/sources"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Sources
        </Link>

        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {source.title}
              </h1>
              <div className="flex items-center gap-2 mb-4">
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                  {source.type}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 mb-1">Source Domain</p>
              <p className="text-gray-900 font-medium">{source.sourceDomain}</p>
            </div>
            <div>
              <p className="text-gray-600 mb-1">Fetched At</p>
              <p className="text-gray-900 font-medium">
                {new Date(source.fetchedAt).toLocaleString()}
              </p>
            </div>
            {source.publishedAt && (
              <div>
                <p className="text-gray-600 mb-1">Published At</p>
                <p className="text-gray-900 font-medium">
                  {new Date(source.publishedAt).toLocaleDateString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-gray-600 mb-1">Raindrop Status</p>
              <p className="text-gray-900 font-medium">
                {source.raindropId ? `Synced (${source.raindropId})` : "Not synced"}
              </p>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-600 text-sm mb-2">Tags</p>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* URLs */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="space-y-2">
              <div>
                <p className="text-gray-600 text-sm mb-1">Source URL</p>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700 text-sm break-all"
                >
                  {source.url}
                </a>
              </div>
              {source.canonicalPdfUrl && (
                <div>
                  <p className="text-gray-600 text-sm mb-1">PDF URL</p>
                  <a
                    href={source.canonicalPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm break-all"
                  >
                    {source.canonicalPdfUrl}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Analyses */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Analyses ({source.analyses.length})
          </h2>

          {source.analyses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No analyses yet.</p>
              {session.user.role !== "VIEWER" && (
                <p className="text-sm text-gray-500">
                  Analyses will be generated automatically by the summarization worker.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {source.analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-gray-900">
                      Pediatric Oncology Analysis
                    </h3>
                    <span className="text-xs text-gray-500">
                      {new Date(analysis.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {analysis.summaryMd && (
                    <div className="text-sm text-gray-700 mb-2">
                      <h4 className="font-semibold mb-1">Summary:</h4>
                      <p>{analysis.summaryMd}</p>
                    </div>
                  )}
                  {analysis.impactMd && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-xs font-medium text-yellow-800 mb-1">
                        Impact on Day One
                      </p>
                      <p className="text-sm text-yellow-900">
                        {analysis.impactMd}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
