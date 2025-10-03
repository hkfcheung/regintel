"use server";

import { prisma } from "@regintel/database";
import { auth } from "@/lib/auth";

/**
 * Create an audit log entry
 * Called automatically after protected mutations
 */
export async function createAuditLog(params: {
  action: string;
  entity: string;
  entityId: string;
  diff?: Record<string, any>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: No active session");
  }

  await prisma.auditLog.create({
    data: {
      actor: session.user.id,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      diff: params.diff || {},
    },
  });
}

/**
 * Get audit logs with filtering
 * Admin-only
 */
export async function getAuditLogs(params?: {
  entity?: string;
  entityId?: string;
  actor?: string;
  limit?: number;
  offset?: number;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required");
  }

  const where = {
    ...(params?.entity && { entity: params.entity }),
    ...(params?.entityId && { entityId: params.entityId }),
    ...(params?.actor && { actor: params.actor }),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: { at: "desc" },
    take: params?.limit || 50,
    skip: params?.offset || 0,
  });

  return logs;
}
