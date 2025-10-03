import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@regintel/database";
import { FeedList } from "./feed-list";

export default async function FeedsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const feeds = await prisma.rssFeed.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">RSS Feeds</h1>
          <p className="mt-2 text-gray-600">
            Configure RSS feeds to automatically poll for regulatory announcements
          </p>
        </div>

        <FeedList initialFeeds={feeds} />
      </div>
    </main>
  );
}
