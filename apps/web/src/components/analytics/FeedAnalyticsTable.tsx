"use client";

import { formatDistanceToNow } from "date-fns";

interface FeedAnalytics {
  feedId: string;
  feedTitle: string;
  totalItems: number;
  itemsToday: number;
  itemsThisWeek: number;
  lastPolled: Date | null;
  avgItemsPerDay: number;
}

interface FeedAnalyticsTableProps {
  data: FeedAnalytics[];
  title: string;
}

export function FeedAnalyticsTable({ data, title }: FeedAnalyticsTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-500">No data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feed
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Items
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Today
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                This Week
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Avg/Day
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Polled
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((feed) => (
              <tr key={feed.feedId} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{feed.feedTitle}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 font-medium">
                  {feed.totalItems.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      feed.itemsToday > 0
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {feed.itemsToday}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-600">
                  {feed.itemsThisWeek.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-600">
                  {feed.avgItemsPerDay.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {feed.lastPolled
                    ? formatDistanceToNow(new Date(feed.lastPolled), { addSuffix: true })
                    : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
