/**
 * User Alerts API Routes
 */

import { FastifyPluginAsync } from "fastify";
import { prisma } from "@regintel/database";

export const alertsRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /alerts - Get all alerts for a user
   */
  fastify.get("/", async (request, reply) => {
    const { userId } = request.query as { userId: string };

    if (!userId) {
      return reply.status(400).send({
        success: false,
        error: "userId is required",
      });
    }

    try {
      const alerts = await prisma.userAlert.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ alerts });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch alerts",
      });
    }
  });

  /**
   * GET /alerts/:id - Get a specific alert
   */
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const alert = await prisma.userAlert.findUnique({
        where: { id },
      });

      if (!alert) {
        return reply.status(404).send({
          success: false,
          error: "Alert not found",
        });
      }

      return reply.send({ alert });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch alert",
      });
    }
  });

  /**
   * POST /alerts - Create a new alert
   */
  fastify.post("/", async (request, reply) => {
    const body = request.body as {
      userId: string;
      name: string;
      filters: Array<{ type: string; value: string }>;
      maxPosts?: number;
      frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
      daysOfWeek: number[];
      timeOfDay: string;
      active?: boolean;
    };

    if (!body.userId || !body.name || !body.frequency || !body.daysOfWeek || !body.timeOfDay) {
      return reply.status(400).send({
        success: false,
        error: "Missing required fields",
      });
    }

    try {
      const alert = await prisma.userAlert.create({
        data: {
          userId: body.userId,
          name: body.name,
          filters: body.filters || [],
          maxPosts: body.maxPosts || 30,
          frequency: body.frequency,
          daysOfWeek: body.daysOfWeek,
          timeOfDay: body.timeOfDay,
          active: body.active ?? true,
        },
      });

      return reply.status(201).send({ success: true, alert });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create alert",
      });
    }
  });

  /**
   * PATCH /alerts/:id - Update an alert
   */
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      filters?: Array<{ type: string; value: string }>;
      maxPosts?: number;
      frequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
      daysOfWeek?: number[];
      timeOfDay?: string;
      active?: boolean;
    };

    try {
      const alert = await prisma.userAlert.update({
        where: { id },
        data: body,
      });

      return reply.send({ success: true, alert });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update alert",
      });
    }
  });

  /**
   * DELETE /alerts/:id - Delete an alert
   */
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.userAlert.delete({
        where: { id },
      });

      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete alert",
      });
    }
  });
};
