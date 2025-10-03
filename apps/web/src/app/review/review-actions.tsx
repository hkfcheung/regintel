"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewActionsProps {
  sourceItemId: string;
  status: string;
  userId: string;
}

export function ReviewActions({ sourceItemId, status, userId }: ReviewActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    if (!confirm("Approve this document? It will be published and stored in the knowledge base.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/review/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceItemId, userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve");
      }

      alert("Document approved and stored in knowledge base!");
      router.refresh();
    } catch (error) {
      console.error("Error approving:", error);
      alert("Failed to approve document");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirm("Reject this document? It will be moved to the rejected queue.")) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/review/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceItemId, userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject");
      }

      alert("Document rejected");
      router.refresh();
    } catch (error) {
      console.error("Error rejecting:", error);
      alert("Failed to reject document");
    } finally {
      setLoading(false);
    }
  };

  const handleRevision = async () => {
    const notes = prompt("Enter revision notes (optional):");
    if (notes === null) return; // User cancelled

    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/review/revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceItemId, notes }),
      });

      if (!response.ok) {
        throw new Error("Failed to request revision");
      }

      alert("Revision requested");
      router.refresh();
    } catch (error) {
      console.error("Error requesting revision:", error);
      alert("Failed to request revision");
    } finally {
      setLoading(false);
    }
  };

  if (status === "REJECTED") {
    return (
      <button
        onClick={handleApprove}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
      >
        {loading ? "Processing..." : "Approve (Restore)"}
      </button>
    );
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={handleReject}
        disabled={loading}
        className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
      >
        {loading ? "..." : "Reject"}
      </button>
      <button
        onClick={handleRevision}
        disabled={loading}
        className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm font-medium"
      >
        {loading ? "..." : "Request Revision"}
      </button>
      <button
        onClick={handleApprove}
        disabled={loading}
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
      >
        {loading ? "Processing..." : "Approve"}
      </button>
    </div>
  );
}
