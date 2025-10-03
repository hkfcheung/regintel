import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@regintel/database";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Get some stats
  const userCount = await prisma.user.count();
  const sourceItemCount = await prisma.sourceItem.count();
  const auditLogCount = await prisma.auditLog.count();

  // Fetch system health
  let systemHealth = null;
  try {
    const response = await fetch("http://localhost:3001/health/system", {
      cache: "no-store",
    });
    systemHealth = await response.json();
  } catch (error) {
    console.error("Failed to fetch system health:", error);
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Manage users, sources, and system configuration
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{userCount}</p>
              </div>
              <div className="text-4xl">👥</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Source Items</p>
                <p className="text-3xl font-bold text-gray-900">{sourceItemCount}</p>
              </div>
              <div className="text-4xl">📄</div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Audit Logs</p>
                <p className="text-3xl font-bold text-gray-900">{auditLogCount}</p>
              </div>
              <div className="text-4xl">📊</div>
            </div>
          </div>
        </div>

        {/* Admin Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              User Management
            </h2>
            <p className="text-gray-600 mb-4">
              Manage user roles and permissions
            </p>
            <a
              href="/admin/users"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Manage Users →
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Source Ingest
            </h2>
            <p className="text-gray-600 mb-4">
              Ingest regulatory content from FDA and other sources
            </p>
            <a
              href="/admin/ingest"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Manual Ingest →
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Domain Allowlist
            </h2>
            <p className="text-gray-600 mb-4">
              Configure which domains are allowed for source ingestion
            </p>
            <a
              href="/admin/domains"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Manage Domains →
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              RSS Feeds
            </h2>
            <p className="text-gray-600 mb-4">
              Configure RSS feeds to automatically poll for announcements
            </p>
            <a
              href="/admin/feeds"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Manage Feeds →
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Autonomous Discovery
            </h2>
            <p className="text-gray-600 mb-4">
              AI-powered search for relevant pediatric oncology documents
            </p>
            <a
              href="/admin/discovery"
              className="inline-block bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
            >
              Run Discovery →
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Audit Logs
            </h2>
            <p className="text-gray-600 mb-4">
              View system activity and compliance logs
            </p>
            <a
              href="/admin/audit"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              View Audit Logs →
            </a>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 md:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              System Health
            </h2>
            {!systemHealth ? (
              <p className="text-gray-600">Unable to load system health</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Database</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Source Items:</span>
                      <span className="font-medium">{systemHealth.database.sourceItems}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Analyses:</span>
                      <span className="font-medium">{systemHealth.database.analyses}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active Feeds:</span>
                      <span className="font-medium">{systemHealth.database.activeFeeds}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Active Domains:</span>
                      <span className="font-medium">{systemHealth.database.activeDomains}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Queue Status</h3>
                  <div className="space-y-2">
                    {systemHealth.queues.map((queue: any) => (
                      <div key={queue.name} className="flex justify-between text-sm">
                        <span className="text-gray-600 capitalize">{queue.name}:</span>
                        <span className="font-medium">
                          {queue.waiting > 0 && <span className="text-blue-600">{queue.waiting}w </span>}
                          {queue.active > 0 && <span className="text-green-600">{queue.active}a </span>}
                          {queue.waiting === 0 && queue.active === 0 && <span className="text-gray-400">idle</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Services</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Redis:</span>
                      <span className={`font-medium ${systemHealth.redis === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                        {systemHealth.redis}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-500">
                      Last updated: {new Date(systemHealth.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            <strong>✅ Admin Access:</strong> You have full system access as an ADMIN user.
          </p>
        </div>
      </div>
    </main>
  );
}
