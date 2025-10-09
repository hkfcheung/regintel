"use client";

import { useState } from "react";

interface CreateAlertDialogProps {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const DAY_OPTIONS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function CreateAlertDialog({
  userId,
  onClose,
  onSuccess,
}: CreateAlertDialogProps) {
  const [name, setName] = useState("");
  const [filterText, setFilterText] = useState("");
  const [maxPosts, setMaxPosts] = useState(30);
  const [frequency, setFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">(
    "WEEKLY"
  );
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([5]); // Friday
  const [timeOfDay, setTimeOfDay] = useState("10:00");
  const [submitting, setSubmitting] = useState(false);

  const handleDayToggle = (day: number) => {
    if (daysOfWeek.includes(day)) {
      setDaysOfWeek(daysOfWeek.filter((d) => d !== day));
    } else {
      setDaysOfWeek([...daysOfWeek, day]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Parse filter text into filter objects
      const filters = filterText
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f.length > 0)
        .map((f) => ({ type: "tag", value: f }));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/alerts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId,
            name,
            filters,
            maxPosts,
            frequency,
            daysOfWeek,
            timeOfDay,
          }),
        }
      );

      if (response.ok) {
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Failed to create alert: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to create alert:", error);
      alert("Failed to create alert. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Create a personal alert</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Applied filters */}
          {filterText && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Applied filters
              </label>
              <div className="flex flex-wrap gap-2">
                {filterText
                  .split(",")
                  .map((f) => f.trim())
                  .filter((f) => f.length > 0)
                  .map((filter, idx) => (
                    <span
                      key={idx}
                      className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm"
                    >
                      {filter}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Name your alert
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Protocol Design"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Filters */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filters (comma-separated)
            </label>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Protocol Design, Clinical Trial"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Max posts */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Set the maximum number of posts per alert
            </label>
            <input
              type="number"
              value={maxPosts}
              onChange={(e) => setMaxPosts(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Schedule */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Schedule
            </label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="WEEKLY"
                  checked={frequency === "WEEKLY"}
                  onChange={(e) => setFrequency("WEEKLY")}
                  className="mr-2"
                />
                <span className="text-gray-700">Weekly</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="BIWEEKLY"
                  checked={frequency === "BIWEEKLY"}
                  onChange={(e) => setFrequency("BIWEEKLY")}
                  className="mr-2"
                />
                <span className="text-gray-700">Every other week</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="MONTHLY"
                  checked={frequency === "MONTHLY"}
                  onChange={(e) => setFrequency("MONTHLY")}
                  className="mr-2"
                />
                <span className="text-gray-700">Every month</span>
              </label>
            </div>
          </div>

          {/* Days of week */}
          <div className="mb-6">
            <div className="flex gap-3">
              {DAY_OPTIONS.map((day) => (
                <label key={day.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={daysOfWeek.includes(day.value)}
                    onChange={() => handleDayToggle(day.value)}
                    className="mr-2"
                  />
                  <span className="text-gray-700">{day.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time
            </label>
            <input
              type="time"
              value={timeOfDay}
              onChange={(e) => setTimeOfDay(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Preview */}
          {name && daysOfWeek.length > 0 && (
            <div className="mb-6 p-4 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-700">
                Email alerts will be sent out at {timeOfDay} every{" "}
                {daysOfWeek
                  .sort()
                  .map((d) => DAY_OPTIONS.find((opt) => opt.value === d)?.label)
                  .join(", ")}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name || daysOfWeek.length === 0}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
