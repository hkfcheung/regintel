import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@regintel/database";
import { IngestForm } from "./ingest-form";

export default async function AdminIngestPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; jobId?: string; error?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const params = await searchParams;

  // Get recent source items
  const recentItems = await prisma.sourceItem.findMany({
    orderBy: { fetchedAt: "desc" },
    take: 10,
  });

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Manual Ingest</h1>
          <p className="mt-2 text-gray-600">
            Test the ingest pipeline with a single URL
          </p>
        </div>

        {params.success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800">
              ✅ Ingest job queued successfully! Job ID: {params.jobId}
            </p>
            <p className="text-sm text-green-600 mt-1">
              Check the source items table below to see the result in a few seconds.
            </p>
          </div>
        )}

        {params.error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">
              ❌ Error: {decodeURIComponent(params.error)}
            </p>
            <p className="text-sm text-red-600 mt-1">
              Check that the API server is running and Redis is available.
            </p>
          </div>
        )}

        {/* Ingest Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Ingest FDA Content
          </h2>

          <IngestForm />

          {/* Example URLs */}
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Example FDA URLs to test:
            </p>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>
                • Guidance:{" "}
                <code className="text-xs bg-white px-1 py-0.5 rounded">
                  https://www.fda.gov/regulatory-information/search-fda-guidance-documents
                </code>
              </li>
              <li>
                • Warning Letter:{" "}
                <code className="text-xs bg-white px-1 py-0.5 rounded">
                  https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters
                </code>
              </li>
            </ul>
          </div>
        </div>

        {/* Recent Items */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Recent Source Items ({recentItems.length})
          </h2>

          {recentItems.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No source items yet. Ingest your first URL above!
            </p>
          ) : (
            <div className="space-y-3">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.url.substring(0, 80)}...
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span className="bg-gray-100 px-2 py-1 rounded">
                          {item.type}
                        </span>
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {item.status}
                        </span>
                        <span>{new Date(item.fetchedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
