"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  id: string;
  content: string;
  metadata: {
    sourceItemId: string;
    domain: string;
    title: string;
    url: string;
    classification?: string;
    pediatricRelevance?: boolean;
    analyzedAt: string;
    summary: string;
    impact: string;
    pediatricDetails?: any;
  };
  score: number;
}

interface SearchSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  queries: SearchQuery[];
}

interface SearchQuery {
  id: string;
  sessionId: string;
  query: string;
  results: any[];
  createdAt: string;
}

interface KnowledgeClientProps {
  stats?: any;
  initialSessions: SearchSession[];
  userId: string;
}

export function KnowledgeClient({ stats, initialSessions, userId }: KnowledgeClientProps) {
  const router = useRouter();

  // Sidebar state
  const [sessions, setSessions] = useState<SearchSession[]>(initialSessions);
  const [currentSession, setCurrentSession] = useState<SearchSession | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "management">("search");

  // Management state
  const [bulkStoring, setBulkStoring] = useState(false);

  // Render sidebar component
  const renderSidebar = () => {
    return (
      <div className="flex flex-col h-screen">
        {/* New Chat Button */}
        <div className="p-4 border-b border-gray-700">
          <button
            onClick={async () => {
              const response = await fetch("http://localhost:3001/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, title: "New Search" }),
              });
              if (response.ok) {
                const data = await response.json();
                const newSession = { ...data.session, queries: [] }; // Initialize queries array
                setSessions([newSession, ...sessions]);
                setCurrentSession(newSession);
                setSearchResults([]);
                setSearchQuery("");
              }
            }}
            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm font-medium flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span> New Search
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative rounded-md p-3 cursor-pointer transition-colors ${
                  currentSession?.id === session.id
                    ? "bg-gray-800"
                    : "hover:bg-gray-800"
                }`}
                onClick={() => {
                  setCurrentSession(session);
                  if (session.queries.length > 0) {
                    const lastQuery = session.queries[session.queries.length - 1];
                    setSearchResults(lastQuery.results || []);
                    setSearchQuery(lastQuery.query);
                  }
                }}
              >
                {editingSessionId === session.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={async () => {
                      if (editingTitle.trim()) {
                        await fetch(`http://localhost:3001/sessions/${session.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ title: editingTitle }),
                        });
                        setSessions(
                          sessions.map((s) =>
                            s.id === session.id ? { ...s, title: editingTitle } : s
                          )
                        );
                      }
                      setEditingSessionId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="w-full bg-gray-700 text-white px-2 py-1 rounded text-sm"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{session.title}</p>
                      <p className="text-xs text-gray-400">
                        {session.queries?.length || 0} {(session.queries?.length || 0) === 1 ? "query" : "queries"}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSessionId(session.id);
                          setEditingTitle(session.title);
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-xs"
                        title="Rename"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm("Delete this session?")) {
                            await fetch(`http://localhost:3001/sessions/${session.id}`, {
                              method: "DELETE",
                            });
                            setSessions(sessions.filter((s) => s.id !== session.id));
                            if (currentSession?.id === session.id) {
                              setCurrentSession(null);
                              setSearchResults([]);
                            }
                          }
                        }}
                        className="p-1 hover:bg-red-600 rounded text-xs"
                        title="Delete"
                      >
                        🗑️
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          window.open(`http://localhost:3001/sessions/${session.id}/export`, "_blank");
                        }}
                        className="p-1 hover:bg-gray-700 rounded text-xs"
                        title="Export"
                      >
                        📥
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-gray-700 text-xs text-gray-400">
          {sessions.length} search sessions
        </div>
      </div>
    );
  };

  // Main content rendering
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch("http://localhost:3001/knowledge/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 10 }),
      });

      const data = await response.json();
      const results = data.results || [];
      setSearchResults(results);

      // Save to current session or create new one
      let sessionId = currentSession?.id;
      let newSession = null;
      console.log("Current session before create:", currentSession);
      if (!sessionId) {
        console.log("Creating new session for userId:", userId);
        const sessionResponse = await fetch("http://localhost:3001/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            title: searchQuery.substring(0, 50),
          }),
        });
        console.log("Session response status:", sessionResponse.status);
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          console.log("Session created:", sessionData);
          sessionId = sessionData.session.id;
          newSession = { ...sessionData.session, queries: [] }; // Initialize queries array
          setCurrentSession(newSession);
          // Add the new session to the sessions list
          const updatedSessions = [newSession, ...sessions];
          console.log("Updating sessions list. New length:", updatedSessions.length);
          setSessions(updatedSessions);
        } else {
          console.error("Failed to create session:", await sessionResponse.text());
        }
      }

      if (sessionId) {
        const queryResponse = await fetch(`http://localhost:3001/sessions/${sessionId}/queries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery, results }),
        });

        if (queryResponse.ok) {
          const queryData = await queryResponse.json();
          // Update the session in the sessions list to include the new query
          setSessions(sessions.map(s =>
            s.id === sessionId
              ? { ...s, queries: [...(s.queries || []), queryData.query] }
              : s
          ));
          // Update current session as well
          if (currentSession?.id === sessionId) {
            setCurrentSession({
              ...currentSession,
              queries: [...(currentSession.queries || []), queryData.query]
            });
          }
        }
      }
    } catch (error) {
      console.error("Search failed:", error);
      alert("Failed to search knowledge base");
    } finally {
      setSearching(false);
    }
  };

  const handleBulkStore = async () => {
    if (!confirm("Store all approved documents in SmartBuckets™? This may take a while.")) {
      return;
    }

    setBulkStoring(true);
    try {
      const response = await fetch("http://localhost:3001/knowledge/bulk-store", {
        method: "POST",
      });

      const data = await response.json();
      alert(
        `Bulk store completed!\nStored: ${data.stored}\nFailed: ${data.failed}\nTotal: ${data.total}`
      );
      router.refresh();
    } catch (error) {
      console.error("Bulk store failed:", error);
      alert("Failed to bulk store documents");
    } finally {
      setBulkStoring(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex-shrink-0">
        {renderSidebar()}
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">SmartBuckets™</h1>
            <p className="mt-2 text-gray-600">
              Semantic search across regulatory intelligence powered by Raindrop SmartBuckets™
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Documents in SmartBuckets™</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.documentsInKnowledgeBase}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Total Approved Documents</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.totalApprovedDocuments}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-sm text-gray-600">Total Analyzed</p>
                <p className="text-2xl font-bold text-gray-600">
                  {stats.totalAnalyzed}
                </p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              🧠 About SmartBuckets™
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                SmartBuckets™ by Raindrop MCP provides intelligent search capabilities across all
                approved regulatory documents in your knowledge base.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong>Semantic Search:</strong> Find documents by meaning, not just keywords
                </li>
                <li>
                  <strong>Similar Document Discovery:</strong> Automatically find related regulations
                </li>
                <li>
                  <strong>Historical Context:</strong> View precedents and patterns in regulatory decisions
                </li>
                <li>
                  <strong>Institutional Memory:</strong> Build a searchable archive of pediatric oncology intelligence
                </li>
              </ul>
              <p className="mt-3 text-xs text-blue-700">
                Powered by <strong>Raindrop MCP SmartBuckets™</strong>
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("search")}
            className={`${
              activeTab === "search"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            🔍 Semantic Search
          </button>
          <button
            onClick={() => setActiveTab("management")}
            className={`${
              activeTab === "management"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            ⚙️ Management
          </button>
        </nav>
      </div>

      {/* Search Tab */}
      {activeTab === "search" && (
        <div>
          {/* Search Form */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <form onSubmit={handleSearch}>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for regulatory documents... (e.g., 'CAR-T therapy pediatric safety')"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={searching}
                />
                <button
                  type="submit"
                  disabled={searching || !searchQuery.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {searching ? "Searching..." : "Search"}
                </button>
              </div>
            </form>

            <div className="mt-3 text-sm text-gray-600">
              <strong>Example queries:</strong>
              <ul className="mt-1 space-y-1">
                <li>• "CAR-T therapy pediatric dosing guidelines"</li>
                <li>• "Leukemia treatment approvals for children under 12"</li>
                <li>• "FDA guidance on pediatric oncology trials"</li>
              </ul>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Search Results ({searchResults.length})
              </h2>
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {result.metadata.title}
                        </h3>
                        <div className="flex items-center gap-3 text-xs mb-3">
                          <span className="px-2 py-1 bg-gray-100 rounded text-gray-700">
                            {result.metadata.domain}
                          </span>
                          {result.metadata.classification && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded font-medium">
                              {result.metadata.classification}
                            </span>
                          )}
                          <span className="text-gray-500">
                            Analyzed: {new Date(result.metadata.analyzedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex flex-col items-end">
                        <span className="text-sm font-semibold text-blue-600">
                          {Math.round(result.score * 100)}% match
                        </span>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-3">
                      <h5 className="text-xs font-semibold text-gray-600 mb-1 uppercase">Summary</h5>
                      <p className="text-sm text-gray-900">
                        {result.metadata.summary || "No summary available"}
                      </p>
                    </div>

                    {/* Impact */}
                    {result.metadata.impact && (
                      <div className="bg-yellow-50 rounded-lg p-4 mb-3">
                        <h5 className="text-xs font-semibold text-yellow-900 mb-1 uppercase">Impact on Day One</h5>
                        <p className="text-sm text-yellow-900">
                          {result.metadata.impact}
                        </p>
                      </div>
                    )}

                    {/* Pediatric Details */}
                    {result.metadata.pediatricDetails && (
                      <div className="bg-blue-50 rounded-lg p-4 mb-4">
                        <h5 className="text-xs font-semibold text-blue-900 mb-2 uppercase">Pediatric Details</h5>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {result.metadata.pediatricDetails.age_groups?.length > 0 && (
                            <div>
                              <span className="font-medium text-blue-800">Age Groups: </span>
                              <span className="text-blue-900">
                                {result.metadata.pediatricDetails.age_groups.join(", ")}
                              </span>
                            </div>
                          )}
                          {result.metadata.pediatricDetails.dosing && (
                            <div>
                              <span className="font-medium text-blue-800">Dosing: </span>
                              <span className="text-blue-900">
                                {result.metadata.pediatricDetails.dosing}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <a
                        href={result.metadata.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Source →
                      </a>
                      <a
                        href={`/sources/${result.metadata.sourceItemId}`}
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium"
                      >
                        View Full Analysis →
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchResults.length === 0 && searchQuery && !searching && (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Results Found</h2>
              <p className="text-gray-600">
                Try a different search query or ensure documents are stored in SmartBuckets™.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Management Tab */}
      {activeTab === "management" && (
        <div className="space-y-6">
          {/* Bulk Store */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Bulk Store Approved Documents
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Store all approved documents in SmartBuckets™. This enables semantic
              search and similar document discovery.
            </p>
            <button
              onClick={handleBulkStore}
              disabled={bulkStoring}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {bulkStoring ? "Storing Documents..." : "Bulk Store All Approved Documents"}
            </button>
          </div>

          {/* Auto-Store on Approval */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              ✅ Auto-Store on Approval
            </h3>
            <p className="text-sm text-green-800">
              Documents are automatically stored in SmartBuckets™ when they are approved in
              the review queue.
            </p>
          </div>

          {/* SmartBucket Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              SmartBuckets™ Configuration
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Bucket Name:</span>
                <span className="font-medium">regulatory-intelligence</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Technology:</span>
                <span className="font-medium">Raindrop MCP SmartBuckets™</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Search Type:</span>
                <span className="font-medium">Intelligent text matching</span>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
