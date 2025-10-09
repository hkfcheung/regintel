import { prisma } from "@regintel/database";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppearanceEditor } from "./appearance-editor";

export default async function AppearancePage() {
  const session = await auth();

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch appearance config
  const configs = await prisma.appConfig.findMany({
    where: {
      category: "appearance",
    },
  });

  const configMap: Record<string, string> = {};
  configs.forEach((config) => {
    configMap[config.key] = config.value;
  });

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Appearance Settings</h1>
          <p className="text-gray-600">
            Customize the look and feel of your application
          </p>
        </div>

        <AppearanceEditor initialConfig={configMap} />
      </div>
    </main>
  );
}
