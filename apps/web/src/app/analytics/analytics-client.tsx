"use client";

import { useState, useEffect } from "react";
import { MetricCard } from "@/components/analytics/MetricCard";
import { TimeSeriesChart } from "@/components/analytics/TimeSeriesChart";
import { PieChartCard } from "@/components/analytics/PieChartCard";
import { BarChartCard } from "@/components/analytics/BarChartCard";
import { FeedAnalyticsTable } from "@/components/analytics/FeedAnalyticsTable";

interface AnalyticsData {
  overview: {
    totalItems: number;
    totalFeeds: number;
    totalAlerts: number;
    totalUsers: number;
    itemsToday: number;
    itemsThisWeek: number;
    itemsThisMonth: number;
  };
  timeSeries: Array<{
    date: string;
    count: number;
    approved: number;
    pending: number;
    rejected: number;
  }>;
  distributions: {
    type: Array<{ name: string; value: number; percentage: number }>;
    region: Array<{ name: string; value: number; percentage: number }>;
    status: Array<{ name: string; value: number; percentage: number }>;
    source: Array<{ name: string; value: number; percentage: number }>;
  };
  topTags: Array<{ name: string; value: number; percentage: number }>;
  feedAnalytics: Array<{
    feedId: string;
    feedTitle: string;
    totalItems: number;
    itemsToday: number;
    itemsThisWeek: number;
    lastPolled: Date | null;
    avgItemsPerDay: number;
  }>;
}

export function AnalyticsClient() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3001/analytics/all?days=${timeRange}`);
      if (response.ok) {
        const analyticsData = await response.json();
        setData(analyticsData);
      }
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load analytics data. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="mt-2 text-gray-600">Comprehensive insights into your regulatory intelligence data</p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setTimeRange(7)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            timeRange === 7
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setTimeRange(30)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            timeRange === 30
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Last 30 Days
        </button>
        <button
          onClick={() => setTimeRange(90)}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            timeRange === 90
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          Last 90 Days
        </button>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Items"
          value={data.overview.totalItems}
          subtitle={`${data.overview.itemsToday} today`}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <MetricCard
          title="Active Feeds"
          value={data.overview.totalFeeds}
          subtitle="RSS feeds monitored"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5c7.18 0 13 5.82 13 13M6 11a7 7 0 017 7m-6 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          }
        />
        <MetricCard
          title="User Alerts"
          value={data.overview.totalAlerts}
          subtitle="Active alert subscriptions"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          }
        />
        <MetricCard
          title="Total Users"
          value={data.overview.totalUsers}
          subtitle="Registered users"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
      </div>

      {/* Time Series Chart */}
      <div className="mb-8">
        <TimeSeriesChart
          data={data.timeSeries}
          title="Items Ingested Over Time"
          showBreakdown={true}
        />
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PieChartCard data={data.distributions.type} title="Distribution by Type" />
        <PieChartCard
          data={data.distributions.region}
          title="Distribution by Region"
          colors={["#3b82f6", "#10b981", "#f59e0b", "#ef4444"]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PieChartCard
          data={data.distributions.status}
          title="Review Status Distribution"
          colors={["#10b981", "#f59e0b", "#ef4444"]}
        />
        <BarChartCard
          data={data.distributions.source}
          title="Top 10 Sources"
          color="#8b5cf6"
        />
      </div>

      {/* Top Tags */}
      <div className="mb-8">
        <BarChartCard
          data={data.topTags.slice(0, 15)}
          title="Top 15 Tags"
          color="#06b6d4"
          horizontal={true}
        />
      </div>

      {/* Feed Analytics Table */}
      <div className="mb-8">
        <FeedAnalyticsTable data={data.feedAnalytics} title="RSS Feed Performance" />
      </div>
    </div>
  );
}
