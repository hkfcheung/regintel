import Link from "next/link";

export default function BulletinPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">Regulatory Intelligence Bulletin</h1>
        <p className="text-lg text-gray-600 mb-8">
          Access curated regulatory intelligence reports and insights
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/bulletin/flash"
            className="border border-gray-200 rounded-lg p-8 hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-10 h-10 text-blue-600"
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
              <h2 className="text-2xl font-semibold">RegIntel Flash</h2>
            </div>
            <p className="text-gray-600">
              Weekly regulatory intelligence bulletin with approved articles organized by region
            </p>
          </Link>

          <Link
            href="/bulletin/reports"
            className="border border-gray-200 rounded-lg p-8 hover:border-gray-300 hover:shadow-md transition-all"
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-10 h-10 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="text-2xl font-semibold">Reports</h2>
            </div>
            <p className="text-gray-600">
              Access archived regulatory intelligence reports and special bulletins
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
