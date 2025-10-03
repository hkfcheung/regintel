"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: "VIEWER" | "REVIEWER" | "ADMIN";
  createdAt: Date;
  updatedAt: Date;
}

export function UserList({
  initialUsers,
  currentUserId
}: {
  initialUsers: User[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState<string | null>(null);
  const [showInviteInfo, setShowInviteInfo] = useState(false);

  const updateRole = async (userId: string, newRole: "VIEWER" | "REVIEWER" | "ADMIN") => {
    if (userId === currentUserId) {
      alert("You cannot change your own role");
      return;
    }

    if (!confirm(`Change user role to ${newRole}?`)) {
      return;
    }

    setLoading(userId);
    try {
      const response = await fetch(`http://localhost:3001/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error("Failed to update role");
      }

      router.refresh();
    } catch (error) {
      console.error("Error updating role:", error);
      alert("Failed to update user role");
    } finally {
      setLoading(null);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-purple-100 text-purple-800";
      case "REVIEWER":
        return "bg-blue-100 text-blue-800";
      case "VIEWER":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              How to Add Users
            </h3>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                Users are automatically created when they sign in using GitHub or Google OAuth.
              </p>
              <p className="font-medium">To add a new user:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Share the application URL with the user</li>
                <li>They sign in with their GitHub or Google account</li>
                <li>A new account is created with VIEWER role by default</li>
                <li>You can then change their role here to REVIEWER or ADMIN</li>
              </ol>
            </div>
          </div>
          <button
            onClick={() => setShowInviteInfo(!showInviteInfo)}
            className="ml-4 text-blue-600 hover:text-blue-800"
          >
            {showInviteInfo ? "Hide" : "Show"}
          </button>
        </div>
        {showInviteInfo && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Application URL:</strong>
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border border-blue-300 text-sm">
                {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}
              </code>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    navigator.clipboard.writeText(window.location.origin);
                    alert("URL copied to clipboard!");
                  }
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Role
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Joined
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-medium">
                      {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-900">
                      {user.name || "No name"}
                    </div>
                    {user.id === currentUserId && (
                      <div className="text-xs text-gray-500">(You)</div>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {user.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(user.createdAt).toLocaleDateString()}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                {user.id !== currentUserId && (
                  <div className="relative inline-block text-left">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        updateRole(
                          user.id,
                          e.target.value as "VIEWER" | "REVIEWER" | "ADMIN"
                        )
                      }
                      disabled={loading === user.id}
                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md disabled:bg-gray-100"
                    >
                      <option value="VIEWER">Viewer</option>
                      <option value="REVIEWER">Reviewer</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No users found</p>
        </div>
      )}
      </div>
    </div>
  );
}
