import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DiscoveryRunner } from "./discovery-runner";

export default async function DiscoveryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Autonomous Discovery</h1>
          <p className="mt-2 text-gray-600">
            AI-powered autonomous search for relevant pediatric oncology documents
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How It Works</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>✓ Searches configured allowed domains (FDA, EMA, etc.)</li>
            <li>✓ Uses pediatric oncology-specific keywords and patterns</li>
            <li>✓ Checks FDA RSS feeds for recent approvals and guidance</li>
            <li>✓ Filters by pediatric relevance (keywords: pediatric, children, adolescent, etc.)</li>
            <li>✓ Automatically queues discovered URLs for ingestion and analysis</li>
            <li>✓ Deduplicates against existing sources</li>
          </ul>
        </div>

        <DiscoveryRunner />
      </div>
    </main>
  );
}
