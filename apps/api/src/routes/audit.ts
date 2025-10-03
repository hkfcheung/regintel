import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@regintel/database";

const filterSchema = z.object({
  actor: z.string().optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().optional().default(50),
  offset: z.coerce.number().optional().default(0),
});

export async function auditRoutes(fastify: FastifyInstance) {
  // Get audit logs with filters
  fastify.get("/", async (request, reply) => {
    const validation = filterSchema.safeParse(request.query);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { actor, entity, action, startDate, endDate, limit, offset } = validation.data;

    try {
      const where: any = {};

      if (actor) where.actor = actor;
      if (entity) where.entity = entity;
      if (action) where.action = { contains: action, mode: "insensitive" };
      if (startDate || endDate) {
        where.at = {};
        if (startDate) where.at.gte = new Date(startDate);
        if (endDate) where.at.lte = new Date(endDate);
      }

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true },
            },
          },
          orderBy: { at: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return reply.send({
        logs,
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      });
    } catch (error: any) {
      fastify.log.error("Error fetching audit logs:", error);
      return reply.status(500).send({ error: "Failed to fetch audit logs" });
    }
  });

  // Export audit logs to CSV
  fastify.get("/export", async (request, reply) => {
    const validation = filterSchema.safeParse(request.query);
    if (!validation.success) {
      return reply.status(400).send({ error: validation.error.message });
    }

    const { actor, entity, action, startDate, endDate } = validation.data;

    try {
      const where: any = {};

      if (actor) where.actor = actor;
      if (entity) where.entity = entity;
      if (action) where.action = { contains: action, mode: "insensitive" };
      if (startDate || endDate) {
        where.at = {};
        if (startDate) where.at.gte = new Date(startDate);
        if (endDate) where.at.lte = new Date(endDate);
      }

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { email: true, name: true, role: true },
          },
        },
        orderBy: { at: "desc" },
      });

      // Generate CSV
      const csvRows = [
        ["Timestamp", "User", "Email", "Role", "Action", "Entity", "Entity ID", "Changes"].join(","),
      ];

      for (const log of logs) {
        const row = [
          new Date(log.at).toISOString(),
          log.user.name || "Unknown",
          log.user.email,
          log.user.role,
          log.action,
          log.entity,
          log.entityId,
          JSON.stringify(log.diff).replace(/"/g, '""'), // Escape quotes
        ];
        csvRows.push(row.map(v => `"${v}"`).join(","));
      }

      const csv = csvRows.join("\n");

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="audit-logs-${new Date().toISOString()}.csv"`);
      return reply.send(csv);
    } catch (error: any) {
      fastify.log.error("Error exporting audit logs:", error);
      return reply.status(500).send({ error: "Failed to export audit logs" });
    }
  });

  // Get audit log statistics
  fastify.get("/stats", async (request, reply) => {
    try {
      const [total, actorCounts, entityCounts, actionCounts] = await Promise.all([
        prisma.auditLog.count(),
        prisma.auditLog.groupBy({
          by: ["actor"],
          _count: true,
          orderBy: { _count: { actor: "desc" } },
          take: 10,
        }),
        prisma.auditLog.groupBy({
          by: ["entity"],
          _count: true,
          orderBy: { _count: { entity: "desc" } },
        }),
        prisma.auditLog.groupBy({
          by: ["action"],
          _count: true,
          orderBy: { _count: { action: "desc" } },
        }),
      ]);

      return reply.send({
        total,
        topActors: actorCounts,
        entityBreakdown: entityCounts,
        actionBreakdown: actionCounts,
      });
    } catch (error: any) {
      fastify.log.error("Error fetching audit stats:", error);
      return reply.status(500).send({ error: "Failed to fetch stats" });
    }
  });
}
