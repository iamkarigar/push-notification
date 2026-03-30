import { notifyTeamMerchantLoginBasic } from "../../services/teamNotificationBasicFunctions.js";

/**
 * POST /api/v1/notifications/merchant-login-notify-team
 *
 * Body (one of):
 * - { "merchant_id" } — load Merchent; summary from business name, name, mobile, city
 * - { "business_name" | "buisnessName", "name", "mobile_number" } — explicit summary parts
 *
 * Optional: `data` — merged into push payload; merchant fields added when loaded from DB.
 */
export async function notifyTeamMerchantLoginHandler(req, res) {
  try {
    const out = await notifyTeamMerchantLoginBasic(req.body || {});
    return res.status(out.status).json(out.json);
  } catch (error) {
    console.error("notifyTeamMerchantLoginHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
