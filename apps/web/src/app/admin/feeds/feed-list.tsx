"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Feed {
  id: string;
  url: string;
  title: string;
  description: string | null;
  classifications: string[];
  pollInterval: number;
  active: boolean;
  lastPolledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CLASSIFICATION_OPTIONS = [
  { value: "APPROVAL", label: "Approval" },
  { value: "GUIDANCE", label: "Guidance" },
  { value: "SAFETY_ALERT", label: "Safety Alert" },
  { value: "OTHER", label: "Other" },
];

export function FeedList({ initialFeeds }: { initialFeeds: Feed[] }) {
  const router = useRouter();
  const [feeds, setFeeds] = useState(initialFeeds);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [newFeed, setNewFeed] = useState({
    url: "",
    title: "",
    description: "",
    classifications: [] as string[],
    pollInterval: 3600,
  });

  const addFeed = async () => {
    if (!newFeed.url.trim() || !newFeed.title.trim()) {
      alert("URL and Title are required");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/rss/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newFeed,
          description: newFeed.description || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add feed");
      }

      setNewFeed({
        url: "",
        title: "",
        description: "",
        classifications: [],
        pollInterval: 3600,
      });
      setShowAddForm(false);
      router.refresh();
    } catch (error) {
      console.error("Error adding feed:", error);
      alert("Failed to add feed");
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`http://localhost:3001/rss/feeds/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update feed");
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating feed:", error);
      alert("Failed to update feed");
    }
  };

  const deleteFeed = async (id: string) => {
    if (!confirm("Are you sure you want to delete this feed?")) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/rss/feeds/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete feed");
      }

      router.refresh();
    } catch (error) {
      console.error("Error deleting feed:", error);
      alert("Failed to delete feed");
    }
  };

  const triggerPoll = async (feedId?: string) => {
    try {
      const response = await fetch("http://localhost:3001/rss/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedId }),
      });

      if (!response.ok) {
        throw new Error("Failed to trigger poll");
      }

      const data = await response.json();
      alert(`RSS poll queued: ${data.message}`);
    } catch (error) {
      console.error("Error triggering poll:", error);
      alert("Failed to trigger poll");
    }
  };

  const toggleClassification = (classification: string) => {
    setNewFeed((prev) => ({
      ...prev,
      classifications: prev.classifications.includes(classification)
        ? prev.classifications.filter((c) => c !== classification)
        : [...prev.classifications, classification],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {showAddForm ? "Cancel" : "Add Feed"}
        </button>
        <button
          onClick={() => triggerPoll()}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Poll All Feeds Now
        </button>
      </div>

      {/* Add feed form */}
      {showAddForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Add RSS Feed</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feed URL *
              </label>
              <input
                type="url"
                value={newFeed.url}
                onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                placeholder="https://example.com/rss.xml"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newFeed.title}
                onChange={(e) => setNewFeed({ ...newFeed, title: e.target.value })}
                placeholder="FDA Pediatric Oncology Announcements"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newFeed.description}
                onChange={(e) => setNewFeed({ ...newFeed, description: e.target.value })}
                placeholder="RSS feed for pediatric oncology drug approvals and guidance"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Classifications
              </label>
              <div className="flex flex-wrap gap-2">
                {CLASSIFICATION_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleClassification(option.value)}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      newFeed.classifications.includes(option.value)
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poll Interval (seconds)
              </label>
              <input
                type="number"
                value={newFeed.pollInterval}
                onChange={(e) => setNewFeed({ ...newFeed, pollInterval: parseInt(e.target.value) })}
                min="60"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {newFeed.pollInterval / 60} minutes ({newFeed.pollInterval / 3600} hours)
              </p>
            </div>
            <button
              onClick={addFeed}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? "Adding..." : "Add Feed"}
            </button>
          </div>
        </div>
      )}

      {/* Feed list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Classifications
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interval
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Polled
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
            {feeds.map((feed) => (
              <tr key={feed.id}>
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{feed.title}</div>
                    <div className="text-sm text-gray-500 break-all">{feed.url}</div>
                    {feed.description && (
                      <div className="text-xs text-gray-400 mt-1">{feed.description}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {feed.classifications.map((c) => (
                      <span
                        key={c}
                        className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded"
                      >
                        {c.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {feed.pollInterval / 3600}h
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {feed.lastPolledAt
                    ? new Date(feed.lastPolledAt).toLocaleString()
                    : "Never"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      feed.active
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {feed.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => triggerPoll(feed.id)}
                    className="text-green-600 hover:text-green-900 mr-3"
                  >
                    Poll
                  </button>
                  <button
                    onClick={() => toggleActive(feed.id, feed.active)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    {feed.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteFeed(feed.id)}
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
