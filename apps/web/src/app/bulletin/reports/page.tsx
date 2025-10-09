import Link from "next/link";

export default function ReportsPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/bulletin"
            className="inline-flex items-center text-teal-600 hover:text-teal-800 mb-4"
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
            Back to Bulletin
          </Link>
        </div>

        <h1 className="text-4xl font-bold mb-4">Regulatory Intelligence Reports</h1>
        <p className="text-lg text-gray-600 mb-8">
          Access archived regulatory intelligence reports and special bulletins
        </p>

        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <svg
            className="w-24 h-24 mx-auto mb-6 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">
            Reports Archive
          </h2>
          <p className="text-gray-500 mb-6">
            Archived reports will appear here. Check back soon for historical regulatory intelligence reports.
          </p>
          <Link
            href="/bulletin/flash"
            className="inline-block bg-teal-600 text-white px-6 py-3 rounded-md font-medium hover:bg-teal-700 transition-colors"
          >
            View Current RegIntel Flash
          </Link>
        </div>
      </div>
    </main>
  );
}
