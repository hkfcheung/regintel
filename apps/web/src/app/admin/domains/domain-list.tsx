"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Domain {
  id: string;
  domain: string;
  description: string | null;
  active: boolean;
  discoveryInterval: number;
  lastDiscoveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function DomainList({ initialDomains }: { initialDomains: Domain[] }) {
  const router = useRouter();
  const [domains, setDomains] = useState(initialDomains);
  const [newDomain, setNewDomain] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const addDomain = async () => {
    if (!newDomain.trim()) return;

    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: newDomain,
          description: newDescription || null,
          active: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add domain");
      }

      setNewDomain("");
      setNewDescription("");
      router.refresh();
    } catch (error) {
      console.error("Error adding domain:", error);
      alert("Failed to add domain");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`http://localhost:3001/domains/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update domain");
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating domain:", error);
      alert("Failed to update domain");
    }
  };

  const deleteDomain = async (id: string) => {
    if (!confirm("Are you sure you want to delete this domain?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/domains/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete domain");
      }

      router.refresh();
    } catch (error) {
      console.error("Error deleting domain:", error);
      alert("Failed to delete domain");
    }
  };

  return (
    <div className="space-y-6">
      {/* Add new domain */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Domain</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Domain
            </label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="e.g., fda.gov"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g., FDA - US Food and Drug Administration"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <button
          onClick={addDomain}
          disabled={loading || !newDomain.trim()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? "Adding..." : "Add Domain"}
        </button>
      </div>

      {/* Domain list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discovery Interval
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Discovered
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {domains.map((domain) => (
              <tr key={domain.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {domain.domain}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {domain.description || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {Math.floor(domain.discoveryInterval / 3600)}h
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {domain.lastDiscoveredAt
                    ? new Date(domain.lastDiscoveredAt).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      domain.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {domain.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => toggleActive(domain.id, domain.active)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    {domain.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteDomain(domain.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
