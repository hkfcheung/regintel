"use client";

import { useState, useEffect } from "react";
import { CreateAlertDialog } from "./create-alert-dialog";

interface Alert {
  id: string;
  name: string;
  filters: Array<{ type: string; value: string }>;
  maxPosts: number;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  daysOfWeek: number[];
  timeOfDay: string;
  active: boolean;
  lastSentAt: string | null;
  createdAt: string;
}

interface AlertsListProps {
  userId: string;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const FREQUENCY_LABELS = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every other week",
  MONTHLY: "Monthly",
};

export function AlertsList({ userId }: AlertsListProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const fetchAlerts = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/alerts?userId=${userId}`
      );
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [userId]);

  const handleDeleteAlert = async (alertId: string) => {
    if (!confirm("Are you sure you want to delete this alert?")) {
      return;
    }

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/alerts/${alertId}`,
        {
          method: "DELETE",
        }
      );
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error("Failed to delete alert:", error);
    }
  };

  const handleToggleActive = async (alertId: string, active: boolean) => {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/alerts/${alertId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ active }),
        }
      );
      setAlerts(
        alerts.map((a) => (a.id === alertId ? { ...a, active } : a))
      );
    } catch (error) {
      console.error("Failed to update alert:", error);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading alerts...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => setShowCreateDialog(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Create New Alert
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600 mb-4">
            You don't have any alerts yet.
          </p>
          <p className="text-gray-500 text-sm">
            Create an alert to receive personalized notifications about
            regulatory items matching your criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="bg-white border border-gray-200 rounded-lg p-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{alert.name}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span>{FREQUENCY_LABELS[alert.frequency]}</span>
                    <span>•</span>
                    <span>
                      {alert.daysOfWeek.map((d) => DAY_NAMES[d]).join(", ")}
                    </span>
                    <span>•</span>
                    <span>{alert.timeOfDay}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(alert.id, !alert.active)}
                    className={`px-3 py-1 text-sm rounded ${
                      alert.active
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {alert.active ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-red-600 hover:text-red-800 px-2"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {alert.filters.length > 0 && (
                <div className="mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    Filters:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {alert.filters.map((filter, idx) => (
                      <span
                        key={idx}
                        className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                      >
                        {filter.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-sm text-gray-600">
                <span>Max posts: {alert.maxPosts}</span>
                {alert.lastSentAt && (
                  <>
                    <span className="mx-2">•</span>
                    <span>
                      Last sent:{" "}
                      {new Date(alert.lastSentAt).toLocaleDateString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateAlertDialog
          userId={userId}
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            fetchAlerts();
          }}
        />
      )}
    </div>
  );
}
