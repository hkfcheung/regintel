import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  // Only admins can access analytics
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return <AnalyticsClient />;
}
