"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IngestForm() {
  const [url, setUrl] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, type }),
      });

      const result = await response.json();

      if (!response.ok) {
        router.push(
          `/admin/ingest?error=${encodeURIComponent(result.error || "Failed to trigger ingest")}`
        );
      } else {
        router.push(`/admin/ingest?success=true&jobId=${result.jobId}`);
      }
    } catch (error) {
      router.push(
        `/admin/ingest?error=${encodeURIComponent(error instanceof Error ? error.message : "Unknown error")}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          URL
        </label>
        <input
          type="url"
          id="url"
          name="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.fda.gov/..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label
          htmlFor="type"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Type (optional - will auto-detect)
        </label>
        <select
          id="type"
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Auto-detect</option>
          <option value="guidance">Guidance</option>
          <option value="warning_letter">Warning Letter</option>
          <option value="untitled_letter">Untitled Letter</option>
          <option value="meeting">Meeting</option>
          <option value="approval">Approval</option>
          <option value="press">Press Release</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Triggering..." : "Trigger Ingest"}
      </button>
    </form>
  );
}
