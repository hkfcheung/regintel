"use client";

import { useState } from "react";

interface DiscoveryResult {
  domain: string;
  query: string;
  urlsFound: string[];
  urlsQueued: number;
  errors: string[];
}

interface JobResult {
  results: DiscoveryResult[];
  totalUrlsFound: number;
  totalUrlsQueued: number;
  totalErrors: number;
}

export function DiscoveryRunner() {
  const [loading, setLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiscovery = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setJobId(null);

    try {
      // Trigger discovery
      const triggerResponse = await fetch("http://localhost:3001/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!triggerResponse.ok) {
        throw new Error("Failed to trigger discovery");
      }

      const triggerData = await triggerResponse.json();
      setJobId(triggerData.jobId);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max

      const pollInterval = setInterval(async () => {
        attempts++;

        try {
          const statusResponse = await fetch(
            `http://localhost:3001/discovery/status/${triggerData.jobId}`
          );

          if (!statusResponse.ok) {
            clearInterval(pollInterval);
            setError("Failed to check job status");
            setLoading(false);
            return;
          }

          const statusData = await statusResponse.json();

          if (statusData.state === "completed") {
            clearInterval(pollInterval);
            setResult(statusData.returnvalue);
            setLoading(false);
          } else if (statusData.state === "failed") {
            clearInterval(pollInterval);
            setError(`Discovery failed: ${statusData.failedReason}`);
            setLoading(false);
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setError("Discovery timed out");
            setLoading(false);
          }
        } catch (err) {
          clearInterval(pollInterval);
          setError("Error polling job status");
          setLoading(false);
        }
      }, 5000); // Poll every 5 seconds
    } catch (err) {
      console.error("Error running discovery:", err);
      setError(err instanceof Error ? err.message : "Failed to run discovery");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Run discovery */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Run Discovery</h2>
        <p className="text-sm text-gray-600 mb-4">
          This will search all active allowed domains for new pediatric oncology documents.
          The process may take 2-5 minutes depending on the number of documents found.
        </p>
        <button
          onClick={runDiscovery}
          disabled={loading}
          className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {loading ? "Running Discovery..." : "Start Discovery"}
        </button>

        {jobId && loading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              Discovery job queued: <code className="font-mono">{jobId}</code>
            </p>
            <p className="text-sm text-blue-600 mt-2">Searching for documents...</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Discovery Results</h2>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">URLs Found</p>
              <p className="text-2xl font-bold text-blue-600">{result.totalUrlsFound}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">URLs Queued</p>
              <p className="text-2xl font-bold text-green-600">{result.totalUrlsQueued}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-red-600">{result.totalErrors}</p>
            </div>
          </div>

          {/* Domain breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Domain Breakdown</h3>
            {result.results.map((domainResult, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{domainResult.domain}</h4>
                  <span className="text-sm text-gray-500">
                    {domainResult.urlsQueued} / {domainResult.urlsFound.length} queued
                  </span>
                </div>

                {domainResult.urlsFound.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-sm text-blue-600 cursor-pointer hover:text-blue-700">
                      View {domainResult.urlsFound.length} URLs
                    </summary>
                    <ul className="mt-2 space-y-1 text-xs">
                      {domainResult.urlsFound.map((url, urlIdx) => (
                        <li key={urlIdx} className="text-gray-600 break-all">
                          • {url}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {domainResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-600">
                    <p className="font-medium">Errors:</p>
                    <ul className="ml-4 space-y-1">
                      {domainResult.errors.map((err, errIdx) => (
                        <li key={errIdx}>• {err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              ✅ Discovery complete! {result.totalUrlsQueued} new documents have been queued for
              ingestion and analysis.
            </p>
            <p className="text-xs text-green-600 mt-2">
              Check the Sources page to see the newly discovered items as they are processed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
