import { notifyTeamUserRegisteredBasic } from "../../services/teamNotificationBasicFunctions.js";

/**
 * POST /api/v1/notifications/user-registered-notify-team
 *
 * Body (one of):
 * - { "user_id" } — load `users` document; label from name + mobile_number
 * - { "name", "mobile_number" } — explicit (at least one required)
 *
 * Optional: `data` — merged into push payload; `userId` added when resolved from DB.
 */
export async function notifyTeamUserRegisteredHandler(req, res) {
  try {
    const out = await notifyTeamUserRegisteredBasic(req.body || {});
    return res.status(out.status).json(out.json);
  } catch (error) {
    console.error("notifyTeamUserRegisteredHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
