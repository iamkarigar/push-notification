import { notifyTeamLabourRegisteredBasic } from "../../services/teamNotificationBasicFunctions.js";

/**
 * POST /api/v1/notifications/labour-registered-notify-team
 *
 * Body (one of):
 * - { "labour_id" } or { "labor_id" } — load Labour model; uses name + mobile for message
 * - { "name", "mobile_number" } — explicit (mobile optional)
 *
 * Optional: `data` — merged into push payload; labour id added when resolved from DB.
 */
export async function notifyTeamLabourRegisteredHandler(req, res) {
  try {
    const out = await notifyTeamLabourRegisteredBasic(req.body || {});
    return res.status(out.status).json(out.json);
  } catch (error) {
    console.error("notifyTeamLabourRegisteredHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
