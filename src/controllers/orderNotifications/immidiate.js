import {
  notifyTeamNewOrderBasic,
  notifyTeamOrderInitiateBasic,
  notifyTeamSimpleNewOrderBasic,
} from "../../services/teamNotificationBasicFunctions.js";

/**
 * POST body (one of):
 * - { "order_id" } — loads merchant from order and uses business / name as XYZ
 * - { "merchant_name" } or { "received_by" } or { "business_name" } — explicit XYZ
 *
 * Optional: any extra fields passed through in push `data` (e.g. productName) via `data` key in body.
 */
export async function notifyTeamNewOrderHandler(req, res) {
  try {
    const out = await notifyTeamNewOrderBasic(req.body || {});
    return res.status(out.status).json(out.json);
  } catch (error) {
    console.error("notifyTeamNewOrderHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}

/**
 * POST — no body required. Sends a generic “new order” Expo to team (`TEAM_EXPO_NOTIFY_MOBILE_NUMBERS`).
 */
export async function notifyTeamSimpleNewOrderHandler(req, res) {
  try {
    const out = await notifyTeamSimpleNewOrderBasic();
    return res.status(out.status).json(out.json);
  } catch (error) {
    console.error("notifyTeamSimpleNewOrderHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}

/**
 * POST /api/v1/notifications/order-initiate-notify-team
 *
 * Body (one of):
 * - { "order_id" } or { "orderId" } — loads from temp_orders (OrderInitiateModel)
 * - { "material_name", "amount" } — direct payload
 *
 * Optional:
 * - data: object merged in Expo payload
 */
export async function notifyTeamOrderInitiateHandler(req, res) {
  try {
    const out = await notifyTeamOrderInitiateBasic(req.body || {});
    return res.status(out.status).json(out.json);
  } catch (error) {
    console.error("notifyTeamOrderInitiateHandler:", error);
    return res.status(500).json({ success: false, message: error.message || "Server error" });
  }
}
