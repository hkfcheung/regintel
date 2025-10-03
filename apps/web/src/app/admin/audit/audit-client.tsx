"use client";

import { useState, useEffect } from "react";

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  diff: any;
  at: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

export function AuditLogClient({ initialLogs }: { initialLogs: AuditLog[] }) {
  const [logs, setLogs] = useState<AuditLog[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Fetch logs on mount
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        console.log("Fetching audit logs...");
        const response = await fetch("http://localhost:3001/audit?limit=50");
        console.log("Response status:", response.status);
        if (response.ok) {
          const data = await response.json();
          console.log("Received data:", data);
          console.log("Logs count:", data.logs?.length || 0);
          setLogs(data.logs || []);
        }
      } catch (error) {
        console.error("Failed to fetch initial logs:", error);
      }
    };
    fetchLogs();
  }, []);

  const handleFilter = async () => {
    setLoading(true);
    try {
      const queryParams: any = {};
      if (entityFilter && entityFilter.trim()) queryParams.entity = entityFilter;
      if (actionFilter && actionFilter.trim()) queryParams.action = actionFilter;
      if (startDate && startDate.trim()) queryParams.startDate = startDate;
      if (endDate && endDate.trim()) queryParams.endDate = endDate;
      queryParams.limit = 50;

      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        params.append(key, String(value));
      });

      console.log("Filtering with params:", params.toString());
      const response = await fetch(`http://localhost:3001/audit?${params.toString()}`);
      console.log("Filter response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Filter results:", data.logs?.length || 0, "logs");
        setLogs(data.logs || []);
      } else {
        const errorText = await response.text();
        console.error("Filter error:", errorText);
        alert("Failed to filter audit logs: " + errorText);
      }
    } catch (error) {
      console.error("Failed to filter logs:", error);
      alert("Failed to filter audit logs");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (entityFilter) params.append("entity", entityFilter);
      if (actionFilter) params.append("action", actionFilter);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`http://localhost:3001/audit/export?${params.toString()}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString()}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Failed to export logs:", error);
      alert("Failed to export audit logs");
    } finally {
      setExporting(false);
    }
  };

  const handleClearFilters = async () => {
    setEntityFilter("");
    setActionFilter("");
    setStartDate("");
    setEndDate("");

    // Fetch logs without any filters
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/audit?limit=50");
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        setLogs(initialLogs);
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error);
      setLogs(initialLogs);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entity
            </label>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Entities</option>
              <option value="source_item">Source Items</option>
              <option value="user">Users</option>
              <option value="allowed_domain">Allowed Domains</option>
              <option value="rss_feed">RSS Feeds</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action
            </label>
            <input
              type="text"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              placeholder="e.g., approved, created"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleFilter}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? "Filtering..." : "Apply Filters"}
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 font-medium"
          >
            Clear Filters
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="ml-auto px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {exporting ? "Exporting..." : "📥 Export to CSV"}
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Audit Logs Found</h2>
            <p className="text-gray-600">
              No audit logs match your current filters. Try adjusting your search criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Changes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {log.user.name || "Unknown"}
                      </div>
                      <div className="text-xs text-gray-500">{log.user.email}</div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                        {log.user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>{log.entity}</div>
                      <div className="text-xs text-gray-500 font-mono">{log.entityId.substring(0, 12)}...</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <details className="cursor-pointer">
                        <summary className="text-blue-600 hover:text-blue-700">View changes</summary>
                        <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.diff, null, 2)}
                        </pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
