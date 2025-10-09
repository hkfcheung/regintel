"use client";

import Link from "next/link";
import { useState } from "react";

interface Feed {
  id: string;
  title: string;
  url: string;
  lastPolledAt: Date | null;
  pollInterval: number;
  todaysIngestions: number;
}

interface Analysis {
  id: string;
  summaryMd: string;
  createdAt: Date;
  sourceItem: {
    id: string;
    title: string;
    sourceDomain: string;
    rssFeedId: string | null;
  };
}

interface SourceItem {
  id: string;
  title: string;
  sourceDomain: string;
  rssFeedId: string | null;
  createdAt: Date;
  status: string;
  analyses: Array<{
    id: string;
    summaryMd: string;
  }>;
}

interface HomeContentProps {
  feeds: Feed[];
  analyses: Analysis[];
  todaysSourceItems: SourceItem[];
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getNextPollTime(lastPolledAt: Date | null, pollInterval: number): string {
  const now = new Date();

  if (!lastPolledAt) {
    // Never polled, calculate next poll from now
    const nextPoll = new Date(now.getTime() + pollInterval * 1000);
    const diff = Math.floor((nextPoll.getTime() - now.getTime()) / 1000 / 60); // minutes

    if (diff < 60) {
      return `${diff}m`;
    }
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }

  const nextPoll = new Date(lastPolledAt.getTime() + pollInterval * 1000);

  if (nextPoll <= now) {
    // Overdue - show "Now"
    return "Now";
  }

  const diff = Math.floor((nextPoll.getTime() - now.getTime()) / 1000 / 60); // minutes

  if (diff <= 1) {
    return "Now";
  }

  if (diff < 60) {
    return `${diff}m`;
  }
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function HomeContent({ feeds, analyses, todaysSourceItems }: HomeContentProps) {
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null);

  // Get today's start
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter source items by selected feed
  const filteredSourceItems = selectedFeedId
    ? todaysSourceItems.filter((item) => item.rssFeedId === selectedFeedId)
    : [];

  const selectedFeed = feeds.find((f) => f.id === selectedFeedId);
  const tabTitle = selectedFeedId && selectedFeed
    ? `Today in ${selectedFeed.title}`
    : "This Week in Regulatory";

  // Show source items when filtered, otherwise show recent analyses
  const showSourceItems = selectedFeedId && filteredSourceItems.length > 0;
  const displayAnalyses = analyses.slice(0, 5);

  return (
    <div className="grid gap-6">
      <Link href="/sources" className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
        <h2 className="text-2xl font-semibold mb-2">Browse Source Items</h2>
        <p className="text-gray-600">View all ingested regulatory content</p>
      </Link>

      <div className="border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">RSS Feed Status</h2>
          {selectedFeedId && (
            <button
              onClick={() => setSelectedFeedId(null)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear filter
            </button>
          )}
        </div>
        {feeds.length === 0 ? (
          <p className="text-gray-600">No active feeds configured</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeds.map((feed) => (
              <div key={feed.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                {/* Feed Info */}
                <div className="mb-3">
                  <h3 className="font-semibold text-sm mb-1 truncate" title={feed.title}>
                    {feed.title}
                  </h3>
                  <p className="text-xs text-gray-500 truncate" title={feed.url}>
                    {feed.url}
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Next Poll */}
                  <div className="bg-blue-50 rounded p-2 text-center">
                    <p className="text-sm font-bold text-blue-700">
                      {getNextPollTime(feed.lastPolledAt, feed.pollInterval)}
                    </p>
                    <p className="text-xs text-gray-600">Next Poll</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Every {formatDuration(feed.pollInterval)}
                    </p>
                  </div>

                  {/* Today's Count */}
                  <button
                    onClick={() => setSelectedFeedId(feed.id)}
                    className={`rounded p-2 text-center transition-all ${
                      feed.todaysIngestions > 0
                        ? 'bg-green-50 hover:bg-green-100'
                        : 'bg-gray-50 hover:bg-gray-100'
                    } ${selectedFeedId === feed.id ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    <p className={`text-2xl font-bold ${feed.todaysIngestions > 0 ? "text-green-600" : "text-gray-400"}`}>
                      {feed.todaysIngestions}
                    </p>
                    <p className="text-xs text-gray-600">Today</p>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-4">{tabTitle}</h2>
        {showSourceItems ? (
          <div className="space-y-4">
            {filteredSourceItems.map((item) => (
              <div key={item.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                <Link href={`/sources/${item.id}`} className="hover:text-blue-600">
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                </Link>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-sm text-gray-600">{item.sourceDomain}</p>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {item.status}
                  </span>
                </div>
                {item.analyses.length > 0 ? (
                  <div className="text-sm text-gray-700 prose prose-sm">
                    {item.analyses[0].summaryMd.slice(0, 200)}...
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Analysis pending...</p>
                )}
              </div>
            ))}
          </div>
        ) : selectedFeedId ? (
          <p className="text-gray-600">No content from this feed today</p>
        ) : displayAnalyses.length === 0 ? (
          <p className="text-gray-600">No analyzed content yet</p>
        ) : (
          <div className="space-y-4">
            {displayAnalyses.map((analysis) => (
              <div key={analysis.id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                <Link href={`/sources/${analysis.sourceItem.id}`} className="hover:text-blue-600">
                  <h3 className="font-semibold mb-1">{analysis.sourceItem.title}</h3>
                </Link>
                <p className="text-sm text-gray-600 mb-2">{analysis.sourceItem.sourceDomain}</p>
                <div className="text-sm text-gray-700 prose prose-sm">
                  {analysis.summaryMd.slice(0, 200)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
