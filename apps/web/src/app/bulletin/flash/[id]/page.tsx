import Link from "next/link";
import { prisma } from "@regintel/database";
import { notFound } from "next/navigation";

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function FlashArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.sourceItem.findUnique({
    where: { id },
    include: {
      analyses: {
        select: {
          id: true,
          summaryMd: true,
          impactMd: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!item) {
    notFound();
  }

  const analysis = item.analyses[0];

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back link */}
        <Link
          href="/bulletin/flash"
          className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-6"
        >
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to RegIntel Flash
        </Link>

        {/* Article */}
        <article className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="border-b border-gray-200 pb-6 mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {item.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="font-medium">{item.sourceDomain}</span>
              <span>•</span>
              <span>{formatDate(item.publishedAt)}</span>
              <span>•</span>
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                {item.status}
              </span>
            </div>
          </div>

          {/* Analysis sections */}
          {analysis ? (
            <div className="space-y-8">
              {/* Summary */}
              <section>
                <h2 className="text-xl font-bold text-teal-700 mb-3">Summary</h2>
                <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                  {analysis.summaryMd}
                </div>
              </section>

              {/* Impact */}
              {analysis.impactMd && (
                <section>
                  <h2 className="text-xl font-bold text-teal-700 mb-3">
                    Impact & Key Takeaways
                  </h2>
                  <div className="prose max-w-none text-gray-700 whitespace-pre-wrap">
                    {analysis.impactMd}
                  </div>
                </section>
              )}
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Analysis not yet available for this article.
            </div>
          )}

          {/* Source link */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-teal-600 hover:text-teal-800 font-medium"
            >
              View original source
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
            {item.canonicalPdfUrl && (
              <>
                <span className="mx-3 text-gray-400">•</span>
                <a
                  href={item.canonicalPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-teal-600 hover:text-teal-800 font-medium"
                >
                  Download PDF
                  <svg
                    className="w-4 h-4 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </a>
              </>
            )}
          </div>
        </article>

        {/* Related articles could go here */}
      </div>
    </main>
  );
}
