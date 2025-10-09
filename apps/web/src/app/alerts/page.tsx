import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AlertsList } from "./alerts-list";

export default async function AlertsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Alerts</h1>
            <p className="text-gray-600">
              Manage your personalized regulatory intelligence alerts
            </p>
          </div>
        </div>

        <AlertsList userId={session.user.id || ""} />
      </div>
    </main>
  );
}
