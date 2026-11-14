import { createClient } from "@/lib/supabase/client";
import { logger } from "@/lib/logger";

export async function logAuditEvent(
  userId: string | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>,
  ipAddress?: string
) {
  try {
    const supabase = createClient();

    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: ipAddress,
    });

    logger.info(
      `Audit: ${action} on ${resourceType}`,
      { resourceId, details },
      userId
    );
  } catch (error) {
    logger.error("Failed to log audit event", { error, action, resourceType });
  }
}
