/**
 * Alert Service
 * Processes user alerts and sends notifications
 */

import { prisma } from "@regintel/database";
import { sendAlertEmail } from "./emailService.js";

/**
 * Get alerts that are due to be sent
 */
export async function getAlertsDueForProcessing(): Promise<any[]> {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // Get all active alerts
  const alerts = await prisma.userAlert.findMany({
    where: {
      active: true,
    },
    include: {
      user: true,
    },
  });

  // Filter alerts that are due based on:
  // 1. Day of week matches
  // 2. Time of day matches (within a 1-hour window to account for scheduler delays)
  // 3. Not sent recently (based on frequency)
  const dueAlerts = alerts.filter((alert) => {
    // Check if today is one of the alert's scheduled days
    if (!alert.daysOfWeek.includes(currentDay)) {
      return false;
    }

    // Check if the time is within the scheduled time (±30 minutes)
    const [alertHour, alertMin] = alert.timeOfDay.split(":").map(Number);
    const alertTime = alertHour * 60 + alertMin;
    const nowTime = now.getHours() * 60 + now.getMinutes();
    const timeDiff = Math.abs(alertTime - nowTime);

    if (timeDiff > 30) {
      return false;
    }

    // Check if alert was already sent based on frequency
    if (alert.lastSentAt) {
      const daysSinceLastSent = Math.floor(
        (now.getTime() - alert.lastSentAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      switch (alert.frequency) {
        case "WEEKLY":
          if (daysSinceLastSent < 7) return false;
          break;
        case "BIWEEKLY":
          if (daysSinceLastSent < 14) return false;
          break;
        case "MONTHLY":
          if (daysSinceLastSent < 30) return false;
          break;
      }
    }

    return true;
  });

  return dueAlerts;
}

/**
 * Process an alert: fetch matching items and send email
 */
export async function processAlert(alertId: string): Promise<void> {
  const alert = await prisma.userAlert.findUnique({
    where: { id: alertId },
    include: {
      user: true,
    },
  });

  if (!alert) {
    throw new Error(`Alert ${alertId} not found`);
  }

  // Calculate the time window based on frequency
  const now = new Date();
  const startDate = new Date(now);

  switch (alert.frequency) {
    case "WEEKLY":
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "BIWEEKLY":
      startDate.setDate(startDate.getDate() - 14);
      break;
    case "MONTHLY":
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  // Build query filters based on alert filters
  const filters = alert.filters as Array<{ type: string; value: string }>;
  const whereClause: any = {
    createdAt: {
      gte: startDate,
    },
    status: "APPROVED", // Only send approved items
  };

  // Apply custom filters
  if (filters && filters.length > 0) {
    filters.forEach((filter) => {
      switch (filter.type) {
        case "type":
          whereClause.type = filter.value;
          break;
        case "domain":
          whereClause.sourceDomain = {
            contains: filter.value,
          };
          break;
        case "tag":
          // For JSON array fields, we need to use raw SQL or check if the value is in the array
          // For now, we'll skip this filter type
          break;
      }
    });
  }

  // Fetch matching source items with analyses
  const items = await prisma.sourceItem.findMany({
    where: whereClause,
    include: {
      analyses: {
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: alert.maxPosts,
  });

  // Send email if there are items
  if (items.length > 0) {
    await sendAlertEmail(alert.user.email, alert.name, items);
  }

  // Update lastSentAt
  await prisma.userAlert.update({
    where: { id: alertId },
    data: {
      lastSentAt: now,
    },
  });
}

/**
 * Process all due alerts
 */
export async function processAllDueAlerts(): Promise<{
  processed: number;
  errors: Array<{ alertId: string; error: string }>;
}> {
  const dueAlerts = await getAlertsDueForProcessing();
  const errors: Array<{ alertId: string; error: string }> = [];
  let processed = 0;

  for (const alert of dueAlerts) {
    try {
      await processAlert(alert.id);
      processed++;
    } catch (error) {
      errors.push({
        alertId: alert.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return { processed, errors };
}
