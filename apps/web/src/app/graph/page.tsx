import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { GraphViewer } from "./graph-viewer";

export default async function GraphPage() {
  const session = await auth();

  // Only admins can access graph visualization
  if (!session || session.user?.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Knowledge Graph
          </h1>
          <p className="mt-2 text-gray-600">
            Interactive visualization of regulatory intelligence relationships
          </p>
        </div>

        <GraphViewer />
      </div>
    </div>
  );
}
