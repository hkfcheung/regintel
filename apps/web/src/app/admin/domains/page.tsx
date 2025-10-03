import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@regintel/database";
import { DomainList } from "./domain-list";

export default async function DomainsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/signin");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/");
  }

  const domains = await prisma.allowedDomain.findMany({
    orderBy: { domain: "asc" },
  });

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Domain Allowlist</h1>
          <p className="mt-2 text-gray-600">
            Configure which domains are allowed for source ingestion
          </p>
        </div>

        <DomainList initialDomains={domains} />
      </div>
    </main>
  );
}
