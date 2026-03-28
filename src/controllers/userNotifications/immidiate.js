import userModel from "../../models/UserModel.js";
import { notifyTeamNewUserRegisteredExpo } from "../../services/broadcastTeamPushByMobile.js";

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
    const body = req.body || {};
    const { user_id, name, mobile_number, data: extraData } = body;

    let displayLabel = null;
    let userIdForPayload = null;

    if (user_id) {
      const user = await userModel.findById(user_id).select("name mobile_number").lean();
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }
      userIdForPayload = String(user._id);
      const parts = [user.name, user.mobile_number].filter((x) => x != null && String(x).trim());
      displayLabel = parts.length ? parts.join(" · ") : "A user";
    } else {
      const n = name != null && String(name).trim() ? String(name).trim() : null;
      const m = mobile_number != null && String(mobile_number).trim() ? String(mobile_number).trim() : null;
      if (!n && !m) {
        return res.status(400).json({
          success: false,
          message: "Provide user_id, or name / mobile_number",
        });
      }
      displayLabel = [n, m].filter(Boolean).join(" · ");
    }

    const pushData = {
      ...(typeof extraData === "object" && extraData !== null ? extraData : {}),
    };
    if (userIdForPayload) pushData.userId = userIdForPayload;

    const result = await notifyTeamNewUserRegisteredExpo(displayLabel, pushData);

    const status = result.success ? 200 : 400;
    return res.status(status).json({
      success: result.success,
      message: result.success ? "Team notified" : result.error || result.message || "Failed",
      teamPush: result,
    });
  } catch (error) {
    console.error("notifyTeamUserRegisteredHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
