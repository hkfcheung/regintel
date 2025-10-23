import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LlmConfigManager } from "./llm-config-manager";

export default async function LlmConfigPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">LLM Configuration</h1>
          <p className="mt-2 text-gray-600">
            Configure language models for graph and database chat
          </p>
        </div>

        <LlmConfigManager />
      </div>
    </main>
  );
}
