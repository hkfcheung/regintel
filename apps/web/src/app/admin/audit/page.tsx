import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AuditLogClient } from "./audit-client";

export default async function AuditLogsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch initial audit logs and stats
  let logs = [];
  let stats = null;

  try {
    const [logsResponse, statsResponse] = await Promise.all([
      fetch("http://localhost:3001/audit?limit=20", { cache: "no-store" }),
      fetch("http://localhost:3001/audit/stats", { cache: "no-store" }),
    ]);

    if (logsResponse.ok) {
      const data = await logsResponse.json();
      logs = data.logs || [];
    }

    if (statsResponse.ok) {
      stats = await statsResponse.json();
    }
  } catch (error) {
    console.error("Failed to fetch audit data:", error);
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="mt-2 text-gray-600">
            View system activity and compliance logs
          </p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Total Logs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Entities Tracked</p>
              <p className="text-2xl font-bold text-blue-600">{stats.entityBreakdown?.length || 0}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Action Types</p>
              <p className="text-2xl font-bold text-purple-600">{stats.actionBreakdown?.length || 0}</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-green-600">{stats.topActors?.length || 0}</p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            📊 About Audit Logs
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              Audit logs track all important system activities for compliance and security purposes.
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>User Actions:</strong> Track who did what and when</li>
              <li><strong>Entity Changes:</strong> Monitor modifications to source items, users, and configuration</li>
              <li><strong>Compliance:</strong> Export logs for regulatory compliance reporting</li>
              <li><strong>Security:</strong> Identify suspicious activity and audit trails</li>
            </ul>
          </div>
        </div>

        {/* Client Component */}
        <AuditLogClient initialLogs={logs} />
      </div>
    </main>
  );
}
