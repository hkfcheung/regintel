/**
 * Domain Allowlist Management API Routes
 */

import { FastifyPluginAsync } from "fastify";
import { prisma } from "@regintel/database";

export const domainRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /domains - List all allowed domains
   */
  fastify.get("/", async (request, reply) => {
    try {
      const domains = await prisma.allowedDomain.findMany({
        orderBy: { domain: "asc" },
      });

      return reply.send({ domains });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch domains",
      });
    }
  });

  /**
   * POST /domains - Add a new allowed domain
   */
  fastify.post("/", async (request, reply) => {
    const body = request.body as {
      domain: string;
      description?: string;
      active?: boolean;
    };

    try {
      const domain = await prisma.allowedDomain.create({
        data: {
          domain: body.domain.toLowerCase(),
          description: body.description,
          active: body.active ?? true,
        },
      });

      return reply.status(201).send({ success: true, domain });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create domain",
      });
    }
  });

  /**
   * PATCH /domains/:id - Update an allowed domain
   */
  fastify.patch("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      domain?: string;
      description?: string;
      active?: boolean;
    };

    try {
      const updateData: any = {};
      if (body.domain) updateData.domain = body.domain.toLowerCase();
      if (body.description !== undefined) updateData.description = body.description;
      if (body.active !== undefined) updateData.active = body.active;

      const domain = await prisma.allowedDomain.update({
        where: { id },
        data: updateData,
      });

      return reply.send({ success: true, domain });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update domain",
      });
    }
  });

  /**
   * DELETE /domains/:id - Delete an allowed domain
   */
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      await prisma.allowedDomain.delete({
        where: { id },
      });

      return reply.send({ success: true });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete domain",
      });
    }
  });
};
