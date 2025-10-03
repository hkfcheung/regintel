import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { UserList } from "./user-list";

export default async function UsersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch users from API
  let users = [];
  try {
    const response = await fetch("http://localhost:3001/users", {
      cache: "no-store",
    });
    const data = await response.json();
    users = data.users || [];
  } catch (error) {
    console.error("Failed to fetch users:", error);
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-gray-600">
            Manage user roles and permissions
          </p>
        </div>

        <UserList initialUsers={users} currentUserId={session.user.id} />
      </div>
    </main>
  );
}
