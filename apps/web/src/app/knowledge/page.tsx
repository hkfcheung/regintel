import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { KnowledgeClient } from "./knowledge-client";

export default async function KnowledgePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch knowledge base stats and sessions
  let stats = null;
  let sessions = [];

  try {
    const [statsResponse, sessionsResponse] = await Promise.all([
      fetch("http://localhost:3001/knowledge/stats", { cache: "no-store" }),
      fetch(`http://localhost:3001/sessions/user/${session.user.id}`, { cache: "no-store" }),
    ]);

    if (statsResponse.ok) {
      stats = await statsResponse.json();
    }

    if (sessionsResponse.ok) {
      const data = await sessionsResponse.json();
      sessions = data.sessions || [];
    }
  } catch (error) {
    console.error("Failed to fetch data:", error);
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <KnowledgeClient
        stats={stats}
        initialSessions={sessions}
        userId={session.user.id}
      />
    </main>
  );
}
