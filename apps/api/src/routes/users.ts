/**
 * User Management API Routes
 */

import type { FastifyInstance } from "fastify";
import { prisma } from "@regintel/database";
import { z } from "zod";

const UpdateRoleSchema = z.object({
  role: z.enum(["VIEWER", "REVIEWER", "ADMIN"]),
});

export async function userRoutes(fastify: FastifyInstance) {
  /**
   * GET /users - List all users
   */
  fastify.get("/", async (request, reply) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ users });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch users",
      });
    }
  });

  /**
   * PATCH /users/:id/role - Update user role
   */
  fastify.patch("/:id/role", async (request, reply) => {
    const { id } = request.params as { id: string };

    const validation = UpdateRoleSchema.safeParse(request.body);
    if (!validation.success) {
      return reply.code(400).send({
        error: "Invalid request",
        details: validation.error.issues,
      });
    }

    const { role } = validation.data;

    try {
      const user = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      return reply.send({
        success: true,
        user,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update user role",
      });
    }
  });

  /**
   * GET /users/:id - Get user details
   */
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              reviews: true,
              publications: true,
              auditLogs: true,
            },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: "User not found",
        });
      }

      return reply.send({ user });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch user",
      });
    }
  });
}
