/**
 * Email Service
 * Handles sending email notifications
 *
 * TODO: Replace console.log with actual email provider (SendGrid, AWS SES, Resend, etc.)
 */

interface SourceItemWithAnalysis {
  id: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  sourceDomain: string;
  type: string;
  analyses: Array<{
    summaryMd: string;
    impactMd: string;
  }>;
}

/**
 * Send alert email to user
 */
export async function sendAlertEmail(
  to: string,
  alertName: string,
  items: SourceItemWithAnalysis[]
): Promise<void> {
  const emailContent = generateAlertEmailHtml(alertName, items);

  // TODO: Replace with actual email sending
  // Example with SendGrid:
  // await sgMail.send({
  //   to,
  //   from: process.env.FROM_EMAIL || 'alerts@regintel.com',
  //   subject: `RegIntel Alert: ${alertName}`,
  //   html: emailContent,
  // });

  console.log("=".repeat(80));
  console.log(`📧 EMAIL ALERT: ${alertName}`);
  console.log(`To: ${to}`);
  console.log(`Items: ${items.length}`);
  console.log("=".repeat(80));
  console.log(emailContent);
  console.log("=".repeat(80));

  // For now, we just log it
  // In production, you would send the actual email here
}

/**
 * Generate HTML email content
 */
function generateAlertEmailHtml(
  alertName: string,
  items: SourceItemWithAnalysis[]
): string {
  const itemsHtml = items
    .map(
      (item) => `
    <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 10px 0; color: #111827;">
        <a href="${item.url}" style="color: #2563eb; text-decoration: none;">${item.title}</a>
      </h3>
      <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">
        <span>${item.type}</span> •
        <span>${item.sourceDomain}</span> •
        <span>${item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "N/A"}</span>
      </div>
      ${
        item.analyses.length > 0
          ? `
        <div style="margin-top: 15px;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #374151;">Summary</h4>
          <div style="color: #4b5563; line-height: 1.6;">
            ${item.analyses[0].summaryMd.substring(0, 300)}...
          </div>
        </div>
      `
          : ""
      }
    </div>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${alertName} - RegIntel Alert</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(to right, #3b82f6, #2563eb); padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px;">RegIntel Alert</h1>
      <p style="margin: 10px 0 0 0; color: #dbeafe; font-size: 16px;">${alertName}</p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 14px;">
        You have ${items.length} new ${items.length === 1 ? "item" : "items"} matching your alert criteria.
      </p>

      ${itemsHtml}

      <!-- Footer -->
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
        <p style="margin: 0;">
          This alert was sent by RegIntel - Regulatory Intelligence Platform
        </p>
        <p style="margin: 10px 0 0 0;">
          <a href="${process.env.WEB_URL || "http://localhost:3000"}/alerts" style="color: #2563eb; text-decoration: none;">Manage your alerts</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}
